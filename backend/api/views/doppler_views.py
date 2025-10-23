from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
import numpy as np
import base64
import os

from .audio import (
    parse_wav_from_data_uri,
    write_wav_data_uri,
    compute_full_analysis,
    make_waveform,
    store_audio,
    SPEED_OF_SOUND,
    EPS,
)

try:
    import tensorflow as tf
    import librosa
except ImportError:
    tf = None
    librosa = None

SAMPLE_RATE = 16000
MODEL_PATH = "D:/DSP_Tasks/signal-viewer-and-undersampling/backend/models/doppler_regressor_cnn_2.keras"
CONFIG_PATH = "D:/DSP_Tasks/signal-viewer-and-undersampling/backend/models/spectrogram_width_2.npy"

REG_MODEL = None
SPECTROGRAM_WIDTH = None
MODEL_LOAD_ERROR = None

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

def apply_doppler_effect(audio, sr, v_start, v_end):
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

def linear_envelope(length, start_level=0.0, end_level=1.0):
    if length <= 0:
        return np.array([], dtype=np.float32)
    return np.linspace(start_level, end_level, length, dtype=np.float32)

def apply_amplitude_envelope(audio, envelope):
    if len(audio) != len(envelope):
        envelope = np.interp(
            np.linspace(0, 1, len(audio)), 
            np.linspace(0, 1, len(envelope)), 
            envelope
        )
    return audio * envelope

def compute_observed_frequencies(f_source, v_start, v_end):
    f_obs_start = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND - v_start + EPS))
    f_obs_end = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND - v_end + EPS))
    return f_obs_start, f_obs_end

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def upload_doppler(request):
    try:
        if 'audio' in request.FILES:
            audio_file = request.FILES['audio']
            data = audio_file.read()
            src = "data:audio/wav;base64," + base64.b64encode(data).decode('ascii')
        else:
            contents = request.data.get('contents')
            if not contents:
                return Response({'error': 'No audio provided'}, status=status.HTTP_400_BAD_REQUEST)
            src = contents
        
        store = parse_wav_from_data_uri(src)
        store['samples'] = store['samples'].tolist()
        fig = make_waveform(store)
        
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
        
        parsed = parse_wav_from_data_uri(contents)
        sr = parsed['sr']
        samples = np.array(parsed['samples'], dtype=np.float32)
        
        doppler_out = apply_doppler_effect(samples, sr, v_start, v_end)
        
        if v_end > v_start:
            env = linear_envelope(len(doppler_out), start_level=0.2, end_level=1.0)
        else:
            env = linear_envelope(len(doppler_out), start_level=1.0, end_level=0.2)
        doppler_out = apply_amplitude_envelope(doppler_out, env)
        
        src = write_wav_data_uri(doppler_out, sr)
        file_id = store_audio(doppler_out, sr)
        initial_waveform, spectrogram = compute_full_analysis(doppler_out, sr)
        
        status_msg = f"Doppler applied across full clip: v_i={v_start} m/s → v_f={v_end} m/s"
        freq_msg = ''
        if f_source is not None:
            f_obs_start, f_obs_end = compute_observed_frequencies(f_source, v_start, v_end)
            freq_msg = f"Observed Frequency: start={f_obs_start:.1f} Hz → end={f_obs_end:.1f} Hz"
        
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
        
        parsed = parse_wav_from_data_uri(contents)
        sr = parsed['sr']
        samples = np.array(parsed['samples'], dtype=np.float32)
        n = len(samples)
        
        if n == 0:
            return Response({'error': 'audio has no samples'}, status=status.HTTP_400_BAD_REQUEST)
        
        mid = n // 2
        segA = samples[:mid].astype(np.float32)
        segB = samples[mid:].astype(np.float32)
        
        approach = apply_doppler_effect(segA, sr, v_start, v_end)
        if v_end > v_start:
            envA = linear_envelope(len(approach), start_level=0.2, end_level=1.0)
        else:
            envA = linear_envelope(len(approach), start_level=1.0, end_level=0.2)
        approach = apply_amplitude_envelope(approach, envA)
        
        v_end_val = v_end
        if v_end_val >= 0:
            v_rec_start = v_end_val
            v_rec_end = v_end_val + 5.0
        else:
            v_rec_start = abs(v_end_val)
            v_rec_end = abs(v_end_val) + 5.0
        
        recede = apply_doppler_effect(segB, sr, v_rec_start, v_rec_end)
        envB = linear_envelope(len(recede), start_level=1.0, end_level=0.12)
        recede = apply_amplitude_envelope(recede, envB)
        
        simulation = np.concatenate([approach, recede]).astype(np.float32)
        max_val = np.max(np.abs(simulation)) + EPS
        simulation = simulation / max_val if max_val > 0 else simulation
        
        src = write_wav_data_uri(simulation, sr)
        store = {'sr': sr, 'samples': simulation.tolist(), 'duration': len(simulation) / sr}
        fig = make_waveform(store)
        file_id = store_audio(simulation, sr)
        initial_waveform, spectrogram = compute_full_analysis(simulation, sr)
        
        status_msg = f"Car passing simulation: v_i={v_start} m/s → v_f={v_end} m/s"
        freq_msg = ''
        if f_source is not None:
            f_obs_start, f_obs_end_accel = compute_observed_frequencies(f_source, v_start, v_end)
            f_obs_recede = f_source * (SPEED_OF_SOUND / (SPEED_OF_SOUND + v_rec_end + EPS))
            freq_msg = (
                f"Start obs freq: {f_obs_start:.1f} Hz · End of accel: {f_obs_end_accel:.1f} Hz · "
                f"Receding approx: {f_obs_recede:.1f} Hz"
            )
        
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
            return Response(
                {'error': 'Prediction dependencies not available (tensorflow/librosa missing).'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
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
        
        parsed = parse_wav_from_data_uri(contents)
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