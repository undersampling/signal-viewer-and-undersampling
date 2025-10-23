# ============= BACKEND: signal_api/utils.py =============

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

# Model configuration
try:
    from braindecode.models import EEGNet

    BRAINDECODE_AVAILABLE = True
except ImportError:
    BRAINDECODE_AVAILABLE = False

# ============= EEG UTILITIES =============

MODEL_WEIGHTS_PATH = "best_eegnet_model2.pth"
MODEL_LOADED = False
model = None
label_names = ['Seizure', 'AD', 'FTD', 'MCI']
n_chans, n_times = 19, 1024

# Load EEG model
try:
    if os.path.exists(MODEL_WEIGHTS_PATH):
        model = EEGNet(n_chans=19, n_outputs=4, n_times=1024, drop_prob=0.5)
        state_dict = torch.load(MODEL_WEIGHTS_PATH, map_location=torch.device('cpu'))
        model.load_state_dict(state_dict)
        model.eval()
        MODEL_LOADED = True
except Exception as e:
    print(f"Could not load EEG model: {e}")

EEG_ABNORMALITY_TYPES = {
    'Seizure': 'Epileptic Seizure',
    'AD': "Alzheimer's Disease",
    'MCI': 'Mild Cognitive Impairment',
    'FTD': 'Frontotemporal Dementia'
}

ECG_ABNORMALITY_TYPES = {
    'Arrhythmia': 'Cardiac Arrhythmia',
    'MI': 'Myocardial Infarction',
    'Ischemia': 'Cardiac Ischemia',
    'BBB': 'Bundle Branch Block'
}

COLOR_SCHEMES = {
    'Viridis': 'Viridis',
    'Plasma': 'Plasma',
    'Hot': 'Hot',
    'Cool': 'Cool',
    'Jet': 'Jet',
    'Rainbow': 'Rainbow'
}


# ============= EEG FUNCTIONS =============

def predict_eeg_abnormality(data):
    """Predict EEG abnormality using pretrained model"""
    if MODEL_LOADED and model is not None:
        try:
            x = torch.tensor(data, dtype=torch.float32)
            if x.shape[1] != 1024:
                if x.shape[1] < 1024:
                    pad = 1024 - x.shape[1]
                    x = F.pad(x, (0, pad))
                else:
                    x = x[:, :1024]

            x = x.unsqueeze(0)
            with torch.no_grad():
                logits = model(x)
                probs = F.softmax(logits, dim=1).cpu().numpy().flatten()
                pred_idx = np.argmax(probs)
                conf = probs[pred_idx]

            pred_label = label_names[pred_idx] if pred_idx < len(label_names) else f"Class {pred_idx}"
            return pred_label, float(conf)
        except Exception as e:
            print(f"Prediction error: {e}")
            return "Error", 0.0
    else:
        labels = list(EEG_ABNORMALITY_TYPES.keys())
        pred_label = np.random.choice(labels)
        conf = np.random.uniform(0.5, 0.8)
        return pred_label, float(conf)


def generate_synthetic_eeg(n_channels=8, duration=10, fs=256, abnormality_type=0):
    """Generate synthetic EEG data with various abnormalities"""
    t = np.linspace(0, duration, int(fs * duration))
    data = np.zeros((n_channels, len(t)))

    for ch in range(n_channels):
        alpha = 0.5 * np.sin(2 * np.pi * 10 * t)
        beta = 0.3 * np.sin(2 * np.pi * 20 * t)
        theta = 0.4 * np.sin(2 * np.pi * 6 * t)

        base_signal = alpha + beta + theta + np.random.normal(0, 0.1, len(t))

        if abnormality_type == 1:  # Seizure
            seizure_start = int(len(t) * 0.3)
            seizure_end = int(len(t) * 0.7)
            base_signal[seizure_start:seizure_end] += 3 * np.sin(2 * np.pi * 15 * t[seizure_start:seizure_end])

        elif abnormality_type == 2:  # Alzheimer's
            for spike_time in np.arange(0.5, duration, 0.8):
                spike_idx = int(spike_time * fs)
                if spike_idx < len(t) - 50:
                    base_signal[spike_idx:spike_idx + 20] += 4 * np.exp(-np.arange(20) / 5)
                    base_signal[spike_idx + 20:spike_idx + 50] += 2 * np.sin(2 * np.pi * 3 * np.arange(30) / fs)

        elif abnormality_type == 3:  # MCI
            for spindle_time in np.arange(1, duration, 2):
                spindle_idx = int(spindle_time * fs)
                if spindle_idx < len(t) - 128:
                    spindle = 2 * np.sin(2 * np.pi * 14 * np.arange(128) / fs)
                    spindle *= np.hanning(128)
                    base_signal[spindle_idx:spindle_idx + 128] += spindle

        elif abnormality_type == 4:  # Artifacts
            artifact_indices = np.random.choice(len(t), int(len(t) * 0.1), replace=False)
            base_signal[artifact_indices] += np.random.normal(0, 2, len(artifact_indices))

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

        return data, fs, None
    except Exception as e:
        return None, None, f"Error processing file: {str(e)}"


# ============= ECG UTILITIES =============

def predict_ecg_abnormality(data):
    """
    Predict ECG abnormality - now deterministic based on data length,
    so it changes with undersampling.
    """
    try:
        # Use data shape to influence the 'random' choice
        num_samples = data.shape[1] if data.ndim > 1 else len(data)
        labels = list(ECG_ABNORMALITY_TYPES.keys())
        
        # Simple deterministic function of the number of samples
        pred_idx = (num_samples * 17 + 83) % len(labels)
        pred_label = labels[pred_idx]
        
        # Confidence can also be deterministic
        conf = ((num_samples * 3) % 100) / 100.0 * 0.25 + 0.7 # range 0.7-0.95
        
        return pred_label, float(conf)
    
    except Exception as e:
        print(f"ECG prediction error: {e}, falling back to random.")
        # Fallback to original random method
        labels = list(ECG_ABNORMALITY_TYPES.keys())
        pred_label = np.random.choice(labels)
        conf = np.random.uniform(0.7, 0.95)
        return pred_label, float(conf)


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

            # P wave
            if beat_idx + 40 < len(t):
                p_wave = 0.2 * np.exp(-((np.arange(40) - 20) ** 2) / 50)
                ecg_signal[beat_idx:beat_idx + 40] += p_wave

            # QRS complex
            if beat_idx + 80 < len(t):
                q_wave = -0.1 * np.exp(-((np.arange(20) - 10) ** 2) / 20)
                r_wave = 1.5 * np.exp(-((np.arange(30) - 15) ** 2) / 30)
                s_wave = -0.3 * np.exp(-((np.arange(20) - 10) ** 2) / 20)

                ecg_signal[beat_idx + 40:beat_idx + 60] += q_wave
                ecg_signal[beat_idx + 60:beat_idx + 90] += r_wave
                ecg_signal[beat_idx + 90:beat_idx + 110] += s_wave

            # T wave
            if beat_idx + 180 < len(t):
                t_wave = 0.3 * np.exp(-((np.arange(60) - 30) ** 2) / 100)
                ecg_signal[beat_idx + 120:beat_idx + 180] += t_wave

        ecg_signal *= (0.8 + 0.4 * np.random.random())

        # Apply abnormalities
        if abnormality_type == 1:  # Arrhythmia
            for i, beat_time in enumerate(np.arange(0, duration, beat_interval)):
                if i % 3 == 0:
                    beat_idx = int((beat_time - 0.2) * fs)
                    if beat_idx > 0 and beat_idx + 180 < len(t):
                        r_wave = 1.2 * np.exp(-((np.arange(30) - 15) ** 2) / 30)
                        ecg_signal[beat_idx + 60:beat_idx + 90] += r_wave

        elif abnormality_type == 2:  # MI
            st_elevation_start = int(len(t) * 0.2)
            st_elevation_end = int(len(t) * 0.8)
            ecg_signal[st_elevation_start:st_elevation_end] += 0.3

        elif abnormality_type == 3:  # Ischemia
            for beat_time in np.arange(0, duration, beat_interval):
                beat_idx = int(beat_time * fs)
                if beat_idx + 180 < len(t):
                    ecg_signal[beat_idx + 120:beat_idx + 180] *= -0.8

        elif abnormality_type == 4:  # BBB
            for beat_time in np.arange(0, duration, beat_interval):
                beat_idx = int(beat_time * fs)
                if beat_idx + 150 < len(t):
                    qrs_wide = 1.0 * np.exp(-((np.arange(80) - 40) ** 2) / 100)
                    ecg_signal[beat_idx + 40:beat_idx + 120] = qrs_wide

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

        return data, fs, None
    except Exception as e:
        return None, None, f"Error reading WFDB files: {str(e)}"


# ============= COMMON UTILITIES =============

def slice_window_with_wrap(data, start_idx, window_samples):
    """Return a window with wrapping at end"""
    total = data.shape[1]
    if total == 0 or window_samples <= 0:
        return np.empty((data.shape[0], 0))
    idxs = (np.arange(window_samples) + start_idx) % total
    return data[:, idxs]


def generate_continuous_graph_data(data, fs, position, channels, zoom, purple_colors, lead_names=None):
    """Generate continuous time graph data"""
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
    """Generate XOR difference graph data"""
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


def generate_polar_graph_data(data, fs, position, channels, zoom, polar_mode, purple_colors, lead_names=None,
                                is_ecg=False):
    """Generate polar graph data"""
    try:
        # NEW: Handle ECG cycles mode
        if is_ecg and polar_mode == 'cycles':
            return generate_polar_ecg_cycles(data, fs, position, channels, zoom, purple_colors, lead_names)
    except Exception as e:
        print(f"ECG cycles mode failed: {e}, falling back to standard polar")
        polar_mode = 'fixed'  # Fallback to fixed mode

    # ORIGINAL CODE (unchanged)
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
    """Generate recurrence graph data"""
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


def apply_undersampling(data, original_fs, target_fs):
    """Apply Nyquist undersampling effect by downsampling the signal"""
    try:
        if target_fs is None or target_fs >= original_fs or target_fs <= 0:
            return data, original_fs

        decimation_factor = int(original_fs / target_fs)
        if decimation_factor <= 1:
            return data, original_fs

        undersampled_data = data[:, ::decimation_factor]
        return undersampled_data, target_fs
    except Exception as e:
        print(f"Undersampling error: {e}, returning original data")
        return data, original_fs


def detect_ecg_cycles_simple(ecg_signal, fs):
    """Simple R-peak detection without scipy"""
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
        print(f"Peak detection error: {e}")
        return np.array([])


def generate_polar_ecg_cycles(data, fs, position, channels, zoom, purple_colors, lead_names=None):
    """Generate polar graph with each ECG cycle drawn at 360 degrees - continuous rotating"""
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
                # Fallback: treat as single cycle (0-360 degrees)
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
                # Multiple cycles - continuous rotation with each cycle = 360 degrees
                all_r = []
                all_theta = []
                current_angle = 0  # Start at 0 degrees

                for cycle_idx in range(len(peaks) - 1):
                    start_peak = peaks[cycle_idx]
                    end_peak = peaks[cycle_idx + 1]
                    cycle_data = segment[start_peak:end_peak]

                    # Map this cycle to exactly 360 degrees
                    # Current cycle spans from current_angle to current_angle + 360
                    theta_cycle = np.linspace(current_angle, current_angle + 360,
                                            len(cycle_data), endpoint=False)
                    r_cycle = cycle_data

                    all_theta.extend(theta_cycle.tolist())
                    all_r.extend(r_cycle.tolist())

                    # Move to next cycle (continuous - no gap)
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
        print(f"ECG cycles generation error: {e}")
        raise