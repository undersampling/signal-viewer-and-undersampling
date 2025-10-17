from django.urls import path
from .views import (
    EEGDemoView,
    EEGUploadView,
    EEGGraphView,
    ECGDemoView,
    ECGUploadView,
    ECGWFDBUploadView,
    ECGGraphView
)

urlpatterns = [
    # EEG endpoints
    path('api/eeg/demo/', EEGDemoView.as_view(), name='eeg-demo'),
    path('api/eeg/upload/', EEGUploadView.as_view(), name='eeg-upload'),
    path('api/eeg/graph/', EEGGraphView.as_view(), name='eeg-graph'),

    # ECG endpoints
    path('api/ecg/demo/', ECGDemoView.as_view(), name='ecg-demo'),
    path('api/ecg/upload/', ECGUploadView.as_view(), name='ecg-upload'),
    path('api/ecg/wfdb/', ECGWFDBUploadView.as_view(), name='ecg-wfdb'),
    path('api/ecg/graph/', ECGGraphView.as_view(), name='ecg-graph'),
]