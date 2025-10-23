from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import numpy as np
import torch
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
import os
import uuid
from django.conf import settings
from django.core.files.storage import FileSystemStorage

from .audio import (
    AUDIO_STORAGE, 
    load_audio_file, 
    compute_spectrogram,
    generate_waveform_chunk,
    compute_frequency_over_time,
    get_original_sample_rate,
    get_next_chunk_position,
    is_chunk_complete,
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'drone_model')
feature_extractor, model = None, None

try:
    feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_PATH)
    model = AutoModelForAudioClassification.from_pretrained(MODEL_PATH)
    model.eval()
    print("✅ Drone detection model loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")

def generate_drone_spectrogram(y, sr):
    try:
        return compute_spectrogram(
            samples=y,
            sr=sr,
            n_fft=1024,
            hop_length=256,
            fmax=44000,
            use_mel=False,
            max_time_points=700,
            max_freq_points=250
        )
    except Exception as e:
        print(f"Spectrogram generation error: {e}")
        return {"z": [], "x": [], "y": []}

class DroneDetectionView(APIView):
    parser_classes = (FormParser, MultiPartParser, JSONParser)
    
    def post(self, request):
        if model is None or feature_extractor is None:
            return Response({'error': 'Model not loaded'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_id = f"{uuid.uuid4()}{os.path.splitext(audio_file.name)[1]}"
            fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
            temp_filename = fs.save(file_id, audio_file)
            temp_filepath = fs.path(temp_filename)

            original_sr = get_original_sample_rate(temp_filepath)

            MAX_DURATION = 5
            y, sr = load_audio_file(temp_filepath, sr=16000, mono=True, duration=MAX_DURATION)

            inputs = feature_extractor(y, sampling_rate=sr, return_tensors="pt")
            with torch.no_grad():
                logits = model(**inputs).logits
            scores = torch.nn.functional.softmax(logits, dim=1).numpy()[0]
            predicted_class_id = int(np.argmax(scores))
            predicted_label = model.config.id2label[predicted_class_id]

            spectrogram_data = generate_drone_spectrogram(y, sr)
            initial_waveform = generate_waveform_chunk(y, sr, start_index=0)
            freq_time_data = compute_frequency_over_time(y, sr)

            return Response({
                'file_id': temp_filename,
                'prediction': predicted_label.upper(),
                'spectrogram': spectrogram_data,
                'initial_waveform': initial_waveform,
                'freq_time_data': freq_time_data,
                'original_rate': int(original_sr),
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WaveformChunkView(APIView):
    parser_classes = (FormParser, MultiPartParser, JSONParser)

    def post(self, request):
        file_id = request.data.get('file_id')
        position = int(request.data.get('position', 0))
        view_seconds = 2.0

        if not file_id:
            return Response({'error': 'No file_id provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if file_id not in AUDIO_STORAGE:
                fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
                if not fs.exists(file_id):
                    return Response({'error': 'File not found or expired'}, status=status.HTTP_404_NOT_FOUND)
                
                print(f"Loading {file_id} from disk into memory cache...")
                y, sr = load_audio_file(fs.path(file_id), sr=16000, mono=True, duration=None)
                AUDIO_STORAGE[file_id] = {'samples': y, 'sr': sr}

            return self._handle_chunk_request(file_id, position, view_seconds)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _handle_chunk_request(self, file_id, position, view_seconds):
        stored = AUDIO_STORAGE[file_id]
        samples = stored['samples']
        sr = stored['sr']
        
        if is_chunk_complete(position, len(samples), view_seconds, sr):
            return Response({'completed': True})

        new_position = get_next_chunk_position(position, view_seconds, sr)
        chunk_data = generate_waveform_chunk(samples, sr, new_position, view_seconds)

        return Response({
            'completed': False,
            'time': chunk_data['time'],
            'amplitude': chunk_data['amplitude'],
            'new_position': new_position,
        })