import numpy as np
import pandas as pd
import base64
import io
from scipy import signal as sp_signal
import torch
import torch.nn.functional as F
from torch import nn
import os
import wfdb
import tempfile
import shutil
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '..', '..'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# ============= MODEL CONFIGURATION =============

# Try importing braindecode for EEG
BRAINDECODE_AVAILABLE = False
try:
    from braindecode.models import EEGNet
    BRAINDECODE_AVAILABLE = True
    print("✅ braindecode imported successfully!")
except ImportError:
    print("⚠️ braindecode not found")
    BRAINDECODE_AVAILABLE = False

# Try importing TensorFlow for ECG
TENSORFLOW_AVAILABLE = False
try:
    from tensorflow.keras.models import load_model
    TENSORFLOW_AVAILABLE = True
    print("✅ TensorFlow imported successfully!")
except ImportError:
    print("⚠️ TensorFlow not found. Install with: pip install tensorflow")
    TENSORFLOW_AVAILABLE = False

# EEG Model Configuration
EEG_MODEL_WEIGHTS_PATH = "D:\\Downloads_Alaa\\best_eegnet_model2.pth"
EEG_MODEL_LOADED = False
eegnet_model = None
EEG_LABEL_NAMES = ['Seizure', 'AD', 'FTD', 'MCI']
N_CHANS, N_TIMES = 19, 1024

# ECG Model Configuration
ECG_MODEL_PATH = "D:\\ECG_model\\model.hdf5"
ECG_MODEL_LOADED = False
ecg_model = None
ECG_LEAD_NAMES = ['DI','DII','DIII','AVR','AVL','AVF','V1','V2','V3','V4','V5','V6']
ECG_LABEL_NAMES = ['1dAVb','RBBB','LBBB','SB','AF','ST']
ECG_EXPECTED_SAMPLES = 4096
ECG_EXPECTED_LEADS = 12

# Abnormality type mappings
EEG_ABNORMALITY_TYPES = {
    'Seizure': 'Epileptic Seizure',
    'AD': "Alzheimer's Disease",
    'MCI': 'Mild Cognitive Impairment',
    'FTD': 'Frontotemporal Dementia',
    'Normal': 'Normal',
    'Unknown': 'Unknown'
}

ECG_ABNORMALITY_TYPES = {
    '1dAVb': '1st Degree AV Block',
    'RBBB': 'Right Bundle Branch Block',
    'LBBB': 'Left Bundle Branch Block',
    'SB': 'Sinus Bradycardia',
    'AF': 'Atrial Fibrillation',
    'ST': 'ST Segment Abnormality',
    'Normal': 'Normal Sinus Rhythm',
    'Unknown': 'Unknown'
}

COLOR_SCHEMES = {
    'Viridis': 'Viridis',
    'Plasma': 'Plasma',
    'Hot': 'Hot',
    'Cool': 'Cool',
    'Jet': 'Jet',
    'Rainbow': 'Rainbow'
}


# ============= MODEL LOADING =============

def load_eegnet_model():
    """Load the EEGNet model for EEG prediction"""
    global EEG_MODEL_LOADED, eegnet_model
    
    if not BRAINDECODE_AVAILABLE:
        print("⚠️ Cannot load EEG model: braindecode not available")
        return False
    
    try:
        if not os.path.exists(EEG_MODEL_WEIGHTS_PATH):
            print(f"⚠️ EEG model file not found: {EEG_MODEL_WEIGHTS_PATH}")
            return False
        
        print("📦 Loading EEG model...")
        eegnet_model = EEGNet(n_chans=19, n_outputs=4, n_times=1024, drop_prob=0.5)
        state_dict = torch.load(EEG_MODEL_WEIGHTS_PATH, map_location=torch.device('cpu'))
        eegnet_model.load_state_dict(state_dict, strict=False)
        eegnet_model.eval()
        EEG_MODEL_LOADED = True
        print(f"✅ EEG model loaded successfully")
        return True
        
    except Exception as e:
        print(f"⚠️ Could not load EEG model: {e}")
        return False


def load_ecg_model():
    """Load the ECG Keras model"""
    global ECG_MODEL_LOADED, ecg_model
    
    if not TENSORFLOW_AVAILABLE:
        print("⚠️ Cannot load ECG model: TensorFlow not available")
        return False
    
    try:
        if not os.path.exists(ECG_MODEL_PATH):
            print(f"⚠️ ECG model file not found: {ECG_MODEL_PATH}")
            return False
        
        print("📦 Loading ECG model...")
        from tensorflow.keras.models import load_model
        ecg_model = load_model(ECG_MODEL_PATH, compile=False)
        ECG_MODEL_LOADED = True
        print(f"✅ ECG model loaded successfully")
        return True
        
    except Exception as e:
        print(f"⚠️ Could not load ECG model: {e}")
        import traceback
        traceback.print_exc()
        return False


# Load models on module import
print("=" * 60)
print("🚀 Initializing Signal Processing Module")
print("=" * 60)
load_eegnet_model()
load_ecg_model()
print("=" * 60)


# ============= EEG PREDICTION FUNCTIONS =============

def predict_eeg_abnormality(data):
    """
    Predict EEG abnormality using trained EEGNet model.
    
    Args:
        data: numpy array of shape (n_channels, n_timepoints)
        
    Returns:
        tuple: (prediction_label, confidence_score)
    """
    if data is None or data.size == 0:
        return "Unknown", 0.0
    
    if data.ndim == 1:
        data = data.reshape(1, -1)
    
    if EEG_MODEL_LOADED and eegnet_model is not None:
        try:
            return _predict_eeg_with_model(data)
        except Exception as e:
            print(f"⚠️ EEG prediction error: {e}")
            return "Error", 0.0
    else:
        labels = list(EEG_ABNORMALITY_TYPES.keys())
        pred_label = np.random.choice(labels[:4])
        conf = np.random.uniform(0.5, 0.8)
        return pred_label, float(conf)


def _predict_eeg_with_model(data):
    """Internal function to predict EEG using the loaded model"""
    x = torch.tensor(data, dtype=torch.float32)
    
    if x.shape[1] != N_TIMES:
        if x.shape[1] < N_TIMES:
            pad = N_TIMES - x.shape[1]
            x = F.pad(x, (0, pad))
        else:
            x = x[:, :N_TIMES]
    
    x = x.unsqueeze(0)
    
    with torch.no_grad():
        logits = eegnet_model(x)
        probs = F.softmax(logits, dim=1).cpu().numpy().flatten()
        pred_idx = np.argmax(probs)
        conf = probs[pred_idx]
    
    pred_label = EEG_LABEL_NAMES[pred_idx] if pred_idx < len(EEG_LABEL_NAMES) else f"Class {pred_idx}"
    
    return pred_label, float(conf)


# ============= ECG PREDICTION FUNCTIONS =============

def predict_ecg_abnormality(data):
    """
    Predict ECG abnormality using trained Keras model.
    
    Args:
        data: numpy array of shape (n_leads, n_samples)
        
    Returns:
        tuple: (prediction_label, confidence_score)
    """
    if data is None or data.size == 0:
        return "Unknown", 0.0
    
    if data.ndim == 1:
        data = data.reshape(1, -1)
    
    if ECG_MODEL_LOADED and ecg_model is not None:
        try:
            return _predict_ecg_with_model(data)
        except Exception as e:
            print(f"⚠️ ECG prediction error: {e}")
            import traceback
            traceback.print_exc()
            return "Error", 0.0
    else:
        # Fallback - return random prediction
        pred_label = np.random.choice(ECG_LABEL_NAMES)
        conf = np.random.uniform(0.7, 0.95)
        return pred_label, float(conf)


def _predict_ecg_with_model(data):
    """Internal function to predict ECG using the loaded Keras model"""
    # Transpose if needed: we need (leads, samples)
    if data.shape[0] > data.shape[1]:
        data = data.T
    
    # Handle lead dimension
    if data.shape[0] != ECG_EXPECTED_LEADS:
        if data.shape[0] < ECG_EXPECTED_LEADS:
            # Pad with zeros
            pad_leads = ECG_EXPECTED_LEADS - data.shape[0]
            padding = np.zeros((pad_leads, data.shape[1]))
            data = np.vstack([data, padding])
            print(f"   Padded from {data.shape[0] - pad_leads} to {ECG_EXPECTED_LEADS} leads")
        else:
            # Take first 12 leads
            data = data[:ECG_EXPECTED_LEADS, :]
            print(f"   Truncated to {ECG_EXPECTED_LEADS} leads")
    
    # Handle sample dimension (pad or truncate to 4096)
    if data.shape[1] != ECG_EXPECTED_SAMPLES:
        if data.shape[1] < ECG_EXPECTED_SAMPLES:
            # Pad with zeros
            pad_samples = ECG_EXPECTED_SAMPLES - data.shape[1]
            padding = np.zeros((data.shape[0], pad_samples))
            data = np.hstack([data, padding])
            print(f"   Padded from {data.shape[1] - pad_samples} to {ECG_EXPECTED_SAMPLES} samples")
        else:
            # Truncate
            data = data[:, :ECG_EXPECTED_SAMPLES]
            print(f"   Truncated to {ECG_EXPECTED_SAMPLES} samples")
    
    # Transpose to (samples, leads) for model input
    data = data.T  # Now shape is (4096, 12)
    
    # Normalize
    mean = np.mean(data, axis=0)
    std = np.std(data, axis=0)
    data_norm = (data - mean) / (std + 1e-8)
    
    # Add batch dimension: (1, 4096, 12)
    x = np.expand_dims(data_norm, axis=0)
    
    # Make prediction
    y_pred = ecg_model.predict(x, verbose=0)
    y_pred_probs = y_pred[0]  # Get probabilities
    
    # Apply threshold
    threshold = 0.5
    predicted_diseases = []
    for label, prob in zip(ECG_LABEL_NAMES, y_pred_probs):
        if prob >= threshold:
            predicted_diseases.append((label, prob))
    
    # If no predictions above threshold, use argmax
    if not predicted_diseases:
        max_prob_idx = np.argmax(y_pred_probs)
        pred_label = ECG_LABEL_NAMES[max_prob_idx]
        conf = float(y_pred_probs[max_prob_idx])
    else:
        # Sort by probability and take highest
        predicted_diseases.sort(key=lambda x: x[1], reverse=True)
        pred_label = predicted_diseases[0][0]
        conf = float(predicted_diseases[0][1])
    
    print(f"✅ ECG Prediction: {pred_label} (confidence: {conf:.2%})")
    if len(predicted_diseases) > 1:
        print(f"   Additional predictions: {[f'{l}({p:.2%})' for l, p in predicted_diseases[1:]]}")
    
    return pred_label, conf


# ============= EEG DATA GENERATION =============

def generate_synthetic_eeg(n_channels=19, duration=10, fs=256, abnormality_type=0):
    """Generate synthetic EEG data with various abnormalities"""
    t = np.linspace(0, duration, int(fs * duration))
    data = np.zeros((n_channels, len(t)))

    for ch in range(n_channels):
        alpha = 0.5 * np.sin(2 * np.pi * 10 * t)
        beta = 0.3 * np.sin(2 * np.pi * 20 * t)
        theta = 0.4 * np.sin(2 * np.pi * 6 * t)
        base_signal = alpha + beta + theta + np.random.normal(0, 0.1, len(t))

        if abnormality_type == 1:
            seizure_start = int(len(t) * 0.3)
            seizure_end = int(len(t) * 0.7)
            base_signal[seizure_start:seizure_end] += 3 * np.sin(2 * np.pi * 15 * t[seizure_start:seizure_end])
        elif abnormality_type == 2:
            for spike_time in np.arange(0.5, duration, 0.8):
                spike_idx = int(spike_time * fs)
                if spike_idx < len(t) - 50:
                    base_signal[spike_idx:spike_idx + 20] += 4 * np.exp(-np.arange(20) / 5)
        elif abnormality_type == 3:
            for spindle_time in np.arange(1, duration, 2):
                spindle_idx = int(spindle_time * fs)
                if spindle_idx < len(t) - 128:
                    spindle = 2 * np.sin(2 * np.pi * 14 * np.arange(128) / fs)
                    spindle *= np.hanning(128)
                    base_signal[spindle_idx:spindle_idx + 128] += spindle

        data[ch] = base_signal

    return data, fs


def parse_eeg_file(file_obj):
    """Parse EEG file (CSV or NPY)"""
    try:
        filename = file_obj.name.lower()
        if 'csv' in filename:
            df = pd.read_csv(file_obj)
            data = df.values.T
            fs = 256
        elif 'npy' in filename:
            data = np.load(file_obj)
            fs = 256
        else:
            return None, None, "Unsupported format. Use CSV or NPY."

        if data.ndim == 1:
            data = data.reshape(1, -1)
        elif data.shape[0] > data.shape[1]:
            data = data.T

        print(f"✅ Parsed EEG file: {data.shape[0]} channels, {data.shape[1]} samples, {fs} Hz")
        return data, fs, None
    except Exception as e:
        return None, None, f"Error processing file: {str(e)}"


# ============= ECG DATA GENERATION =============

def generate_synthetic_ecg(n_channels=12, duration=10, fs=500, abnormality_type=0):
    """Generate synthetic ECG data with various abnormalities"""
    t = np.linspace(0, duration, int(fs * duration))
    data = np.zeros((n_channels, len(t)))
    heart_rate = 75
    beat_interval = 60 / heart_rate

    for ch in range(n_channels):
        ecg_signal = np.zeros(len(t))
        for beat_time in np.arange(0, duration, beat_interval):
            beat_idx = int(beat_time * fs)
            if beat_idx + 40 < len(t):
                p_wave = 0.2 * np.exp(-((np.arange(40) - 20) ** 2) / 50)
                ecg_signal[beat_idx:beat_idx + 40] += p_wave
            if beat_idx + 110 < len(t):
                q_wave = -0.1 * np.exp(-((np.arange(20) - 10) ** 2) / 20)
                r_wave = 1.5 * np.exp(-((np.arange(30) - 15) ** 2) / 30)
                s_wave = -0.3 * np.exp(-((np.arange(20) - 10) ** 2) / 20)
                ecg_signal[beat_idx + 40:beat_idx + 60] += q_wave
                ecg_signal[beat_idx + 60:beat_idx + 90] += r_wave
                ecg_signal[beat_idx + 90:beat_idx + 110] += s_wave
            if beat_idx + 180 < len(t):
                t_wave = 0.3 * np.exp(-((np.arange(60) - 30) ** 2) / 100)
                ecg_signal[beat_idx + 120:beat_idx + 180] += t_wave

        ecg_signal *= (0.8 + 0.4 * np.random.random())
        ecg_signal += np.random.normal(0, 0.05, len(t))
        data[ch] = ecg_signal

    return data, fs


def parse_ecg_file(file_obj):
    """Parse ECG file (CSV or NPY)"""
    try:
        filename = file_obj.name.lower()
        if 'csv' in filename:
            df = pd.read_csv(file_obj)
            data = df.values.T
            fs = 500
        elif 'npy' in filename:
            data = np.load(file_obj)
            fs = 500
        else:
            return None, None, "Unsupported format. Use CSV or NPY."

        if data.ndim == 1:
            data = data.reshape(1, -1)
        elif data.shape[0] > data.shape[1]:
            data = data.T

        print(f"✅ Parsed ECG file: {data.shape[0]} leads, {data.shape[1]} samples, {fs} Hz")
        return data, fs, None
    except Exception as e:
        return None, None, f"Error processing file: {str(e)}"


def parse_wfdb_files(dat_file, hea_file):
    """Parse WFDB format files (.dat + .hea)"""
    try:
        temp_dir = tempfile.mkdtemp()
        dat_path = os.path.join(temp_dir, dat_file.name)
        hea_path = os.path.join(temp_dir, hea_file.name)

        with open(dat_path, 'wb') as f:
            f.write(dat_file.read())
        with open(hea_path, 'wb') as f:
            f.write(hea_file.read())

        record_name = os.path.splitext(dat_file.name)[0]
        record = wfdb.rdrecord(os.path.join(temp_dir, record_name))

        data = record.p_signal.T
        fs = record.fs
        shutil.rmtree(temp_dir)

        print(f"✅ Parsed WFDB file: {data.shape[0]} leads, {data.shape[1]} samples, {fs} Hz")
        return data, fs, None
    except Exception as e:
        if 'temp_dir' in locals():
            shutil.rmtree(temp_dir, ignore_errors=True)
        return None, None, f"Error reading WFDB files: {str(e)}"


# ============= SIGNAL PROCESSING UTILITIES =============

def slice_window_with_wrap(data, start_idx, window_samples):
    """Return a window with wrapping at end"""
    total = data.shape[1]
    if total == 0 or window_samples <= 0:
        return np.empty((data.shape[0], 0))
    idxs = (np.arange(window_samples) + start_idx) % total
    return data[:, idxs]


def apply_undersampling(data, original_fs, target_fs):
    """Apply Nyquist undersampling effect by downsampling the signal"""
    try:
        if target_fs is None or target_fs >= original_fs or target_fs <= 0:
            return data, original_fs

        decimation_factor = int(original_fs / target_fs)
        if decimation_factor <= 1:
            return data, original_fs

        undersampled_data = data[:, ::decimation_factor]
        print(f"✅ Undersampled from {original_fs}Hz to {target_fs}Hz (factor: {decimation_factor})")
        return undersampled_data, target_fs
    except Exception as e:
        print(f"⚠️ Undersampling error: {e}, returning original data")
        return data, original_fs


# ============= GRAPH GENERATION UTILITIES =============

def generate_continuous_graph_data(data, fs, position, channels, zoom, purple_colors, lead_names=None):
    total_samples = data.shape[1]
    window_samples = max(1, int(zoom * fs))
    start_idx = int(position * fs) % total_samples
    window = slice_window_with_wrap(data, start_idx, window_samples)
    t_window = (position + np.arange(window.shape[1]) / fs).tolist()
    traces = []
    for i, ch in enumerate(channels):
        if ch < data.shape[0]:
            traces.append({
                'x': t_window,
                'y': (window[ch, :] + i * 5).tolist(),
                'mode': 'lines',
                'name': f'{"Lead" if lead_names else "Channel"} {lead_names[ch] if lead_names else ch + 1}',
                'line': {'width': 2, 'color': purple_colors[i % len(purple_colors)]}
            })
    return traces


def generate_xor_graph_data(data, fs, position, channels, chunk_duration, purple_colors, lead_names=None):
    total_samples = data.shape[1]
    chunk_samples = int(chunk_duration * fs)
    traces = []
    for i, ch in enumerate(channels):
        if ch < data.shape[0]:
            start_idx = int(position * fs) % total_samples
            beat1 = slice_window_with_wrap(data[ch:ch + 1, :], start_idx, chunk_samples)[0]
            beat2_start = (start_idx + chunk_samples) % total_samples
            beat2 = slice_window_with_wrap(data[ch:ch + 1, :], beat2_start, chunk_samples)[0]
            beat1_binary = (beat1 > 0).astype(int)
            beat2_binary = (beat2 > 0).astype(int)
            xor_result = np.logical_xor(beat1_binary, beat2_binary).astype(float)
            diff_signal = np.zeros(chunk_samples)
            diff_indices = np.where(xor_result == 1)[0]
            if len(diff_indices) > 0:
                diff_signal[diff_indices] = beat2[diff_indices] - beat1[diff_indices]
            t_chunk = (np.arange(chunk_samples) / fs).tolist()
            diff_signal_with_nan = np.where(xor_result == 1, diff_signal, np.nan)
            diff_masked = [None if np.isnan(x) else x for x in diff_signal_with_nan]
            traces.append({
                'x': t_chunk,
                'y': diff_masked,
                'mode': 'lines+markers',
                'name': f'{"Lead" if lead_names else "Channel"} {lead_names[ch] if lead_names else ch + 1}',
                'line': {'width': 2, 'color': purple_colors[i % len(purple_colors)]},
                'marker': {'size': 4}
            })
    return traces


def generate_polar_graph_data(data, fs, position, channels, zoom, polar_mode, purple_colors, lead_names=None, is_ecg=False):
    try:
        if is_ecg and polar_mode == 'cycles':
            return generate_polar_ecg_cycles(data, fs, position, channels, zoom, purple_colors, lead_names)
    except Exception as e:
        print(f"⚠️ ECG cycles mode failed: {e}, falling back to standard polar")
        polar_mode = 'fixed'

    total_samples = data.shape[1]
    window_samples = max(1, int(zoom * fs))
    if polar_mode == 'fixed':
        start_idx = int(position * fs) % total_samples
        window = slice_window_with_wrap(data, start_idx, window_samples)
    else:
        start_idx = 0
        cum_samples = max(1, int((position + zoom) * fs))
        window = slice_window_with_wrap(data, start_idx, cum_samples)

    traces = []
    for i, ch in enumerate(channels):
        if ch < data.shape[0]:
            segment = window[ch, :]
            theta = np.linspace(0, 360, len(segment), endpoint=False).tolist()
            r = np.abs(segment).tolist()
            traces.append({
                'r': r,
                'theta': theta,
                'mode': 'lines',
                'name': f'{"Lead" if lead_names else "Channel"} {lead_names[ch] if lead_names else ch + 1}',
                'line': {'width': 2, 'color': purple_colors[i % len(purple_colors)]},
                'type': 'scatterpolar'
            })
    return traces


def generate_recurrence_graph_data(data, fs, position, channels, zoom, rec_ch_x, rec_ch_y, colormap):
    total_samples = data.shape[1]
    window_samples = max(1, int(zoom * fs))
    start_idx = int(position * fs) % total_samples
    window = slice_window_with_wrap(data, start_idx, window_samples)
    if rec_ch_x < data.shape[0] and rec_ch_y < data.shape[0]:
        x_data = window[rec_ch_x, :]
        y_data = window[rec_ch_y, :]
        hist, xedges, yedges = np.histogram2d(x_data, y_data, bins=50)
        return {
            'z': hist.T.tolist(),
            'x': xedges.tolist(),
            'y': yedges.tolist(),
            'colorscale': colormap,
            'type': 'heatmap'
        }
    return None


def detect_ecg_cycles_simple(ecg_signal, fs):
    try:
        signal_norm = (ecg_signal - np.mean(ecg_signal)) / (np.std(ecg_signal) + 1e-8)
        threshold = 0.5 * np.max(signal_norm)
        min_distance_samples = int(0.3 * fs)
        peaks = []
        i = 0
        while i < len(signal_norm):
            if signal_norm[i] > threshold:
                local_max_idx = i
                local_max_val = signal_norm[i]
                j = i + 1
                while j < min(i + int(0.1 * fs), len(signal_norm)):
                    if signal_norm[j] > local_max_val:
                        local_max_val = signal_norm[j]
                        local_max_idx = j
                    j += 1
                peaks.append(local_max_idx)
                i = local_max_idx + min_distance_samples
            else:
                i += 1
        return np.array(peaks)
    except Exception as e:
        print(f"⚠️ Peak detection error: {e}")
        return np.array([])


def generate_polar_ecg_cycles(data, fs, position, channels, zoom, purple_colors, lead_names=None):
    try:
        total_samples = data.shape[1]
        window_samples = max(1, int(zoom * fs))
        start_idx = int(position * fs) % total_samples
        window = slice_window_with_wrap(data, start_idx, window_samples)
        traces = []
        for i, ch in enumerate(channels):
            if ch >= data.shape[0]:
                continue
            segment = window[ch, :]
            peaks = detect_ecg_cycles_simple(segment, fs)
            if len(peaks) < 2:
                theta = np.linspace(0, 360, len(segment), endpoint=False).tolist()
                r = segment.tolist()
                traces.append({
                    'r': r,
                    'theta': theta,
                    'mode': 'lines',
                    'name': f'Lead {lead_names[ch] if lead_names else ch + 1}',
                    'line': {'width': 2, 'color': purple_colors[i % len(purple_colors)]},
                    'type': 'scatterpolar'
                })
            else:
                all_r = []
                all_theta = []
                current_angle = 0
                for cycle_idx in range(len(peaks) - 1):
                    start_peak = peaks[cycle_idx]
                    end_peak = peaks[cycle_idx + 1]
                    cycle_data = segment[start_peak:end_peak]
                    theta_cycle = np.linspace(current_angle, current_angle + 360, len(cycle_data), endpoint=False)
                    r_cycle = cycle_data
                    all_theta.extend(theta_cycle.tolist())
                    all_r.extend(r_cycle.tolist())
                    current_angle += 360
                traces.append({
                    'r': all_r,
                    'theta': all_theta,
                    'mode': 'lines',
                    'name': f'Lead {lead_names[ch] if lead_names else ch + 1}',
                    'line': {'width': 2, 'color': purple_colors[i % len(purple_colors)]},
                    'type': 'scatterpolar'
                })
        return traces
    except Exception as e:
        print(f"⚠️ ECG cycles generation error: {e}")
        raise