from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
import numpy as np
import base64
import io
import os
import math
import tempfile
import uuid
from scipy.io import wavfile
from scipy.signal import resample
import wave

try:
    import librosa
except ImportError:
    librosa = None

EPS = 1e-8
SPEED_OF_SOUND = 343.0
AUDIO_STORAGE = {}

def parse_wav_from_data_uri(contents):
    header, b64 = contents.split(',', 1)
    audio_bytes = base64.b64decode(b64)
    bio = io.BytesIO(audio_bytes)
    sr, data = wavfile.read(bio)
    
    if data.dtype == np.int16:
        samples = data.astype(np.float32) / 32767.0
    else:
        samples = data.astype(np.float32)
        if samples.dtype.kind in 'iu':
            samples /= np.iinfo(data.dtype).max
    
    if samples.ndim == 2:
        samples = samples.mean(axis=1)
    
    duration = samples.shape[0] / sr
    return {'sr': int(sr), 'samples': samples, 'duration': float(duration)}

def write_wav_data_uri(samples, sr):
    max_a = np.max(np.abs(samples)) + EPS
    scaled = samples / max_a if max_a > 0 else samples
    int16 = (scaled * 32767).astype(np.int16)
    bio = io.BytesIO()
    wavfile.write(bio, sr, int16)
    return "data:audio/wav;base64," + base64.b64encode(bio.getvalue()).decode('ascii')

def audio_to_base64(signal, sample_rate):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        audio_data = np.clip(signal * 32767, -32768, 32767).astype(np.int16)
        wf.writeframes(audio_data.tobytes())
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def compute_spectrogram(samples, sr, n_fft=2048, hop_length=512, n_mels=128, fmax=8000, 
                       use_mel=True, max_time_points=None, max_freq_points=None):
    if not librosa:
        return None
    
    if use_mel:
        S = librosa.feature.melspectrogram(
            y=samples, 
            sr=sr, 
            n_mels=n_mels, 
            fmax=fmax,
            n_fft=n_fft,
            hop_length=hop_length
        )
        S_dB = librosa.power_to_db(S, ref=np.max)
        freqs = librosa.mel_frequencies(n_mels=n_mels, fmax=fmax)
    else:
        stft = librosa.stft(y=samples, n_fft=n_fft, hop_length=hop_length)
        magnitude = np.abs(stft)
        S_dB = librosa.amplitude_to_db(magnitude, ref=np.max)
        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
        
        freq_mask = freqs <= fmax
        freqs = freqs[freq_mask]
        S_dB = S_dB[freq_mask, :]
    
    S_dB = np.clip(S_dB, -80, 0)
    times = librosa.frames_to_time(np.arange(S_dB.shape[1]), sr=sr, hop_length=hop_length)
    
    if max_time_points and len(times) > max_time_points:
        time_step = max(1, len(times) // max_time_points)
        times = times[::time_step]
        S_dB = S_dB[:, ::time_step]
    
    if max_freq_points and len(freqs) > max_freq_points:
        freq_step = max(1, len(freqs) // max_freq_points)
        freqs = freqs[::freq_step]
        S_dB = S_dB[::freq_step, :]
    
    return {
        'z': S_dB.tolist(),
        'x': times.tolist(),
        'y': freqs.tolist()
    }

def compute_full_analysis(samples, sr):
    duration = len(samples) / sr
    time = np.linspace(0, duration, len(samples))
    
    initial_waveform = {
        'time': time.tolist(),
        'amplitude': samples.tolist(),
        'sr': int(sr)
    }
    
    spectrogram = compute_spectrogram(samples, sr)
    
    return initial_waveform, spectrogram

def make_waveform(store, play_pos=None):
    sr, samples, duration = store['sr'], np.array(store['samples']), store['duration']
    max_preview_points, window_width = 4000, 3.0
    total_points = len(samples)
    
    step = math.ceil(total_points / max_preview_points) if total_points > max_preview_points else 1
    preview = samples[::step].tolist()
    t_preview = np.linspace(0, duration, len(samples[::step])).tolist()
    
    center = float(play_pos) if play_pos else 0.0
    start_t = max(0.0, center - window_width * 0.2)
    end_t = min(duration, center + window_width * 0.8)
    start_idx, end_idx = int(start_t * sr), int(end_t * sr)
    
    if end_idx <= start_idx:
        t_window, y_window = [], []
    else:
        t_window = np.linspace(start_t, end_t, end_idx - start_idx).tolist()
        y_window = samples[start_idx:end_idx].tolist()
    
    return {
        'preview': {'t': t_preview, 'y': preview},
        'window': {'t': t_window, 'y': y_window, 'range': [start_t, end_t]},
    }

def generate_waveform_chunk(samples, sr, start_index, view_seconds=2.0):
    if not isinstance(samples, np.ndarray):
        samples = np.array(samples)
    
    window_size = int(view_seconds * sr)
    end_index = start_index + window_size
    chunk = samples[start_index:end_index]
    start_time = start_index / sr
    end_time = start_time + len(chunk) / sr
    time_axis = np.linspace(start_time, end_time, len(chunk)).tolist()
    return {'time': time_axis, 'amplitude': chunk.tolist()}

def get_next_chunk_position(current_position, view_seconds, sr):
    window_size = int(view_seconds * sr)
    step = int(window_size / 20)
    return current_position + step

def is_chunk_complete(position, total_samples, view_seconds, sr):
    window_size = int(view_seconds * sr)
    return position + window_size > total_samples

def store_audio(samples, sr):
    file_id = str(uuid.uuid4())
    AUDIO_STORAGE[file_id] = {
        'samples': samples if isinstance(samples, np.ndarray) else np.array(samples),
        'sr': sr,
        'duration': len(samples) / sr
    }
    return file_id

def get_audio(file_id):
    return AUDIO_STORAGE.get(file_id)

def clear_audio(file_id):
    if file_id in AUDIO_STORAGE:
        del AUDIO_STORAGE[file_id]

def load_audio_file(file_path, sr=None, mono=True, duration=None):
    if not librosa:
        raise ImportError("librosa is required for loading audio files")
    return librosa.load(file_path, sr=sr, mono=mono, duration=duration)

def get_original_sample_rate(file_path):
    if not librosa:
        return 16000
    try:
        return librosa.get_samplerate(file_path)
    except Exception as e:
        print(f"Warning: Could not get original sample rate: {e}")
        return 16000

def compute_frequency_over_time(samples, sr, max_points=2000):
    if not librosa:
        return {'time': [], 'frequency': []}
    try:
        f0 = librosa.yin(
            samples, 
            fmin=librosa.note_to_hz('C2'), 
            fmax=librosa.note_to_hz('C7')
        )
        times = librosa.times_like(f0, sr=sr)
        f0_with_nulls = np.where(np.isnan(f0), None, f0)
        step = max(1, len(f0) // max_points)
        return {
            'time': times[::step].tolist(),
            'frequency': f0_with_nulls[::step].tolist()
        }
    except Exception as e:
        print(f"Frequency estimation error: {e}")
        return {'time': [], 'frequency': []}

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def downsample_audio(request):
    try:
        file = request.FILES.get('file')
        new_rate_str = request.data.get('new_rate', '0')
       
        if not file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
       
        file_ext = file.name.lower().split('.')[-1]
        if file_ext not in ['wav', 'mp3']:
            return Response({'error': 'Only WAV and MP3 files are supported.'},
                          status=status.HTTP_400_BAD_REQUEST)
       
        try:
            new_rate = int(new_rate_str)
        except ValueError:
            return Response({'error': 'Invalid sample rate'}, status=status.HTTP_400_BAD_REQUEST)
        
        file.seek(0)
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp_file:
            tmp_file.write(file.read())
            tmp_path = tmp_file.name
       
        try:
            if file_ext == 'wav':
                rate, samples = wavfile.read(tmp_path)
                if len(samples.shape) > 1:
                    samples = samples[:, 0]
                samples = samples.astype(float) / 32768
            else:
                samples, rate = librosa.load(tmp_path, sr=None, mono=True)
           
            if new_rate <= 0:
                new_rate = rate // 2
            if new_rate >= rate:
                new_rate = rate
            
            num_samples = int(len(samples) * new_rate / rate)
            new_signal = resample(samples, num_samples)
            
            original_b64 = audio_to_base64(samples, rate)
            down_b64 = audio_to_base64(new_signal, new_rate)
            
            return Response({
                'original_rate': int(rate),
                'new_rate': new_rate,
                'original_audio': f"data:audio/wav;base64,{original_b64}",
                'downsampled_audio': f"data:audio/wav;base64,{down_b64}",
            })
       
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
           
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)