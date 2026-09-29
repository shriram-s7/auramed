"""
Cervical Cancer Vision Model Architecture and Inference.
Vision Transformer (ViT-Base-Patch16-224) via timm for 5-class Pap smear cytology classification,
Bethesda System mapping, and probability distributions.
"""
import logging
import os
from typing import Any, Dict, List

import numpy as np
import timm
import torch
from PIL import Image
from torchvision import transforms

from app.ml.models.gradcam_utils import build_gradcam_extras

logger = logging.getLogger("auramed.ml.cervical")

CLASS_NAMES = [
    "Dyskeratotic",
    "Koilocytotic",
    "Metaplastic",
    "Parabasal",
    "Normal",
]

BETHESDA_MAP = {
    "Normal": "NILM (Negative for Intraepithelial Lesion or Malignancy)",
    "Metaplastic": "ASC-US (Atypical Squamous Cells of Undetermined Significance)",
    "Koilocytotic": "LSIL (Low-grade Squamous Intraepithelial Lesion)",
    "Parabasal": "ASC-H (Atypical Squamous Cells, cannot exclude HSIL)",
    "Dyskeratotic": "HSIL (High-grade Squamous Intraepithelial Lesion)",
}

# Per-class risk weight used to turn the softmax distribution into a single
# risk-directional score for fusion, indexed to match CLASS_NAMES:
#   0=Dyskeratotic(HSIL) 1=Koilocytotic(LSIL) 2=Metaplastic(ASC-US)
#   3=Parabasal(ASC-H)   4=Normal(NILM)
# A confident Normal prediction must produce a LOW score, not a high one -
# using raw top-class confidence directly (as before) got this backwards,
# since "confidence the image is Normal" and "risk" point in opposite
# directions. This weighted sum fixes that: 0.0 for pure Normal, 1.0 for
# pure HSIL/Dyskeratotic.
BETHESDA_RISK_WEIGHTS = [1.0, 0.75, 0.50, 0.65, 0.0]

cervical_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def load_cervical_model(model_path: str):
    """
    Creates ViT-Base-Patch16-224 model with 5 output classes.
    Loads weights from disk or logs developer disclaimer.
    """
    model = timm.create_model(
        "vit_base_patch16_224",
        pretrained=False,
        num_classes=5,
    )

    if os.path.exists(model_path):
        try:
            state_dict = torch.load(model_path, map_location="cpu", weights_only=False)
            if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
                state_dict = state_dict["model_state_dict"]
            model.load_state_dict(state_dict)
            logger.info("Successfully loaded cervical cytology ViT weights from %s", model_path)
        except Exception as e:
            logger.warning(
                "Failed to load cervical weights from %s: %s. Using development weights.",
                model_path, str(e),
            )
    else:
        logger.warning(
            "Cervical model weights not found at %s. Using random weights for development. "
            "Results will not be clinically meaningful until real trained weights are provided.",
            model_path,
        )

    model.eval()
    return model


def assess_cervical_quality(img: Image.Image) -> str:
    """Evaluates image dimensions and pixel luminance."""
    width, height = img.size
    if width < 100 or height < 100:
        return "poor"

    arr = np.array(img.convert("L"), dtype=np.float32)
    mean_lum = float(arr.mean())
    if mean_lum < 15.0 or mean_lum > 240.0:
        return "poor"

    if width < 200 or height < 200:
        return "adequate"

    return "good"


def generate_cervical_attention_map(
    model,
    input_tensor: torch.Tensor,
    original_pil: Image.Image,
) -> Dict[str, Any]:
    """
    Computes a ViT attention-rollout saliency map, since standard Grad-CAM does not
    apply cleanly to a transformer's non-spatial-convolutional activations. Averages
    the last transformer block's (model.blocks[-1]) multi-head self-attention weights
    from the CLS token to each patch token, reshapes the 14x14 patch grid (for
    ViT-Base-Patch16-224), and resizes to 224x224.

    Returns a dict with:
      - grad_cam_base64: base64 JPEG of the heatmap pre-blended onto the scan
      - gradcam_heatmap_b64: base64 PNG of the standalone cv2 JET heatmap
    Returns {} if the attention weights could not be captured.
    """
    attn_module = model.blocks[-1].attn
    captured: Dict[str, torch.Tensor] = {}

    def _capture_attn(module, args):
        captured["attn"] = args[0]

    # Force the eager softmax attention path (fused SDPA never materializes weights).
    prev_fused = getattr(attn_module, "fused_attn", None)
    if prev_fused is not None:
        attn_module.fused_attn = False

    handle = attn_module.attn_drop.register_forward_pre_hook(_capture_attn)

    try:
        with torch.no_grad():
            model(input_tensor)

        attn = captured.get("attn")
        if attn is None:
            return {}

        # (B, heads, N, N) -> average over heads -> (N, N)
        attn_avg = attn.mean(dim=1)[0]

        # CLS token (index 0) attention to every patch token
        cls_to_patches = attn_avg[0, 1:]
        num_patches = cls_to_patches.shape[0]
        grid_size = int(round(num_patches ** 0.5))
        if grid_size * grid_size != num_patches:
            return {}

        attn_grid = cls_to_patches.reshape(grid_size, grid_size).detach().cpu().numpy()
        return build_gradcam_extras(attn_grid, original_pil=original_pil, module_name="cervical")

    except Exception as e:
        logger.error("Attention rollout generation failed for cervical ViT model: %s", str(e))
        return {}
    finally:
        handle.remove()
        if prev_fused is not None:
            attn_module.fused_attn = prev_fused


def run_cervical_inference(model, image_path: str) -> Dict[str, Any]:
    """
    Executes deep learning inference on cervical smear image.
    Classifies into one of 5 cytology categories and maps to standard Bethesda terminology.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at {image_path}")

    pil_img = Image.open(image_path).convert("RGB")
    quality = assess_cervical_quality(pil_img)

    input_tensor = cervical_transforms(pil_img).unsqueeze(0)  # (1, 3, 224, 224)

    with torch.no_grad():
        outputs = model(input_tensor)
        raw_logits = [round(v, 4) for v in outputs[0].tolist()]
        probs = torch.softmax(outputs[0], dim=0)
        confidence, predicted_idx = torch.max(probs, 0)
        predicted_class = CLASS_NAMES[predicted_idx.item()]
        all_class_probs = {
            CLASS_NAMES[i]: round(float(probs[i]), 4)
            for i in range(5)
        }

    conf_val = round(float(confidence.item()), 4)
    bethesda_term = BETHESDA_MAP.get(predicted_class, "NILM")

    # Severity-weighted, risk-directional score for fusion - NOT the raw
    # top-class confidence. Top-class confidence answers "how sure is the
    # model of its predicted class", which for a confident Normal prediction
    # is a HIGH number pointing the wrong way for a risk score. This instead
    # answers "how much does the full class distribution indicate risk".
    image_score = round(
        float(sum(float(probs[i]) * BETHESDA_RISK_WEIGHTS[i] for i in range(5))),
        4,
    )
    finding_description = f"{predicted_class} ({bethesda_term})"

    # Generate ViT attention-rollout saliency map (blended JPEG, standalone heatmap PNG, peak coords)
    attn_result = generate_cervical_attention_map(model, input_tensor.clone(), pil_img)

    return {
        "predicted_class": predicted_class,
        "raw_logits": raw_logits,
        "confidence": conf_val,
        "all_class_probabilities": all_class_probs,
        "bethesda_mapping": bethesda_term,
        "finding_description": finding_description,
        "image_score": image_score,
        "image_quality": quality,
        "grad_cam_base64": attn_result.get("grad_cam_base64", ""),
        "gradcam_heatmap_b64": attn_result.get("gradcam_heatmap_b64"),
    }
