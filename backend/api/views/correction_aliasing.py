from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
import tempfile
import os
import base64
import logging

# Import your pre-loaded model
from .correction_model import VOICEFIXER_MODEL, IS_CUDA_AVAILABLE

logger = logging.getLogger(__name__)

class CorrectAliasingView(APIView):
    """
    API endpoint to correct aliasing using VoiceFixer.
    Expects a multipart-form upload with a file named 'audio_file'.
    Returns a JSON object with a base64 data URI: {"corrected_audio": "data:..."}
    """
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        # Check if model is loaded
        if not VOICEFIXER_MODEL:
            logger.error("VoiceFixer model is not loaded. Cannot process request.")
            return Response(
                {"error": "Audio correction service is currently unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # Check for file
        if 'audio_file' not in request.data:
            return Response({"error": "No audio file provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        audio_file = request.data['audio_file']
        
        input_path = None
        output_path = None
        
        try:
            # 1. Create a temporary file for the uploaded audio
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_in:
                for chunk in audio_file.chunks():
                    tmp_in.write(chunk)
                input_path = tmp_in.name
            
            # 2. Create a temporary path for the output file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_out:
                output_path = tmp_out.name
            
            logger.info(f"Running VoiceFixer on {input_path}")
            
            # 3. Run VoiceFixer model
            VOICEFIXER_MODEL.restore(
                input=input_path,
                output=output_path,
                cuda=IS_CUDA_AVAILABLE,
                mode=0  # mode=0 for general speech restoration
            )
            
            # 4. Read the enhanced file and convert to base64 data URI
            with open(output_path, 'rb') as f:
                encoded_audio = base64.b64encode(f.read()).decode('utf-8')
            
            # VoiceFixer outputs 44.1kHz WAV by default
            data_uri = f"data:audio/wav;base64,{encoded_audio}"
            
            # 5. Return the successful response
            return Response({"corrected_audio": data_uri}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error during audio correction: {str(e)}")
            return Response({"error": f"Error during correction: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        finally:
            # 6. Clean up temporary files
            if input_path and os.path.exists(input_path):
                os.remove(input_path)
            if output_path and os.path.exists(output_path):
                os.remove(output_path)