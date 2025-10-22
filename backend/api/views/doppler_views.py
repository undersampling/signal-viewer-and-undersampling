# doppler_views.py
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
import numpy as np
import base64
import io
import os
from django.conf import settings
import math
from scipy.io import wavfile
from scipy.signal import resample
import wave
import uuid

try:
    import tensorflow as tf
    import librosa
except Exception:
    tf = None
    librosa = None


SPEED_OF_SOUND = 343.0
EPS = 1e-8
SAMPLE_RATE = 16000

MODEL_PATH="D:/DSP_Tasks/signal-viewer-and-undersampling/backend/models/doppler_regressor_cnn_2.keras"
CONFIG_PATH="D:/DSP_Tasks/signal-viewer-and-undersampling/backend/models/spectrogram_width_2.npy"

# Ensure globals are defined so _lazy_load_model can reference them safely
REG_MODEL = None
SPECTROGRAM_WIDTH = None
MODEL_LOAD_ERROR = None

# Store audio data temporarily for chunk streaming
AUDIO_STORAGE = {}

def _lazy_load_model():
    global REG_MODEL, SPECTROGRAM_WIDTH, MODEL_LOAD_ERROR
    if REG_MODEL is not None:
        return
    if not tf or not librosa:
        return
    if MODEL_PATH and CONFIG_PATH and os.path.exists(MODEL_PATH) and os.path.exists(CONFIG_PATH):
        try:
            REG_MODEL = tf.keras.models.load_model(MODEL_PATH, compile=False)
            SPECTROGRAM_WIDTH = int(np.load(CONFIG_PATH))
            MODEL_LOAD_ERROR = None
        except Exception as e:
            REG_MODEL = None
            SPECTROGRAM_WIDTH = None
            MODEL_LOAD_ERROR = str(e)


def _parse_wav_from_data_uri(contents):
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


def _write_wav_data_uri(samples, sr):
    max_a = np.max(np.abs(samples)) + EPS
    scaled = samples / max_a if max_a > 0 else samples
    int16 = (scaled * 32767).astype(np.int16)
    bio = io.BytesIO()
    wavfile.write(bio, sr, int16)
    return "data:audio/wav;base64," + base64.b64encode(bio.getvalue()).decode('ascii')


def _apply_doppler_effect(audio, sr, v_start, v_end):
    n_samples = len(audio)
    if n_samples == 0:
        return audio.astype(np.float32)
    v = np.linspace(v_start, v_end, n_samples)
    doppler_factor = SPEED_OF_SOUND / (SPEED_OF_SOUND - v + EPS)
    indices = np.cumsum(doppler_factor)
    if indices[-1] - indices[0] == 0:
        indices_normalized = np.linspace(0, n_samples - 1, n_samples)
    else:
        indices_normalized = (indices - indices[0]) / (indices[-1] - indices[0]) * (n_samples - 1)
    doppler_audio = np.interp(indices_normalized, np.arange(n_samples), audio)
    maxv = np.max(np.abs(doppler_audio)) + EPS
    doppler_audio = doppler_audio / maxv
    return doppler_audio.astype(np.float32)


def _linear_envelope(length, start_level=0.0, end_level=1.0):
    if length <= 0:
        return np.array([], dtype=np.float32)
    return np.linspace(start_level, end_level, length, dtype=np.float32)


def _apply_amplitude_envelope(audio, envelope):
    if len(audio) != len(envelope):
        envelope = np.interp(np.linspace(0, 1, len(audio)), np.linspace(0, 1, len(envelope)), envelope)
    return audio * envelope


def _compute_full_analysis(samples, sr):
    """Compute waveform and spectrogram data for DisplayAudio component"""
    duration = len(samples) / sr
    time = np.linspace(0, duration, len(samples))
    
    # Initial waveform
    initial_waveform = {
        'time': time.tolist(),
        'amplitude': samples.tolist(),
        'sr': int(sr)
    }
    
    # Compute spectrogram
    if librosa:
        n_fft = 2048
        hop_length = 512
        S = librosa.feature.melspectrogram(
            y=samples, 
            sr=sr, 
            n_mels=128, 
            fmax=8000,
            n_fft=n_fft,
            hop_length=hop_length
        )
        S_dB = librosa.power_to_db(S, ref=np.max)
        S_dB = np.clip(S_dB, -80, 0)
        
        # Time and frequency axes
        times = librosa.frames_to_time(np.arange(S_dB.shape[1]), sr=sr, hop_length=hop_length)
        freqs = librosa.mel_frequencies(n_mels=128, fmax=8000)
        
        spectrogram = {
            'z': S_dB.tolist(),
            'x': times.tolist(),
            'y': freqs.tolist()
        }
    else:
        spectrogram = None
    
    return initial_waveform, spectrogram


def _make_waveform(store, play_pos=None):
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


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def upload_doppler(request):
    try:
        # Accept either multipart file 'audio' or JSON data URI 'contents'
        if 'audio' in request.FILES:
            audio_file = request.FILES['audio']
            data = audio_file.read()
            src = "data:audio/wav;base64," + base64.b64encode(data).decode('ascii')
        else:
            contents = request.data.get('contents')
            if not contents:
                return Response({'error': 'No audio provided'}, status=status.HTTP_400_BAD_REQUEST)
            src = contents
        store = _parse_wav_from_data_uri(src)
        store['samples'] = store['samples'].tolist()
        fig = _make_waveform(store)
        return Response({'store': store, 'src': src, 'waveform': fig})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@parser_classes([JSONParser])
def generate_doppler(request):
    try:
        contents = request.data.get('contents')
        v_start = float(request.data.get('v_start'))
        v_end = float(request.data.get('v_end'))
        f_source = float(request.data.get('f_source')) if request.data.get('f_source') is not None else None
        if not contents:
            return Response({'error': 'contents (data URI) is required'}, status=status.HTTP_400_BAD_REQUEST)
        parsed = _parse_wav_from_data_uri(contents)
        sr = parsed['sr']
        samples = np.array(parsed['samples'], dtype=np.float32)
        doppler_out = _apply_doppler_effect(samples, sr, v_start, v_end)
        
        # envelope
        if v_end > v_start:
            env = _linear_envelope(len(doppler_out), start_level=0.2, end_level=1.0)
        else:
            env = _linear_envelope(len(doppler_out), start_level=1.0, end_level=0.2)
        doppler_out = _apply_amplitude_envelope(doppler_out, env)
        
        src = _write_wav_data_uri(doppler_out, sr)
        
        # Generate file ID and store data for chunk streaming
        file_id = str(uuid.uuid4())
        AUDIO_STORAGE[file_id] = {
            'samples': doppler_out,
            'sr': sr,
            'duration': len(doppler_out) / sr
        }
        
        # Compute full analysis for DisplayAudio
        initial_waveform, spectrogram = _compute_full_analysis(doppler_out, sr)
        
        status_msg = f"Doppler applied across full clip: v_i={v_start} m/s → v_f={v_end} m/s"
        freq_msg = ''
        if f_source is not None:
            f_obs_start = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND - v_start + EPS))
            f_obs_end = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND - v_end + EPS))
            freq_msg = f"Observed Frequency: start={f_obs_start:.1f} Hz → end={f_obs_end:.1f} Hz"
        
        # DEBUG: Print to console to verify data
        print(f"DEBUG - Spectrogram data exists: {spectrogram is not None}")
        if spectrogram:
            print(f"DEBUG - Spectrogram z shape: {len(spectrogram['z'])}x{len(spectrogram['z'][0]) if len(spectrogram['z']) > 0 else 0}")
            print(f"DEBUG - Spectrogram x length: {len(spectrogram['x'])}")
            print(f"DEBUG - Spectrogram y length: {len(spectrogram['y'])}")
        
        # Return data in the format expected by DisplayAudio
        return Response({
            'src': src,
            'initial_waveform': initial_waveform,
            'spectrogram': spectrogram,
            'file_id': file_id,
            'status': status_msg,
            'observed': freq_msg
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@parser_classes([JSONParser])
def simulate_passing(request):
    try:
        contents = request.data.get('contents')
        v_start = float(request.data.get('v_start'))
        v_end = float(request.data.get('v_end'))
        f_source = float(request.data.get('f_source')) if request.data.get('f_source') is not None else None
        if not contents:
            return Response({'error': 'contents (data URI) is required'}, status=status.HTTP_400_BAD_REQUEST)
        parsed = _parse_wav_from_data_uri(contents)
        sr = parsed['sr']
        samples = np.array(parsed['samples'], dtype=np.float32)
        n = len(samples)
        if n == 0:
            return Response({'error': 'audio has no samples'}, status=status.HTTP_400_BAD_REQUEST)
        mid = n // 2
        segA = samples[:mid].astype(np.float32)
        segB = samples[mid:].astype(np.float32)
        approach = _apply_doppler_effect(segA, sr, v_start, v_end)
        if v_end > v_start:
            envA = _linear_envelope(len(approach), start_level=0.2, end_level=1.0)
        else:
            envA = _linear_envelope(len(approach), start_level=1.0, end_level=0.2)
        approach = _apply_amplitude_envelope(approach, envA)
        v_end_val = v_end
        if v_end_val >= 0:
            v_rec_start = v_end_val
            v_rec_end = v_end_val + 5.0
        else:
            v_rec_start = abs(v_end_val)
            v_rec_end = abs(v_end_val) + 5.0
        recede = _apply_doppler_effect(segB, sr, v_rec_start, v_rec_end)
        envB = _linear_envelope(len(recede), start_level=1.0, end_level=0.12)
        recede = _apply_amplitude_envelope(recede, envB)
        simulation = np.concatenate([approach, recede]).astype(np.float32)
        max_val = np.max(np.abs(simulation)) + EPS
        simulation = simulation / max_val if max_val > 0 else simulation
        src = _write_wav_data_uri(simulation, sr)
        store = {'sr': sr, 'samples': simulation.tolist(), 'duration': len(simulation) / sr}
        fig = _make_waveform(store)
        
        # Generate file ID and store data for chunk streaming
        file_id = str(uuid.uuid4())
        AUDIO_STORAGE[file_id] = {
            'samples': simulation,
            'sr': sr,
            'duration': len(simulation) / sr
        }
        
        # Compute full analysis for DisplayAudio
        initial_waveform, spectrogram = _compute_full_analysis(simulation, sr)
        
        status_msg = f"Car passing simulation: v_i={v_start} m/s → v_f={v_end} m/s"
        freq_msg = ''
        if f_source is not None:
            f_obs_start = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND - v_start + EPS))
            f_obs_end_accel = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND - v_end + EPS))
            f_obs_recede = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND + (v_rec_end) + EPS))
            freq_msg = (
                f"Start obs freq: {f_obs_start:.1f} Hz · End of accel: {f_obs_end_accel:.1f} Hz · "
                f"Receding approx: {f_obs_recede:.1f} Hz"
            )
        
        # Return data in the format expected by DisplayAudio
        return Response({
            'store': store, 
            'src': src, 
            'waveform': fig, 
            'frequencies': freq_msg,
            'initial_waveform': initial_waveform,
            'spectrogram': spectrogram,
            'file_id': file_id,
            'status': status_msg,
            'observed': freq_msg
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@parser_classes([JSONParser])
def predict_doppler(request):
    try:
        if not librosa or not tf:
            return Response({'error': 'Prediction dependencies not available (tensorflow/librosa missing).'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        _lazy_load_model()
        if REG_MODEL is None or SPECTROGRAM_WIDTH is None:
            return Response({
                'error': 'Prediction model not loaded.',
                'model_path': MODEL_PATH,
                'model_exists': os.path.exists(MODEL_PATH) if MODEL_PATH else False,
                'config_path': CONFIG_PATH,
                'config_exists': os.path.exists(CONFIG_PATH) if CONFIG_PATH else False,
                'load_error': MODEL_LOAD_ERROR,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        contents = request.data.get('contents')
        if not contents:
            return Response({'error': 'contents (data URI) is required'}, status=status.HTTP_400_BAD_REQUEST)
        parsed = _parse_wav_from_data_uri(contents)
        waveform = parsed['samples']
        original_sr = parsed['sr']
        if original_sr != SAMPLE_RATE:
            waveform = librosa.resample(waveform, orig_sr=original_sr, target_sr=SAMPLE_RATE)
        S = librosa.feature.melspectrogram(y=waveform, sr=SAMPLE_RATE, n_mels=128, fmax=8000)
        S_dB = librosa.power_to_db(S, ref=np.max)
        current_width = S_dB.shape[1]
        if current_width < SPECTROGRAM_WIDTH:
            padding = SPECTROGRAM_WIDTH - current_width
            S_dB_padded = np.pad(S_dB, ((0, 0), (0, padding)), mode='constant')
        else:
            S_dB_padded = S_dB[:, :SPECTROGRAM_WIDTH]
        processed_spec = S_dB_padded[np.newaxis, ..., np.newaxis]
        pred_start, pred_end, pred_freq = REG_MODEL.predict(processed_spec)[0]
        return Response({
            'predicted_start_speed': float(pred_start),
            'predicted_end_speed': float(pred_end),
            'predicted_source_frequency': float(pred_freq),
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
