# drone_views.py
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

# ===============================
# --- Global In-Memory Cache ---
# ===============================
try:
    from .doppler_views import AUDIO_STORAGE
except ImportError:
    AUDIO_STORAGE = {}

# ===============================
# --- Load Model Once Globally ---
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
# --- Drone Detection Endpoint ---
# ===============================
class DroneDetectionView(APIView):
    parser_classes = (FormParser, MultiPartParser, JSONParser)
    def post(self, request):
        """Handle audio upload and run classification + visualization."""
        if model is None or feature_extractor is None:
            return Response({'error': 'Model not loaded'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # --- Save temporary file ---
            file_id = f"{uuid.uuid4()}{os.path.splitext(audio_file.name)[1]}"
            fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
            temp_filename = fs.save(file_id, audio_file)
            temp_filepath = fs.path(temp_filename)

            # === START: MP3 FIX (This is the updated block) ===

            # 1. Get the original sample rate robustly (works for MP3s)
            try:
                original_sr = librosa.get_samplerate(temp_filepath)
            except Exception as e:
                print(f"Warning: Could not get original sample rate: {e}")
                original_sr = 16000 # Fallback

            # 2. Load and resample audio robustly (works for MP3s)
            MAX_DURATION = 5  # seconds
            y, sr = librosa.load(temp_filepath, sr=16000, mono=True, duration=MAX_DURATION)
            
            # === END: MP3 FIX ===

            # --- Model Inference (no gradients) ---
            inputs = feature_extractor(y, sampling_rate=sr, return_tensors="pt")
            with torch.no_grad():
                logits = model(**inputs).logits
            scores = torch.nn.functional.softmax(logits, dim=1).numpy()[0]
            predicted_class_id = int(np.argmax(scores))
            predicted_label = model.config.id2label[predicted_class_id]

            # --- Visual Data (lightweight versions) ---
            spectrogram_data = self._generate_spectrogram(y, sr)
            initial_waveform = self._generate_waveform_chunk(y, sr, start_index=0)
            freq_time_data = self._generate_freq_time(y, sr)

            return Response({
                'file_id': temp_filename,
                'prediction': predicted_label.upper(),
                'spectrogram': spectrogram_data,
                'initial_waveform': initial_waveform,
                'freq_time_data': freq_time_data,
                'original_rate': int(original_sr), # Now we can send this
            })

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # =======================================
    # --- Helper: Fast Frequency Estimation ---
    # =======================================
    def _generate_freq_time(self, y, sr):
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

    # =======================================
    # --- Helper: Lightweight Spectrogram ---
    # =======================================
    def _generate_spectrogram(self, y, sr):
        """
        Generate a decibel-scaled spectrogram (time vs frequency).
        Returns downsampled data for efficient JSON transfer, aiming for a visual match.
        """
        try:
            n_fft = 1024 
            hop_length = 256
            win_length = 1024 

            stft = librosa.stft(y, n_fft=n_fft, hop_length=hop_length, win_length=win_length)
            magnitude = np.abs(stft)

            db_spectrogram = librosa.amplitude_to_db(magnitude, ref=np.max)

            freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
            times = librosa.frames_to_time(np.arange(db_spectrogram.shape[1]), sr=sr, hop_length=hop_length)

            max_freq = 44000
            freq_mask = freqs <= max_freq
            freqs = freqs[freq_mask]
            db_spectrogram = db_spectrogram[freq_mask, :]

            db_spectrogram = np.clip(db_spectrogram, -80, 0)

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


    # =======================================
    # --- Helper: Waveform Chunk (Preview) ---
    # =======================================
    def _generate_waveform_chunk(self, y, sr, start_index, view_seconds=2.0):
        window_size = int(view_seconds * sr)
        end_index = start_index + window_size
        chunk = y[start_index:end_index]
        start_time = start_index / sr
        end_time = start_time + len(chunk) / sr
        time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()
        return {'time': time_axis, 'amplitude': chunk.tolist()}


# ===========================================
# --- UNIFIED Waveform Chunk View ---
# (This whole class is updated for caching)
# ===========================================
class WaveformChunkView(APIView):
    parser_classes = (FormParser, MultiPartParser, JSONParser)

    def post(self, request):
        file_id = request.data.get('file_id')
        position = int(request.data.get('position', 0))
        view_seconds = 2.0

        if not file_id:
            return Response({'error': 'No file_id provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # --- 1. Check if audio is already loaded in memory (Doppler or cached Drone) ---
            if file_id not in AUDIO_STORAGE:
                
                # --- 2. If not, it must be a Drone file on disk. Load it. ---
                fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
                if not fs.exists(file_id):
                    return Response({'error': 'File not found or expired'}, status=status.HTTP_404_NOT_FOUND)
                
                # --- 3. Load ONCE from disk and store in memory cache ---
                print(f"Loading {file_id} from disk into memory cache...")
                # We load the *full file* here (duration=None) for scrolling
                y, sr = librosa.load(fs.path(file_id), sr=16000, mono=True, duration=None)
                AUDIO_STORAGE[file_id] = {'samples': y, 'sr': sr}

            # --- 4. Now, handle the request using the unified in-memory data ---
            return self._handle_chunk_request(file_id, position, view_seconds)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _handle_chunk_request(self, file_id, position, view_seconds):
        """
        Handles chunking for ANY audio stored in AUDIO_STORAGE.
        This single function now replaces both _handle_memory_audio and _handle_file_audio.
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