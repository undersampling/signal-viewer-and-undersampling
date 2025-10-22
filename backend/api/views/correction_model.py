# your_app/views/correction_model.py

import torch
import os
from voicefixer import VoiceFixer
import librosa
import numpy as np       # <-- ADD THIS
import soundfile as sf   # <-- ADD THIS

# --- Global Model Cache ---
VOICE_FIXER_MODEL = None
MIN_SAMPLES = 2048 # The model needs at least this many samples

def load_voicefixer_model():
    """Loads the VoiceFixer model into the global cache."""
    global VOICE_FIXER_MODEL
    if VOICE_FIXER_MODEL is None:
        try:
            print("--- Loading VoiceFixer model (this may take a moment)... ---")
            VOICE_FIXER_MODEL = VoiceFixer() 
            print("--- ✅ VoiceFixer model loaded successfully. ---")
        except Exception as e:
            print(f"--- ❌ Error loading VoiceFixer model: {e} ---")
            VOICE_FIXER_MODEL = None

def fix_aliasing(input_path, output_path):
    """
    Runs the VoiceFixer anti-aliasing process on an audio file.
    """
    if VOICE_FIXER_MODEL is None:
        load_voicefixer_model()
        if VOICE_FIXER_MODEL is None:
            raise Exception("VoiceFixer model is not loaded. Check server logs.")

    # --- UPDATED VALIDATION AND PADDING STEP ---
    try:
        print(f"--- Validating and padding audio file: {input_path} ---")
        
        # Load the audio file
        y, sr = librosa.load(input_path, sr=None, mono=True)
        num_samples = len(y)
        print(f"--- Audio file has {num_samples} samples. ---")
        
        # 1. Check if it's too short overall
        if num_samples < MIN_SAMPLES:
            raise ValueError(
                f"Audio file is too short ({num_samples} samples) to be processed. "
                f"The model requires at least {MIN_SAMPLES} samples. "
                f"Try using a higher resample rate."
            )
        
        # 2. Pad the end with silence to prevent small final chunks
        #    We add MIN_SAMPLES (2048) of silence.
        padding_duration = MIN_SAMPLES
        
        # Create an array of zeros (silence)
        # Use the same dtype as the loaded audio (float32)
        padding = np.zeros(padding_duration, dtype=np.float32)
        
        # Add the padding to the end of the audio
        y_padded = np.concatenate([y, padding])
        
        print(f"--- Padded audio to {len(y_padded)} samples. ---")
        
        # 3. Save this new padded file *over the original temp file*
        #    We use soundfile.write for this
        sf.write(input_path, y_padded, sr)
        print(f"--- Overwrote temp file with padded version. ---")

    except Exception as e:
        # Re-raise as a specific, catchable error
        raise ValueError(f"Error loading or validating audio file: {e}")
    # --- END VALIDATION AND PADDING ---

    print(f"--- Running anti-aliasing on PADDED file: {input_path} ---")
    
    # This part is the same as before
    # It will now use the padded file we just saved
    VOICE_FIXER_MODEL.restore(
        input=input_path,
        output=output_path,
        cuda=torch.cuda.is_available(), 
        mode=0
    )
    print(f"--- Corrected file saved to {output_path} ---")

# --- Call load_model() on server start ---
load_voicefixer_model()