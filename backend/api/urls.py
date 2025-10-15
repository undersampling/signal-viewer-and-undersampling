# backend/api/urls.py

from django.urls import path

from .views.doppler_views import generate_doppler, upload_doppler, simulate_passing, predict_doppler
from .views.sar_views import upload_sar
from .views.drone_views import DroneDetectionView, WaveformChunkView

urlpatterns = [
    # For the initial upload, prediction, and spectrogram
    path('drone/detect/', DroneDetectionView.as_view(), name='detect-drone'),
    
    # For fetching subsequent waveform chunks for animation
    path('drone/waveform-chunk/', WaveformChunkView.as_view(), name='waveform-chunk'),

    path('generate/', generate_doppler, name='generate_doppler'),
    path('doppler/upload/', upload_doppler, name='doppler_upload'),
    path('doppler/generate/', generate_doppler, name='doppler_generate'),
    path('doppler/simulate/', simulate_passing, name='doppler_simulate'),
    path('doppler/predict/', predict_doppler, name='doppler_predict'),

    # SAR endpoints
    path('sar/upload/', upload_sar, name='sar_upload'),

]