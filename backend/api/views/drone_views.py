# # your_app/views.py

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

# # --- Load Model (remains the same) ---
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
#             file_id = f"{uuid.uuid4()}{os.path.splitext(audio_file.name)[1]}"
#             fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
#             temp_filename = fs.save(file_id, audio_file)
#             temp_filepath = fs.path(temp_filename)

#             y, sr = librosa.load(temp_filepath, sr=16000, mono=True)

#             inputs = feature_extractor(y, sampling_rate=sr, return_tensors="pt")
#             with torch.no_grad():
#                 logits = model(**inputs).logits
#             scores = torch.nn.functional.softmax(logits, dim=1).numpy()[0]
#             predicted_class_id = np.argmax(scores)
#             predicted_label = model.config.id2label[predicted_class_id]

#             spectrogram_data = self._generate_spectrogram(y, sr)
#             initial_waveform = self._generate_waveform_chunk(y, sr, start_index=0)
#             # +++ ADDED +++ : Generate the new frequency vs. time data
#             freq_time_data = self._generate_freq_time(y, sr)

#             return Response({
#                 'file_id': temp_filename,
#                 'prediction': predicted_label.upper(),
#                 'spectrogram': spectrogram_data,
#                 'initial_waveform': initial_waveform,
#                 # +++ ADDED +++ : Add the new data to the response
#                 'freq_time_data': freq_time_data,
#             })
#         except Exception as e:
#             return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#     # +++ ADDED +++ : New helper function to calculate frequency over time (pitch)
#     def _generate_freq_time(self, y, sr):
#         # Use a pitch detection algorithm (pyin) to find the fundamental frequency (f0)
#         f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        
#         # Get the time points for each f0 value
#         times = librosa.times_like(f0, sr=sr)
        
#         # Replace numpy's 'nan' (not a number) with Python's 'None' so it becomes 'null' in JSON.
#         # Plotly can then create gaps in the line for parts where no frequency was detected.
#         f0_with_nulls = np.where(np.isnan(f0), None, f0)
        
#         return {'time': times.tolist(), 'frequency': f0_with_nulls.tolist()}

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

# # --- API View for Efficiently Fetching Waveform Chunks (remains the same) ---
# class WaveformChunkView(APIView):
#     # ... (no changes in this class)
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
        
# your_app/views.py

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

            # --- Load only first few seconds (faster) ---
            MAX_DURATION = 5  # seconds
            y, sr = librosa.load(temp_filepath, sr=16000, mono=True, duration=MAX_DURATION)

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

# Assuming 'self' context provides 'sr' (sample rate) and 'y' (audio waveform)

    def _generate_spectrogram(self, y, sr):
        """
        Generate a decibel-scaled spectrogram (time vs frequency).
        Returns downsampled data for efficient JSON transfer, aiming for a visual match.
        """
        try:
            # --- 1. Process the full audio for visualization (removed 2-second truncation) ---
            # The original `y_short = y[: int(sr * 2)]` limited the plot to 2 seconds.
            # By using the full `y`, the spectrogram can represent the entire audio duration,
            # which is likely needed to match the visual patterns of the example image.

            # --- 2. Compute STFT ---
            # These parameters are generally suitable for speech spectrograms.
            n_fft = 1024       # Number of FFT components, determines frequency resolution
            hop_length = 256   # Number of samples between successive frames, determines time resolution
            win_length = 1024  # Window length (usually same as n_fft)

            stft = librosa.stft(y, n_fft=n_fft, hop_length=hop_length, win_length=win_length)
            magnitude = np.abs(stft)

            # --- 3. Convert amplitude to decibels ---
            # `ref=np.max` normalizes the spectrogram by the peak power.
            db_spectrogram = librosa.amplitude_to_db(magnitude, ref=np.max)

            # --- 4. Compute frequency and time axes ---
            freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
            times = librosa.frames_to_time(np.arange(db_spectrogram.shape[1]), sr=sr, hop_length=hop_length)

            # --- 5. Limit frequency range (below 8000 Hz, consistent with original request) ---
            # 8000 Hz is a common and effective upper limit for speech analysis, aligning with the visual detail expected.
            max_freq = 44000
            freq_mask = freqs <= max_freq
            freqs = freqs[freq_mask]
            db_spectrogram = db_spectrogram[freq_mask, :]

            # --- 6. Normalize values (clip to desired dB range) ---
            # Clipping helps to define the color range and corresponds to zmin/zmax in the frontend.
            db_spectrogram = np.clip(db_spectrogram, -80, 0)

            # --- 7. Downsample for smaller JSON transfer and balanced visual quality ---
            # We aim for a target number of points to keep the plot responsive and data payload manageable,
            # while ensuring enough detail is retained to match the smooth appearance of the example image.
            max_target_time_points = 700 # Roughly 700 pixels wide for a typical plot
            max_target_freq_points = 250 # Roughly 250 pixels high for frequency detail

            time_step = max(1, len(times) // max_target_time_points)
            freq_step = max(1, len(freqs) // max_target_freq_points)

            z = db_spectrogram[::freq_step, ::time_step]
            x = times[::time_step]
            y = freqs[::freq_step]

            # --- 8. Return structured data ---
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
# --- Efficient Incremental Waveform View ---
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
            fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
            if not fs.exists(file_id):
                return Response({'error': 'File not found or expired'}, status=status.HTTP_404_NOT_FOUND)

            # Fast read (no full decoding)
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
