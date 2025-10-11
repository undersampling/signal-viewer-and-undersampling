# # backend/api/views/drone_views.py

# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from rest_framework.parsers import MultiPartParser, FormParser
# import librosa
# import numpy as np
# import torch
# from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
# import os
# import uuid
# from django.conf import settings
# from django.core.files.storage import FileSystemStorage

# # --- Load Model (No changes needed here) ---
# MODEL_PATH = os.path.join(os.path.dirname(__file__), 'drone_model')
# try:
#     feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_PATH)
#     model = AutoModelForAudioClassification.from_pretrained(MODEL_PATH)
#     print("✅ Drone detection model loaded successfully")
# except Exception as e:
#     print(f"❌ Error loading model: {e}")
#     model = None
#     feature_extractor = None

# # --- API View for Initial Upload and Full Analysis ---
# class DroneDetectionView(APIView):
#     parser_classes = (MultiPartParser, FormParser)

#     def post(self, request):
#         if model is None:
#             return Response({'error': 'Model not loaded'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#         audio_file = request.FILES.get('audio')
#         if not audio_file:
#             return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             # Save the file to a temporary location with a unique ID
#             file_id = f"{uuid.uuid4()}{os.path.splitext(audio_file.name)[1]}"
#             fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
#             temp_filename = fs.save(file_id, audio_file)
#             temp_filepath = fs.path(temp_filename)

#             # Load the full audio from the saved file
#             y, sr = librosa.load(temp_filepath, sr=16000, mono=True)

#             # Perform prediction
#             inputs = feature_extractor(y, sampling_rate=sr, return_tensors="pt")
#             with torch.no_grad():
#                 logits = model(**inputs).logits
#             scores = torch.nn.functional.softmax(logits, dim=1).numpy()[0]
#             predicted_class_id = np.argmax(scores)
#             predicted_label = model.config.id2label[predicted_class_id]

#             # Generate full spectrogram and the initial waveform view
#             spectrogram_data = self._generate_spectrogram(y, sr)
#             initial_waveform = self._generate_waveform_chunk(y, sr, start_index=0)

#             # Return all initial data, including the crucial file_id
#             return Response({
#                 'file_id': temp_filename,
#                 'prediction': predicted_label.upper(),
#                 'spectrogram': spectrogram_data,
#                 'initial_waveform': initial_waveform,
#             })
#         except Exception as e:
#             return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#     def _generate_spectrogram(self, y, sr):
#         stft = librosa.stft(y)
#         db_spectrogram = librosa.amplitude_to_db(np.abs(stft), ref=np.max)
#         times = librosa.frames_to_time(np.arange(db_spectrogram.shape[1]), sr=sr)
#         freqs = librosa.fft_frequencies(sr=sr)
#         return {'z': db_spectrogram.tolist(), 'x': times.tolist(), 'y': freqs.tolist()}

#     def _generate_waveform_chunk(self, y, sr, start_index, view_seconds=2.0):
#         window_size = int(view_seconds * sr)
#         end_index = start_index + window_size
#         chunk = y[start_index:end_index]
#         start_time = start_index / sr
#         end_time = start_time + len(chunk) / sr
#         time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()
#         return {'time': time_axis, 'amplitude': chunk.tolist()}

# # --- API View for Efficiently Fetching Waveform Chunks ---
# class WaveformChunkView(APIView):
#     def post(self, request):
#         file_id = request.data.get('file_id')
#         position = int(request.data.get('position', 0))
#         view_seconds = 2.0

#         if not file_id:
#             return Response({'error': 'No file_id provided'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
#             if not fs.exists(file_id):
#                 return Response({'error': 'File not found or session expired'}, status=status.HTTP_404_NOT_FOUND)
            
#             y, sr = librosa.load(fs.path(file_id), sr=16000, mono=True)
            
#             window_size = int(view_seconds * sr)
#             # This step matches the Dash app's scrolling logic
#             step = int(window_size / 20) 
#             new_position = position + step

#             if new_position + window_size > len(y):
#                 return Response({'completed': True})

#             end_index = new_position + window_size
#             chunk = y[new_position:end_index]
#             start_time = new_position / sr
#             end_time = start_time + len(chunk) / sr
#             time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()

#             return Response({
#                 'completed': False,
#                 'time': time_axis,
#                 'amplitude': chunk.tolist(),
#                 'new_position': new_position,
#             })
#         except Exception as e:
#             return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# backend/api/views/drone_views.py

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
import io
import base64
import soundfile as sf
from django.conf import settings
from django.core.files.storage import FileSystemStorage

# --- Load Model ---
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

            return Response({
                'file_id': temp_filename,
                'prediction': predicted_label.upper(),
                'spectrogram': spectrogram_data,
                'initial_waveform': initial_waveform,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

# --- API View for Efficiently Fetching Waveform Chunks ---
class WaveformChunkView(APIView):
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

# --- API View for Resampling Audio ---
class ResampleAudioView(APIView):
    def post(self, request):
        file_id = request.data.get('file_id')
        new_sr = int(request.data.get('new_sr', 16000))

        if not file_id:
            return Response({'error': 'No file_id provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
            if not fs.exists(file_id):
                return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
            
            filepath = fs.path(file_id)

            y_original, sr_original = librosa.load(filepath, sr=None, mono=True)
            y_resampled = librosa.resample(y=y_original, orig_sr=sr_original, target_sr=new_sr)

            waveform_data = self._generate_waveform_chunk(y_resampled, new_sr)
            spectrogram_data = self._generate_spectrogram(y_resampled, new_sr)

            buffer = io.BytesIO()
            sf.write(buffer, y_resampled, new_sr, format='WAV')
            buffer.seek(0)
            audio_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            resampled_audio_src = f"data:audio/wav;base64,{audio_base64}"

            return Response({
                'resampled_audio_src': resampled_audio_src,
                'waveform': waveform_data,
                'spectrogram': spectrogram_data,
            })

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _generate_spectrogram(self, y, sr):
        stft = librosa.stft(y)
        db_spectrogram = librosa.amplitude_to_db(np.abs(stft), ref=np.max)
        times = librosa.frames_to_time(np.arange(db_spectrogram.shape[1]), sr=sr)
        freqs = librosa.fft_frequencies(sr=sr)
        return {'z': db_spectrogram.tolist(), 'x': times.tolist(), 'y': freqs.tolist()}

    def _generate_waveform_chunk(self, y, sr):
        max_points = 32000
        y_chunk = y[:max_points]
        duration = len(y_chunk) / sr
        time_axis = np.linspace(0, duration, len(y_chunk)).tolist()
        return {'time': time_axis, 'amplitude': y_chunk.tolist()}