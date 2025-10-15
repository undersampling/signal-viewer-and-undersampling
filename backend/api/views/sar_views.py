from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
import base64
import io
import numpy as np
import rasterio
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from skimage.feature import graycomatrix, graycoprops


def _stretch_image(image, lower_percent=2, upper_percent=98):
    image = image.astype(np.float32)
    finite = np.isfinite(image)
    if not np.any(finite):
        return np.zeros_like(image, dtype=np.float32)
    p_low, p_high = np.percentile(image[finite], (lower_percent, upper_percent))
    if p_high == p_low:
        return np.zeros_like(image, dtype=np.float32)
    return np.clip((image - p_low) / (p_high - p_low), 0, 1).astype(np.float32)


def _extract_features(band):
    mean_val = float(np.mean(band))
    std_val = float(np.std(band))
    contrast = float(np.max(band) - np.min(band))
    snr = float(mean_val / (std_val + 1e-8))

    # Convert to 8-bit for texture features (avoid divide by zero)
    band_min, band_max = float(np.min(band)), float(np.max(band))
    if band_max - band_min > 0:
        band_8bit = ((band - band_min) / (band_max - band_min) * 255.0).astype(np.uint8)
    else:
        band_8bit = np.zeros_like(band, dtype=np.uint8)

    glcm = graycomatrix(band_8bit, distances=[1], angles=[0], levels=256, symmetric=True, normed=True)
    entropy = float(-np.sum(glcm * np.log2(glcm + 1e-10)))
    homogeneity = float(graycoprops(glcm, 'homogeneity')[0, 0])
    contrast_glcm = float(graycoprops(glcm, 'contrast')[0, 0])

    return {
        "Mean Intensity": round(mean_val, 3),
        "Std Deviation": round(std_val, 3),
        "Contrast": round(contrast, 3),
        "SNR": round(snr, 3),
        "Entropy": round(entropy, 3),
        "Homogeneity": round(homogeneity, 3),
        "GLCM Contrast": round(contrast_glcm, 3),
    }


def _parse_tif_from_data_uri(contents):
    content_type, content_string = contents.split(",")
    decoded = base64.b64decode(content_string)

    with rasterio.MemoryFile(decoded) as memfile:
        with memfile.open() as src:
            bands = src.count
            if bands >= 3:
                img = np.dstack([src.read(i) for i in (1, 2, 3)])
                display_band = np.mean(img, axis=2)
            else:
                display_band = src.read(1)

            display_band = np.nan_to_num(display_band)
            stretched = _stretch_image(display_band)
            features = _extract_features(stretched)

            # Plot
            fig, ax = plt.subplots(figsize=(8, 8))
            ax.imshow(stretched, cmap="gray")
            ax.set_title("SAR Image (Stretched)")
            ax.axis("off")

            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0)
            plt.close(fig)
            buf.seek(0)
            encoded = base64.b64encode(buf.read()).decode("utf-8")

    return f"data:image/png;base64,{encoded}", features


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def upload_sar(request):
    try:
        # Accept multipart file 'image' or JSON data URI 'contents'
        if 'image' in request.FILES:
            image_file = request.FILES['image']
            data = image_file.read()
            src = "data:application/octet-stream;base64," + base64.b64encode(data).decode('ascii')
        else:
            contents = request.data.get('contents')
            if not contents:
                return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)
            src = contents

        image_uri, features = _parse_tif_from_data_uri(src)
        return Response({'image_uri': image_uri, 'features': features})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


