# backend/api/urls.py

from django.urls import path
from .views.drone_views import DroneDetectionView, WaveformChunkView

urlpatterns = [
    # For the initial upload, prediction, and spectrogram
    path('drone/detect/', DroneDetectionView.as_view(), name='detect-drone'),
    
    # For fetching subsequent waveform chunks for animation
    path('drone/waveform-chunk/', WaveformChunkView.as_view(), name='waveform-chunk'),
    

]