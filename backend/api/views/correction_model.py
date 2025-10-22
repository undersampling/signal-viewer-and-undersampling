import torch
from voicefixer import VoiceFixer
import logging

logger = logging.getLogger(__name__)

def load_voicefixer():
    """
    Tries to load the VoiceFixer model.
    Returns the model instance or None if it fails.
    """
    try:
        logger.info("Loading VoiceFixer model...")
        model = VoiceFixer() 
        logger.info("✅ VoiceFixer model loaded successfully.")
        return model
    except Exception as e:
        logger.critical(f"CRITICAL ERROR: Failed to load VoiceFixer model: {e}")
        return None

# Load the model on server startup
VOICEFIXER_MODEL = load_voicefixer()

# Check for GPU
IS_CUDA_AVAILABLE = torch.cuda.is_available()
if IS_CUDA_AVAILABLE:
    logger.info("CUDA is available. VoiceFixer will use GPU.")
else:
    logger.info("CUDA not available. VoiceFixer will use CPU.")