# your_app/views/correction_aliasing.py

from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.files.storage import FileSystemStorage
import os
import uuid
import base64
import io
import wave
import numpy as np

# Import the core logic from your new model file
try:
    from .correction_model import fix_aliasing
except ImportError:
    # Handle potential import error if structure is different
    print("Warning: Could not import fix_aliasing. Check your Python path.")
    def fix_aliasing(in_path, out_path):
        raise ImportError("fix_aliasing function not loaded")

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def correct_aliasing_view(request):

    audio_file = request.FILES.get('audio_file')
    if not audio_file:
        return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)

    fs = FileSystemStorage(location=settings.TEMP_FILE_ROOT)
    temp_in_name = None
    temp_out_path = None

    try:
        # --- 1. Save temporary INPUT file ---
        file_id = f"{uuid.uuid4()}{os.path.splitext(audio_file.name)[1]}"
        temp_in_name = fs.save(file_id, audio_file)
        temp_in_path = fs.path(temp_in_name)

        # --- 2. Define temporary OUTPUT path ---
        temp_out_name = f"{uuid.uuid4()}.wav"
        temp_out_path = os.path.join(settings.TEMP_FILE_ROOT, temp_out_name)

        # --- 3. Run the Model ---
        # This will now raise ValueError if the file is too short
        fix_aliasing(temp_in_path, temp_out_path)

        # --- 4. Read the corrected (output) file ---
        if not os.path.exists(temp_out_path):
            return Response({'error': 'Correction failed, output file not created.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        with open(temp_out_path, 'rb') as f:
            output_data = f.read()

        # --- 5. Encode to Base64 ---
        corrected_b64 = base64.b64encode(output_data).decode('utf-8')

        # --- 6. Return Data URI ---
        return Response({
            'corrected_audio': f"data:audio/wav;base64,{corrected_b64}"
        }, status=status.HTTP_200_OK)

    # --- ADD THIS ERROR CATCH ---
    except ValueError as ve:
        # This is for errors we raised intentionally (like file too short)
        print(f"Validation Error: {ve}")
        return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        # This is for unexpected server errors
        import traceback
        traceback.print_exc() # Print full error to server console
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    finally:
        # --- 7. Cleanup ---
        try:
            if temp_in_name and fs.exists(temp_in_name):
                fs.delete(temp_in_name)
            if temp_out_path and os.path.exists(temp_out_path):
                os.remove(temp_out_path)
        except Exception as e:
            print(f"Error during cleanup: {e}")