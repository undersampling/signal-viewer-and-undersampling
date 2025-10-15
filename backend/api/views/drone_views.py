# your_app/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
import librosa
import numpy as np
import torch
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
import os
import uuid
from django.conf import settings
from django.core.files.storage import FileSystemStorage

# --- Load Model (remains the same) ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'drone_model')
try:
    feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_PATH)
    model = AutoModelForAudioClassification.from_pretrained(MODEL_PATH)
    print("✅ Drone detection model loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None
    feature_extractor = None

# --- API View for Initial Upload and Full Analysis ---
class DroneDetectionView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        if model is None:
            return Response({'error': 'Model not loaded'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_id = f"{uuid.uuid4()}{os.path.splitext(audio_file.name)[1]}"
            fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
            temp_filename = fs.save(file_id, audio_file)
            temp_filepath = fs.path(temp_filename)

            y, sr = librosa.load(temp_filepath, sr=16000, mono=True)

            inputs = feature_extractor(y, sampling_rate=sr, return_tensors="pt")
            with torch.no_grad():
                logits = model(**inputs).logits
            scores = torch.nn.functional.softmax(logits, dim=1).numpy()[0]
            predicted_class_id = np.argmax(scores)
            predicted_label = model.config.id2label[predicted_class_id]

            spectrogram_data = self._generate_spectrogram(y, sr)
            initial_waveform = self._generate_waveform_chunk(y, sr, start_index=0)
            # +++ ADDED +++ : Generate the new frequency vs. time data
            freq_time_data = self._generate_freq_time(y, sr)

            return Response({
                'file_id': temp_filename,
                'prediction': predicted_label.upper(),
                'spectrogram': spectrogram_data,
                'initial_waveform': initial_waveform,
                # +++ ADDED +++ : Add the new data to the response
                'freq_time_data': freq_time_data,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # +++ ADDED +++ : New helper function to calculate frequency over time (pitch)
    def _generate_freq_time(self, y, sr):
        # Use a pitch detection algorithm (pyin) to find the fundamental frequency (f0)
        f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        
        # Get the time points for each f0 value
        times = librosa.times_like(f0, sr=sr)
        
        # Replace numpy's 'nan' (not a number) with Python's 'None' so it becomes 'null' in JSON.
        # Plotly can then create gaps in the line for parts where no frequency was detected.
        f0_with_nulls = np.where(np.isnan(f0), None, f0)
        
        return {'time': times.tolist(), 'frequency': f0_with_nulls.tolist()}

    def _generate_spectrogram(self, y, sr):
        stft = librosa.stft(y)
        db_spectrogram = librosa.amplitude_to_db(np.abs(stft), ref=np.max)
        times = librosa.frames_to_time(np.arange(db_spectrogram.shape[1]), sr=sr)
        freqs = librosa.fft_frequencies(sr=sr)
        return {'z': db_spectrogram.tolist(), 'x': times.tolist(), 'y': freqs.tolist()}

    def _generate_waveform_chunk(self, y, sr, start_index, view_seconds=2.0):
        window_size = int(view_seconds * sr)
        end_index = start_index + window_size
        chunk = y[start_index:end_index]
        start_time = start_index / sr
        end_time = start_time + len(chunk) / sr
        time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()
        return {'time': time_axis, 'amplitude': chunk.tolist()}

# --- API View for Efficiently Fetching Waveform Chunks (remains the same) ---
class WaveformChunkView(APIView):
    # ... (no changes in this class)
    def post(self, request):
        file_id = request.data.get('file_id')
        position = int(request.data.get('position', 0))
        view_seconds = 2.0
        if not file_id:
            return Response({'error': 'No file_id provided'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
            if not fs.exists(file_id):
                return Response({'error': 'File not found or session expired'}, status=status.HTTP_404_NOT_FOUND)
            
            y, sr = librosa.load(fs.path(file_id), sr=16000, mono=True)
            
            window_size = int(view_seconds * sr)
            step = int(window_size / 20) 
            new_position = position + step

            if new_position + window_size > len(y):
                return Response({'completed': True})

            end_index = new_position + window_size
            chunk = y[new_position:end_index]
            start_time = new_position / sr
            end_time = start_time + len(chunk) / sr
            time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()

            return Response({
                'completed': False,
                'time': time_axis,
                'amplitude': chunk.tolist(),
                'new_position': new_position,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
