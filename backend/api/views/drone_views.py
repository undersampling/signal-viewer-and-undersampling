# drone_views.py
"""
Drone detection using ML model with audio classification and visualization.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import librosa
import numpy as np
import torch
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
import os
import uuid
from django.conf import settings
from django.core.files.storage import FileSystemStorage

# Import shared utilities from audio.py
from .audio import AUDIO_STORAGE, load_audio_file

# ===============================
# --- Load Drone Model ---
# ===============================
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'drone_model')
feature_extractor, model = None, None

try:
    feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_PATH)
    model = AutoModelForAudioClassification.from_pretrained(MODEL_PATH)
    model.eval()
    print("✅ Drone detection model loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")

# ===============================
# --- Drone-Specific Visualization Functions ---
# ===============================

def generate_spectrogram(y, sr):

    try:
        n_fft = 1024 
        hop_length = 256
        win_length = 1024 

        stft = librosa.stft(y, n_fft=n_fft, hop_length=hop_length, win_length=win_length)
        magnitude = np.abs(stft)
        db_spectrogram = librosa.amplitude_to_db(magnitude, ref=np.max)

        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
        times = librosa.frames_to_time(np.arange(db_spectrogram.shape[1]), sr=sr, hop_length=hop_length)

        # Filter frequencies up to 44kHz
        max_freq = 44000
        freq_mask = freqs <= max_freq
        freqs = freqs[freq_mask]
        db_spectrogram = db_spectrogram[freq_mask, :]

        # Clip to reasonable range
        db_spectrogram = np.clip(db_spectrogram, -80, 0)

        # Downsample for efficient JSON transfer
        max_target_time_points = 700
        max_target_freq_points = 250 

        time_step = max(1, len(times) // max_target_time_points)
        freq_step = max(1, len(freqs) // max_target_freq_points)

        z = db_spectrogram[::freq_step, ::time_step]
        x = times[::time_step]
        y = freqs[::freq_step]

        return {
            "z": z.tolist(),
            "x": x.tolist(),
            "y": y.tolist(),
        }

    except Exception as e:
        print(f"Spectrogram generation error: {e}")
        return {"z": [], "x": [], "y": []}


def generate_freq_time(y, sr):

    try:
        # Fast pitch detection using YIN
        f0 = librosa.yin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        times = librosa.times_like(f0, sr=sr)
        f0_with_nulls = np.where(np.isnan(f0), None, f0)

        # Downsample to reduce JSON size (max ~2000 points)
        step = max(1, len(f0) // 2000)
        return {
            'time': times[::step].tolist(),
            'frequency': f0_with_nulls[::step].tolist()
        }
    except Exception:
        # Return empty data if pitch estimation fails
        return {'time': [], 'frequency': []}


def generate_waveform_chunk(y, sr, start_index, view_seconds=2.0):
   
    window_size = int(view_seconds * sr)
    end_index = start_index + window_size
    chunk = y[start_index:end_index]
    start_time = start_index / sr
    end_time = start_time + len(chunk) / sr
    time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()
    return {'time': time_axis, 'amplitude': chunk.tolist()}


# ===============================
# --- API Endpoints ---
# ===============================

class DroneDetectionView(APIView):
    
    parser_classes = (FormParser, MultiPartParser, JSONParser)
    
    def post(self, request):
        if model is None or feature_extractor is None:
            return Response(
                {'error': 'Model not loaded'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response(
                {'error': 'No audio file provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Save temporary file
            file_id = f"{uuid.uuid4()}{os.path.splitext(audio_file.name)[1]}"
            fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
            temp_filename = fs.save(file_id, audio_file)
            temp_filepath = fs.path(temp_filename)

            # Get original sample rate (works with MP3)
            try:
                original_sr = librosa.get_samplerate(temp_filepath)
            except Exception as e:
                print(f"Warning: Could not get original sample rate: {e}")
                original_sr = 16000  # Fallback

            # Load and resample audio (works with MP3)
            MAX_DURATION = 5  # seconds
            y, sr = load_audio_file(temp_filepath, sr=16000, mono=True, duration=MAX_DURATION)

            # Model inference (no gradients)
            inputs = feature_extractor(y, sampling_rate=sr, return_tensors="pt")
            with torch.no_grad():
                logits = model(**inputs).logits
            scores = torch.nn.functional.softmax(logits, dim=1).numpy()[0]
            predicted_class_id = int(np.argmax(scores))
            predicted_label = model.config.id2label[predicted_class_id]

            # Generate visualizations
            spectrogram_data = generate_spectrogram(y, sr)
            initial_waveform = generate_waveform_chunk(y, sr, start_index=0)
            freq_time_data = generate_freq_time(y, sr)

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
            return Response(
                {'error': 'No file_id provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Check if audio is already loaded in memory
            if file_id not in AUDIO_STORAGE:
                # Not in memory - must be a Drone file on disk
                fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
                if not fs.exists(file_id):
                    return Response(
                        {'error': 'File not found or expired'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                # Load ONCE from disk and cache in memory
                print(f"Loading {file_id} from disk into memory cache...")
                y, sr = load_audio_file(fs.path(file_id), sr=16000, mono=True, duration=None)
                AUDIO_STORAGE[file_id] = {'samples': y, 'sr': sr}

            # Handle chunk request using unified in-memory data
            return self._handle_chunk_request(file_id, position, view_seconds)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _handle_chunk_request(self, file_id, position, view_seconds):
        """
        Unified chunk handler for ANY audio stored in AUDIO_STORAGE.
        Works for both Doppler (already in memory) and Drone (loaded on demand).
        """
        stored = AUDIO_STORAGE[file_id]
        samples = stored['samples']
        sr = stored['sr']
        
        window_size = int(view_seconds * sr)
        step = int(window_size / 20)
        new_position = position + step

        if new_position + window_size > len(samples):
            return Response({'completed': True})

        end_index = new_position + window_size
        chunk = samples[new_position:end_index]
        start_time = new_position / sr
        end_time = start_time + len(chunk) / sr
        time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()

        return Response({
            'completed': False,
            'time': time_axis,
            'amplitude': chunk.tolist(),
            'new_position': new_position,
        })