"""
Shared Grad-CAM / attention-rollout post-processing helpers used by the
breast, cervical, and PCOS vision models.

Single source of truth for turning a raw, small (e.g. 7x7 or 14x14) saliency
map into a 224x224 JET-colormapped heatmap and (optionally) a heatmap-blended
JPEG of the original scan.

Note: this deliberately does NOT compute or return a peak-attention
coordinate. An argmax-based single-point "peak" was previously derived here
and rendered as a circle on the frontend, but the coordinate mapping between
model input space (224x224) and display space was unreliable, and a wrong
point on a clinical image is worse than none - so it was removed rather than
fixed. The heatmap overlay itself remains the source of truth for where the
model's attention is concentrated.
"""
import base64
import io
from typing import Any, Dict, Optional

import cv2
import numpy as np
from PIL import Image

GRADCAM_SIZE = 224


def build_gradcam_extras(
    cam_raw: np.ndarray,
    original_pil: Optional[Image.Image] = None,
    module_name: str = "model",
) -> Dict[str, Any]:
    """
    cam_raw: 2D numpy array, RAW (un-normalized, NOT pre-resized) saliency map
    straight off the model (e.g. the 7x7 Grad-CAM activation map for a
    ResNet-50, or the 14x14 attention-rollout grid for a ViT). Any 2D shape.

    module_name: unused by this function directly; kept in the signature for
    call-site consistency with other diagnostics in the inference pipeline.

    Returns:
        {
            "gradcam_heatmap_b64": "<base64 PNG, 224x224 JET colormap>",
            "grad_cam_base64": "<base64 JPEG, heatmap blended onto original>",
                                 (only present if original_pil is given)
        }
    """
    cam = cam_raw.astype(np.float32)
    cam_min, cam_max = float(cam.min()), float(cam.max())
    cam_norm = (cam - cam_min) / (cam_max - cam_min + 1e-8)

    # Single resize, straight to display size. No flip, no transpose -
    # row/col order is preserved throughout so (row, col) == (y, x).
    cam_resized = cv2.resize(cam_norm, (GRADCAM_SIZE, GRADCAM_SIZE), interpolation=cv2.INTER_LINEAR)
    cam_resized = np.clip(cam_resized, 0.0, 1.0)

    colored_bgr = cv2.applyColorMap((cam_resized * 255.0).astype(np.uint8), cv2.COLORMAP_JET)
    colored_rgb = cv2.cvtColor(colored_bgr, cv2.COLOR_BGR2RGB)

    buf = io.BytesIO()
    Image.fromarray(colored_rgb).save(buf, format="PNG")
    heatmap_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    result: Dict[str, Any] = {"gradcam_heatmap_b64": heatmap_b64}

    if original_pil is not None:
        orig_resized = np.array(original_pil.resize((GRADCAM_SIZE, GRADCAM_SIZE)).convert("RGB"), dtype=np.float32)
        blended = np.clip(0.6 * orig_resized + 0.4 * colored_rgb.astype(np.float32), 0, 255).astype(np.uint8)
        blend_buf = io.BytesIO()
        Image.fromarray(blended).save(blend_buf, format="JPEG", quality=85)
        result["grad_cam_base64"] = base64.b64encode(blend_buf.getvalue()).decode("utf-8")

    return result
