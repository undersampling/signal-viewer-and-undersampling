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
import tempfile
import librosa
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def downsample_audio(request):
    try:
        file = request.FILES.get('file')
        new_rate_str = request.data.get('new_rate', '0')
        
        if not file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file_ext = file.name.lower().split('.')[-1]
        if file_ext not in ['wav', 'mp3']:
            return Response({'error': 'Only WAV and MP3 files are supported.'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            new_rate = int(new_rate_str)
        except ValueError:
            return Response({'error': 'Invalid sample rate'}, status=status.HTTP_400_BAD_REQUEST)

        file.seek(0)
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp_file:
            tmp_file.write(file.read())
            tmp_path = tmp_file.name
        
        try:
            # Load audio (optimize based on format)
            if file_ext == 'wav':
                rate, samples = wavfile.read(tmp_path)
                if len(samples.shape) > 1:
                    samples = samples[:, 0]  # Convert to mono
                samples = samples.astype(float) / 32768
            else:
                samples, rate = librosa.load(tmp_path, sr=None, mono=True)
            
            if new_rate <= 0:
                new_rate = rate // 2
            if new_rate >= rate:
                new_rate = rate

            # Faster resampling with scipy
            num_samples = int(len(samples) * new_rate / rate)
            new_signal = resample(samples, num_samples)

            def audio_to_base64(signal, sample_rate):
                buffer = io.BytesIO()
                with wave.open(buffer, 'wb') as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(sample_rate)
                    audio_data = np.clip(signal * 32767, -32768, 32767).astype(np.int16)
                    wf.writeframes(audio_data.tobytes())
                buffer.seek(0)
                return base64.b64encode(buffer.getvalue()).decode('utf-8')

            original_b64 = audio_to_base64(samples, rate)
            down_b64 = audio_to_base64(new_signal, new_rate)

            return Response({
                'original_rate': int(rate),
                'new_rate': new_rate,
                'original_audio': f"data:audio/wav;base64,{original_b64}",
                'downsampled_audio': f"data:audio/wav;base64,{down_b64}",
            })
        
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)