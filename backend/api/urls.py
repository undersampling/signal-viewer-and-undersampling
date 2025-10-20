

from django.urls import path

# Import all the necessary views from your different view files
from .views.drone_views import DroneDetectionView, WaveformChunkView
from .views.doppler_views import upload_doppler, generate_doppler, simulate_passing, predict_doppler 
from .views.sar_views import upload_sar
from .views.audio import downsample_audio
from .views.ecg_views import (
    EEGDemoView,
    EEGUploadView,
    EEGGraphView,
    ECGDemoView,
    ECGUploadView,
    ECGWFDBUploadView,
    ECGGraphView,
)



urlpatterns = [
    # Drone URLs
    path('drone/detect/', DroneDetectionView.as_view(), name='detect-drone'),
    path('drone/waveform-chunk/', WaveformChunkView.as_view(), name='waveform-chunk'),
    

    # Doppler URLs
    path('doppler/upload/', upload_doppler, name='doppler-upload'),
    path('doppler/generate/', generate_doppler, name='doppler-generate'),
    path('doppler/simulate/', simulate_passing, name='doppler-simulate'),
    path('doppler/predict/', predict_doppler, name='doppler-predict'),
    


    # SAR URL
    path('sar/upload/', upload_sar, name='sar-upload'),
    
    # General Audio URL
    path('audio/downsample/', downsample_audio, name='downsample-audio'),

    # EEG URLs
    path('eeg/demo/', EEGDemoView.as_view(), name='eeg-demo'),
    path('eeg/upload/', EEGUploadView.as_view(), name='eeg-upload'),
    path('eeg/graph/', EEGGraphView.as_view(), name='eeg-graph'),

    # ECG URLs
    path('ecg/demo/', ECGDemoView.as_view(), name='ecg-demo'),
    path('ecg/upload/', ECGUploadView.as_view(), name='ecg-upload'),
    path('ecg/wfdb/', ECGWFDBUploadView.as_view(), name='ecg-wfdb-upload'),
    path('ecg/graph/', ECGGraphView.as_view(), name='ecg-graph'),
]

