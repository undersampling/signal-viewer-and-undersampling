from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
import numpy as np
import json

from .serializers import (
    SignalUploadSerializer,
    WFDBUploadSerializer,
    SignalGraphSerializer
)
from ..utils import (  # Note: might be ..utils depending on your structure
    predict_eeg_abnormality,
    predict_ecg_abnormality,
    generate_synthetic_eeg,
    generate_synthetic_ecg,
    parse_eeg_file,
    parse_ecg_file,
    parse_wfdb_files,
    EEG_ABNORMALITY_TYPES,
    ECG_ABNORMALITY_TYPES,
    generate_continuous_graph_data,
    generate_xor_graph_data,
    generate_polar_graph_data,
    generate_recurrence_graph_data,
    slice_window_with_wrap,
    apply_undersampling,  # NEW
)

# These should be defined at module level in your views file
PURPLE_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#11998e', '#38ef7d',
                 '#4facfe', '#00f2fe', '#fa709a', '#fee140', '#30cfd0', '#330867']

EEG_LEAD_NAMES = [f'Ch {i + 1}' for i in range(19)]
ECG_LEAD_NAMES = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]


class EEGDemoView(APIView):
    def post(self, request):
        try:
            abnormality_type = np.random.randint(0, 5)
            data, fs = generate_synthetic_eeg(abnormality_type=abnormality_type)

            pred, conf = predict_eeg_abnormality(data)
            status_text = EEG_ABNORMALITY_TYPES.get(pred, pred)

            return Response({
                'data': data.tolist(),
                'fs': int(fs),
                'duration': float(data.shape[1] / fs),
                'prediction': pred,
                'confidence': conf,
                'status': status_text,
                'channels': len(data),
                'success': True
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'success': False
            }, status=400)


class EEGUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        try:
            if 'file' not in request.FILES:
                return Response({'error': 'No file provided'}, status=400)

            file = request.FILES['file']
            data, fs, error = parse_eeg_file(file)

            if error:
                return Response({'error': error}, status=400)

            pred, conf = predict_eeg_abnormality(data)
            status_text = EEG_ABNORMALITY_TYPES.get(pred, pred)

            return Response({
                'data': data.tolist(),
                'fs': int(fs),
                'duration': float(data.shape[1] / fs),
                'prediction': pred,
                'confidence': conf,
                'status': status_text,
                'channels': len(data),
                'success': True
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'success': False
            }, status=400)


class ECGDemoView(APIView):
    def post(self, request):
        try:
            abnormality_type = np.random.randint(0, 5)
            data, fs = generate_synthetic_ecg(abnormality_type=abnormality_type)

            pred, conf = predict_ecg_abnormality(data)
            status_text = ECG_ABNORMALITY_TYPES.get(pred, pred)

            return Response({
                'data': data.tolist(),
                'fs': int(fs),
                'duration': float(data.shape[1] / fs),
                'prediction': pred,
                'confidence': conf,
                'status': status_text,
                'leads': len(data),
                'success': True
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'success': False
            }, status=400)


class ECGUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        try:
            if 'file' not in request.FILES:
                return Response({'error': 'No file provided'}, status=400)

            file = request.FILES['file']
            data, fs, error = parse_ecg_file(file)

            if error:
                return Response({'error': error}, status=400)

            pred, conf = predict_ecg_abnormality(data)
            status_text = ECG_ABNORMALITY_TYPES.get(pred, pred)

            return Response({
                'data': data.tolist(),
                'fs': int(fs),
                'duration': float(data.shape[1] / fs),
                'prediction': pred,
                'confidence': conf,
                'status': status_text,
                'leads': len(data),
                'success': True
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'success': False
            }, status=400)


class ECGWFDBUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        try:
            if 'dat_file' not in request.FILES or 'hea_file' not in request.FILES:
                return Response({'error': 'Both .dat and .hea files required'}, status=400)

            dat_file = request.FILES['dat_file']
            hea_file = request.FILES['hea_file']

            data, fs, error = parse_wfdb_files(dat_file, hea_file)

            if error:
                return Response({'error': error}, status=400)

            pred, conf = predict_ecg_abnormality(data)
            status_text = ECG_ABNORMALITY_TYPES.get(pred, pred)

            return Response({
                'data': data.tolist(),
                'fs': int(fs),
                'duration': float(data.shape[1] / fs),
                'prediction': pred,
                'confidence': conf,
                'status': status_text,
                'leads': len(data),
                'success': True
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'success': False
            }, status=400)


class EEGGraphView(APIView):
    def post(self, request):
        try:
            print("=== EEG Graph Request ===")
            print("Request data keys:", request.data.keys())

            serializer = SignalGraphSerializer(data=request.data)
            if not serializer.is_valid():
                print("Serializer errors:", serializer.errors)
                return Response(serializer.errors, status=400)

            data = np.array(serializer.validated_data['data'])
            fs = serializer.validated_data['fs']
            channels = serializer.validated_data['channels']
            viewer_type = serializer.validated_data['viewer_type']
            position = serializer.validated_data['position']
            zoom = serializer.validated_data['zoom']
            chunk_duration = serializer.validated_data.get('chunk_duration', 2)
            colormap = serializer.validated_data.get('colormap', 'Viridis')
            polar_mode = serializer.validated_data.get('polar_mode', 'fixed')
            rec_ch_x = serializer.validated_data.get('rec_ch_x', 0)
            rec_ch_y = serializer.validated_data.get('rec_ch_y', 1)
            undersample_freq = serializer.validated_data.get('undersample_freq', None)

            print(f"Data shape: {data.shape}, FS: {fs}, Viewer: {viewer_type}")
            print(f"Undersample freq: {undersample_freq}")

            # Apply undersampling if requested
            if undersample_freq is not None and undersample_freq > 0 and undersample_freq < fs:
                print(f"Applying undersampling from {fs}Hz to {undersample_freq}Hz")
                data, fs = apply_undersampling(data, fs, undersample_freq)
                print(f"After undersampling - Data shape: {data.shape}, New FS: {fs}")

            current_time = f"⏱️ {position:.2f}s / {data.shape[1] / fs:.2f}s"

            if viewer_type == 'continuous':
                traces = generate_continuous_graph_data(
                    data, fs, position, channels, zoom, PURPLE_COLORS, EEG_LEAD_NAMES
                )
                layout = {
                    'title': '📈 Continuous Time Signal Viewer',
                    'xaxis_title': 'Time (s)',
                    'yaxis_title': 'Amplitude',
                    'template': 'plotly_white',
                    'plot_bgcolor': '#f8f9ff',
                    'height': 600
                }

            elif viewer_type == 'xor':
                traces = generate_xor_graph_data(
                    data, fs, position, channels, chunk_duration, PURPLE_COLORS, EEG_LEAD_NAMES
                )
                layout = {
                    'title': f'⚡ XOR Difference Graph (Chunk: {chunk_duration}s)',
                    'xaxis_title': 'Time within window (s)',
                    'yaxis_title': 'Difference Amplitude',
                    'template': 'plotly_white',
                    'plot_bgcolor': '#f8f9ff',
                    'height': 600
                }

            elif viewer_type == 'polar':
                traces = generate_polar_graph_data(
                    data, fs, position, channels, zoom, polar_mode, PURPLE_COLORS, EEG_LEAD_NAMES, is_ecg=False
                )
                layout = {
                    'title': f'🎯 Polar Graph ({polar_mode.capitalize()})',
                    'polar': {'radialaxis': {'visible': True}},
                    'height': 600
                }

            elif viewer_type == 'recurrence':
                recurrence_data = generate_recurrence_graph_data(
                    data, fs, position, channels, zoom, rec_ch_x, rec_ch_y, colormap
                )
                if recurrence_data:
                    traces = [recurrence_data]
                    layout = {
                        'title': f'📊 Recurrence: {EEG_LEAD_NAMES[rec_ch_x]} vs {EEG_LEAD_NAMES[rec_ch_y]}',
                        'xaxis_title': f'Channel {rec_ch_x + 1}',
                        'yaxis_title': f'Channel {rec_ch_y + 1}',
                        'plot_bgcolor': '#f8f9ff',
                        'height': 600
                    }
                else:
                    traces = []
                    layout = {'title': 'Error generating recurrence plot'}
            else:
                traces = []
                layout = {'title': 'Unknown viewer type'}

            print(f"Generated {len(traces)} traces")

            response_data = {
                'traces': traces,
                'layout': layout,
                'current_time': current_time,
                'success': True
            }

            return Response(response_data)

        except Exception as e:
            import traceback
            print("=== ERROR in EEGGraphView ===")
            print(traceback.format_exc())
            return Response({
                'error': str(e),
                'success': False
            }, status=400)


class ECGGraphView(APIView):
    def post(self, request):
        try:
            print("=== ECG Graph Request ===")
            print("Request data keys:", request.data.keys())

            serializer = SignalGraphSerializer(data=request.data)
            if not serializer.is_valid():
                print("Serializer errors:", serializer.errors)
                return Response(serializer.errors, status=400)

            data = np.array(serializer.validated_data['data'])
            fs = serializer.validated_data['fs']
            channels = serializer.validated_data['channels']
            viewer_type = serializer.validated_data['viewer_type']
            position = serializer.validated_data['position']
            zoom = serializer.validated_data['zoom']
            chunk_duration = serializer.validated_data.get('chunk_duration', 2)
            colormap = serializer.validated_data.get('colormap', 'Viridis')
            polar_mode = serializer.validated_data.get('polar_mode', 'fixed')
            rec_ch_x = serializer.validated_data.get('rec_ch_x', 0)
            rec_ch_y = serializer.validated_data.get('rec_ch_y', 1)
            undersample_freq = serializer.validated_data.get('undersample_freq', None)

            print(f"Data shape: {data.shape}, FS: {fs}, Viewer: {viewer_type}")
            print(f"Polar mode: {polar_mode}, Undersample freq: {undersample_freq}")

            # Apply undersampling if requested
            if undersample_freq is not None and undersample_freq > 0 and undersample_freq < fs:
                print(f"Applying undersampling from {fs}Hz to {undersample_freq}Hz")
                data, fs = apply_undersampling(data, fs, undersample_freq)
                print(f"After undersampling - Data shape: {data.shape}, New FS: {fs}")

            current_time = f"⏱️ {position:.2f}s / {data.shape[1] / fs:.2f}s"

            if viewer_type == 'continuous':
                traces = generate_continuous_graph_data(
                    data, fs, position, channels, zoom, PURPLE_COLORS, ECG_LEAD_NAMES
                )
                layout = {
                    'title': '📈 Continuous Time Signal Viewer (ECG)',
                    'xaxis_title': 'Time (s)',
                    'yaxis_title': 'Amplitude (mV)',
                    'template': 'plotly_white',
                    'plot_bgcolor': '#f8f9ff',
                    'height': 600
                }

            elif viewer_type == 'xor':
                traces = generate_xor_graph_data(
                    data, fs, position, channels, chunk_duration, PURPLE_COLORS, ECG_LEAD_NAMES
                )
                layout = {
                    'title': f'⚡ XOR Difference Graph (Chunk: {chunk_duration}s)',
                    'xaxis_title': 'Time within beat (s)',
                    'yaxis_title': 'Difference Amplitude (mV)',
                    'template': 'plotly_white',
                    'plot_bgcolor': '#f8f9ff',
                    'height': 600
                }

            elif viewer_type == 'polar':
                print(f"Generating polar graph - mode: {polar_mode}, is_ecg: True")
                traces = generate_polar_graph_data(
                    data, fs, position, channels, zoom, polar_mode, PURPLE_COLORS, ECG_LEAD_NAMES, is_ecg=True
                )
                mode_title = 'Cycles' if polar_mode == 'cycles' else polar_mode.capitalize()
                layout = {
                    'title': f'🎯 Polar Graph ({mode_title})',
                    'polar': {'radialaxis': {'visible': True}},
                    'height': 600
                }

            elif viewer_type == 'recurrence':
                recurrence_data = generate_recurrence_graph_data(
                    data, fs, position, channels, zoom, rec_ch_x, rec_ch_y, colormap
                )
                if recurrence_data:
                    traces = [recurrence_data]
                    layout = {
                        'title': f'📊 Recurrence: {ECG_LEAD_NAMES[rec_ch_x]} vs {ECG_LEAD_NAMES[rec_ch_y]}',
                        'xaxis_title': f'Lead {ECG_LEAD_NAMES[rec_ch_x]}',
                        'yaxis_title': f'Lead {ECG_LEAD_NAMES[rec_ch_y]}',
                        'plot_bgcolor': '#f8f9ff',
                        'height': 600
                    }
                else:
                    traces = []
                    layout = {'title': 'Error generating recurrence plot'}
            else:
                traces = []
                layout = {'title': 'Unknown viewer type'}

            print(f"Generated {len(traces)} traces")

            response_data = {
                'traces': traces,
                'layout': layout,
                'current_time': current_time,
                'success': True
            }

            return Response(response_data)

        except Exception as e:
            import traceback
            print("=== ERROR in ECGGraphView ===")
            print(traceback.format_exc())
            return Response({
                'error': str(e),
                'success': False
            }, status=400)