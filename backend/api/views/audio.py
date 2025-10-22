# audio.py
"""
General audio utilities and common functions used across different audio processing views.
Includes audio I/O, conversion, visualization helpers, and storage management.
"""

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

# ===============================
# --- Global Constants ---
# ===============================
EPS = 1e-8
SPEED_OF_SOUND = 343.0

# ===============================
# --- Global In-Memory Storage ---
# ===============================
AUDIO_STORAGE = {}

# ===============================
# --- Audio I/O Functions ---
# ===============================

def parse_wav_from_data_uri(contents):
    """
    Parse a data URI containing WAV audio into samples and metadata.
    
    Args:
        contents: Data URI string (e.g., "data:audio/wav;base64,...")
    
    Returns:
        dict: {'sr': sample_rate, 'samples': np.array, 'duration': float}
    """
    header, b64 = contents.split(',', 1)
    audio_bytes = base64.b64decode(b64)
    bio = io.BytesIO(audio_bytes)
    sr, data = wavfile.read(bio)
    
    # Convert to float32 normalized to [-1, 1]
    if data.dtype == np.int16:
        samples = data.astype(np.float32) / 32767.0
    else:
        samples = data.astype(np.float32)
        if samples.dtype.kind in 'iu':
            samples /= np.iinfo(data.dtype).max
    
    # Convert stereo to mono
    if samples.ndim == 2:
        samples = samples.mean(axis=1)
    
    duration = samples.shape[0] / sr
    return {'sr': int(sr), 'samples': samples, 'duration': float(duration)}


def write_wav_data_uri(samples, sr):
    """
    Convert audio samples to a data URI string.
    
    Args:
        samples: np.array of audio samples (float32, normalized)
        sr: Sample rate
    
    Returns:
        str: Data URI string
    """
    max_a = np.max(np.abs(samples)) + EPS
    scaled = samples / max_a if max_a > 0 else samples
    int16 = (scaled * 32767).astype(np.int16)
    bio = io.BytesIO()
    wavfile.write(bio, sr, int16)
    return "data:audio/wav;base64," + base64.b64encode(bio.getvalue()).decode('ascii')


def audio_to_base64(signal, sample_rate):
    """
    Convert audio signal to base64-encoded WAV format.
    
    Args:
        signal: np.array of audio samples (float, normalized)
        sample_rate: Sample rate
    
    Returns:
        str: Base64-encoded audio data
    """
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        audio_data = np.clip(signal * 32767, -32768, 32767).astype(np.int16)
        wf.writeframes(audio_data.tobytes())
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


# ===============================
# --- Visualization Functions ---
# ===============================

def compute_spectrogram(samples, sr, n_fft=2048, hop_length=512, n_mels=128, fmax=8000):
    """
    Compute mel-spectrogram for audio visualization.
    
    Args:
        samples: Audio samples
        sr: Sample rate
        n_fft: FFT window size
        hop_length: Number of samples between successive frames
        n_mels: Number of mel bands
        fmax: Maximum frequency
    
    Returns:
        dict: {'z': spectrogram_db, 'x': times, 'y': frequencies} or None
    """
    if not librosa:
        return None
    
    S = librosa.feature.melspectrogram(
        y=samples, 
        sr=sr, 
        n_mels=n_mels, 
        fmax=fmax,
        n_fft=n_fft,
        hop_length=hop_length
    )
    S_dB = librosa.power_to_db(S, ref=np.max)
    S_dB = np.clip(S_dB, -80, 0)
    
    times = librosa.frames_to_time(np.arange(S_dB.shape[1]), sr=sr, hop_length=hop_length)
    freqs = librosa.mel_frequencies(n_mels=n_mels, fmax=fmax)
    
    return {
        'z': S_dB.tolist(),
        'x': times.tolist(),
        'y': freqs.tolist()
    }


def compute_full_analysis(samples, sr):
    """
    Compute complete waveform and spectrogram data for DisplayAudio component.
    
    Args:
        samples: Audio samples
        sr: Sample rate
    
    Returns:
        tuple: (initial_waveform, spectrogram)
    """
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
    """
    Generate waveform visualization data with preview and window views.
    
    Args:
        store: Dict containing 'sr', 'samples', 'duration'
        play_pos: Current playback position (optional)
    
    Returns:
        dict: {'preview': {...}, 'window': {...}}
    """
    sr, samples, duration = store['sr'], np.array(store['samples']), store['duration']
    max_preview_points, window_width = 4000, 3.0
    total_points = len(samples)
    
    # Generate preview (downsampled full view)
    step = math.ceil(total_points / max_preview_points) if total_points > max_preview_points else 1
    preview = samples[::step].tolist()
    t_preview = np.linspace(0, duration, len(samples[::step])).tolist()
    
    # Generate window (zoomed view around current position)
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


# ===============================
# --- Storage Management ---
# ===============================

def store_audio(samples, sr):
    """
    Store audio in memory and return a file ID for later retrieval.
    
    Args:
        samples: Audio samples
        sr: Sample rate
    
    Returns:
        str: Unique file ID
    """
    file_id = str(uuid.uuid4())
    AUDIO_STORAGE[file_id] = {
        'samples': samples if isinstance(samples, np.ndarray) else np.array(samples),
        'sr': sr,
        'duration': len(samples) / sr
    }
    return file_id


def get_audio(file_id):
    """
    Retrieve audio from memory storage.
    
    Args:
        file_id: File ID
    
    Returns:
        dict: {'samples': np.array, 'sr': int, 'duration': float} or None
    """
    return AUDIO_STORAGE.get(file_id)


def clear_audio(file_id):
    """Remove audio from memory storage."""
    if file_id in AUDIO_STORAGE:
        del AUDIO_STORAGE[file_id]


# ===============================
# --- Load Audio from Files ---
# ===============================

def load_audio_file(file_path, sr=None, mono=True, duration=None):
    """
    Load audio from a file (supports WAV, MP3, etc.).
    
    Args:
        file_path: Path to audio file
        sr: Target sample rate (None = keep original)
        mono: Convert to mono
        duration: Maximum duration to load
    
    Returns:
        tuple: (samples, sample_rate)
    """
    if not librosa:
        raise ImportError("librosa is required for loading audio files")
    
    return librosa.load(file_path, sr=sr, mono=mono, duration=duration)


# ===============================
# --- API Endpoint: Downsample ---
# ===============================

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def downsample_audio(request):
    """
    API endpoint to downsample audio files.
    Supports WAV and MP3 formats.
    """
    try:
        file = request.FILES.get('file')
        new_rate_str = request.data.get('new_rate', '0')
       
        if not file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
       
        file_ext = file.name.lower().split('.')[-1]
        if file_ext not in ['wav', 'mp3']:
            return Response(
                {'error': 'Only WAV and MP3 files are supported.'},
                status=status.HTTP_400_BAD_REQUEST
            )
       
        try:
            new_rate = int(new_rate_str)
        except ValueError:
            return Response({'error': 'Invalid sample rate'}, status=status.HTTP_400_BAD_REQUEST)
        
        file.seek(0)
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp_file:
            tmp_file.write(file.read())
            tmp_path = tmp_file.name
       
        try:
            # Load audio
            if file_ext == 'wav':
                rate, samples = wavfile.read(tmp_path)
                if len(samples.shape) > 1:
                    samples = samples[:, 0]  # Convert to mono
                samples = samples.astype(float) / 32768
            else:
                samples, rate = load_audio_file(tmp_path, sr=None, mono=True)
           
            if new_rate <= 0:
                new_rate = rate // 2
            if new_rate >= rate:
                new_rate = rate
            
            # Resample
            num_samples = int(len(samples) * new_rate / rate)
            new_signal = resample(samples, num_samples)
            
            # Convert to base64
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