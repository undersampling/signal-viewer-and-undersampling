# backend/api/urls.py

from django.urls import path
from .views.drone_views import DroneDetectionView, WaveformChunkView, ResampleAudioView

urlpatterns = [
    # For the initial upload, prediction, and spectrogram
    path('drone/detect/', DroneDetectionView.as_view(), name='detect-drone'),
    
    # For fetching subsequent waveform chunks for animation
    path('drone/waveform-chunk/', WaveformChunkView.as_view(), name='waveform-chunk'),
    
    # For resampling the audio to a new sample rate
    path('drone/resample/', ResampleAudioView.as_view(), name='resample-audio'),
]