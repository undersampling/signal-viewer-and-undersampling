# #
# #  NEW FILE: audio_utils.py
# #  (Contains all shared code)
# #
# import librosa
# import numpy as np
# import os
# import uuid
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
# from django.conf import settings
# from django.core.files.storage import FileSystemStorage

# # 1. Global in-memory cache for ALL audio
# AUDIO_STORAGE = {}

# # 2. Shared helper function for Freq/Time
# def _generate_freq_time(y, sr):
#     try:
#         f0 = librosa.yin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
#         times = librosa.times_like(f0, sr=sr)
#         f0_with_nulls = np.where(np.isnan(f0), None, f0)
#         step = max(1, len(f0) // 2000)
#         return {
#             'time': times[::step].tolist(),
#             'frequency': f0_with_nulls[::step].tolist()
#         }
#     except Exception:
#         return {'time': [], 'frequency': []}

# # 3. Shared helper function for Spectrogram (the CORRECT one)
# def _generate_spectrogram(y, sr):
#     try:
#         n_fft = 1024
#         hop_length = 256
#         win_length = 1024

#         stft = librosa.stft(y, n_fft=n_fft, hop_length=hop_length, win_length=win_length)
#         magnitude = np.abs(stft)
#         db_spectrogram = librosa.amplitude_to_db(magnitude, ref=np.max)

#         freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
#         times = librosa.frames_to_time(np.arange(db_spectrogram.shape[1]), sr=sr, hop_length=hop_length)

#         max_freq = 44000
#         freq_mask = freqs <= max_freq
#         freqs = freqs[freq_mask]
#         db_spectrogram = db_spectrogram[freq_mask, :]
#         db_spectrogram = np.clip(db_spectrogram, -80, 0)

#         max_target_time_points = 700
#         max_target_freq_points = 250
#         time_step = max(1, len(times) // max_target_time_points)
#         freq_step = max(1, len(freqs) // max_target_freq_points)

#         z = db_spectrogram[::freq_step, ::time_step]
#         x = times[::time_step]
#         y = freqs[::freq_step] 

#         return {
#             "z": z.tolist(),
#             "x": x.tolist(),
#             "y": y.tolist(),
#         }
#     except Exception as e:
#         print(f"Spectrogram generation error: {e}")
#         return {"z": [], "x": [], "y": []}

# # 4. Shared helper function for Waveform
# def _generate_waveform_chunk(y, sr, start_index, view_seconds=2.0):
#     window_size = int(view_seconds * sr)
#     end_index = start_index + window_size
#     chunk = y[start_index:end_index]
#     start_time = start_index / sr
#     end_time = start_time + len(chunk) / sr
#     time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()
#     return {'time': time_axis, 'amplitude': chunk.tolist()}

# # 5. Shared WaveformChunkView class
# class WaveformChunkView(APIView):
#     parser_classes = (FormParser, MultiPartParser, JSONParser)

#     def post(self, request):
#         file_id = request.data.get('file_id')
#         position = int(request.data.get('position', 0))
#         view_seconds = 2.0

#         if not file_id:
#             return Response({'error': 'No file_id provided'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             if file_id not in AUDIO_STORAGE:
#                 fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
#                 if not fs.exists(file_id):
#                     return Response({'error': 'File not found or expired'}, status=status.HTTP_404_NOT_FOUND)
                
#                 print(f"Loading {file_id} from disk into memory cache...")
#                 y, sr = librosa.load(fs.path(file_id), sr=16000, mono=True, duration=None)
#                 AUDIO_STORAGE[file_id] = {'samples': y, 'sr': sr}

#             return self._handle_chunk_request(file_id, position, view_seconds)

#         except Exception as e:
#             import traceback
#             traceback.print_exc()
#             return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#     def _handle_chunk_request(self, file_id, position, view_seconds):
#         stored = AUDIO_STORAGE[file_id]
#         samples = stored['samples']
#         sr = stored['sr']
        
#         window_size = int(view_seconds * sr)
#         step = int(window_size / 20)
#         new_position = position + step

#         if new_position + window_size > len(samples):
#             return Response({'completed': True})

#         end_index = new_position + window_size
#         chunk = samples[new_position:end_index]
#         start_time = new_position / sr
#         end_time = start_time + len(chunk) / sr
#         time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()

#         return Response({
#             'completed': False,
#             'time': time_axis,
#             'amplitude': chunk.tolist(),
#             'new_position': new_position,
#         })