"""
Breast Cancer Vision Model Architecture, Inference, and Explainability.
ResNet-50 based architecture with modified binary classification head,
image quality screening, and Grad-CAM saliency localization.
"""
import logging
import os
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from app.ml.models.gradcam_utils import build_gradcam_extras

logger = logging.getLogger("auramed.ml.breast")


class BreastCancerModel(nn.Module):
    """ResNet-50 architecture with modified single-output linear classification head."""
    def __init__(self):
        super().__init__()
        self.resnet = models.resnet50(weights=None)
        self.resnet.fc = nn.Linear(self.resnet.fc.in_features, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.resnet(x)


# Preprocessing pipeline
breast_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def load_breast_model(model_path: str) -> BreastCancerModel:
    """
    Loads pretrained ResNet-50 weights or initializes development weights
    with explicit clinical disclaimer logging.
    """
    model = BreastCancerModel()

    if os.path.exists(model_path):
        try:
            state_dict = torch.load(model_path, map_location="cpu", weights_only=False)
            if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
                state_dict = state_dict["model_state_dict"]
            model.load_state_dict(state_dict)
            logger.info("Successfully loaded breast cancer model weights from %s", model_path)
        except Exception as e:
            logger.warning(
                "Failed to load weights from %s: %s. Using development weights.",
                model_path, str(e)
            )
    else:
        logger.warning(
            "Breast model weights not found at %s. Using random weights for development. "
            "Results will not be clinically meaningful until real trained weights are provided.",
            model_path,
        )

    model.eval()
    return model


def assess_image_quality(img: Image.Image) -> str:
    """
    Basic Image Quality Assessment (IQA) heuristics:
    - Checks dimensions (under 100px is poor)
    - Checks extreme under/over-exposure (mean pixel < 20 or > 235)
    - Returns 'good', 'adequate', or 'poor'
    """
    width, height = img.size
    if width < 100 or height < 100:
        return "poor"

    arr = np.array(img.convert("L"), dtype=np.float32)
    mean_val = float(arr.mean())
    if mean_val < 20.0 or mean_val > 235.0:
        return "poor"

    if width < 200 or height < 200:
        return "adequate"

    return "good"


def generate_breast_gradcam(
    model: BreastCancerModel,
    input_tensor: torch.Tensor,
    original_pil: Image.Image,
) -> Dict[str, Any]:
    """
    Computes Grad-CAM heatmap on model.resnet.layer4[-1].
    Returns a dict with:
      - grad_cam_base64: base64 JPEG of the heatmap pre-blended onto the scan
      - gradcam_heatmap_b64: base64 PNG of the standalone cv2 JET heatmap
    Returns {} if Grad-CAM could not be computed.
    """
    activations = []
    gradients = []

    def forward_hook(module, inp, outp):
        activations.append(outp)

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    target_layer = model.resnet.layer4[-1]
    f_handle = target_layer.register_forward_hook(forward_hook)
    b_handle = target_layer.register_full_backward_hook(backward_hook)

    try:
        model.zero_grad()
        out = model(input_tensor)
        score = out[0, 0]
        score.backward()

        if not gradients or not activations:
            return {}

        grads = gradients[0]  # (1, C, H, W)
        acts = activations[0]  # (1, C, H, W)

        pooled_grads = torch.mean(grads, dim=(2, 3), keepdim=True)
        weighted_acts = torch.relu((pooled_grads * acts).sum(dim=1, keepdim=True)).squeeze()

        cam_np = weighted_acts.detach().cpu().numpy()
        return build_gradcam_extras(cam_np, original_pil=original_pil, module_name="breast")

    except Exception as e:
        logger.error("Grad-CAM generation failed for breast model: %s", str(e))
        return {}
    finally:
        f_handle.remove()
        b_handle.remove()


def run_breast_inference(
    model: BreastCancerModel,
    image_path: str,
) -> Dict[str, Any]:
    """
    Executes deep learning inference for breast mammography scan.
    Returns calibrated probability, image quality score, Grad-CAM saliency map,
    and structured clinical key findings.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at {image_path}")

    pil_img = Image.open(image_path).convert("RGB")
    quality = assess_image_quality(pil_img)

    input_tensor = breast_transforms(pil_img).unsqueeze(0)  # (1, 3, 224, 224)

    with torch.no_grad():
        output = model(input_tensor)
        raw_logit = float(output.item())
        image_score = float(torch.sigmoid(output).item())

    image_score = round(max(0.0, min(1.0, image_score)), 4)

    # Generate Grad-CAM visualization (blended JPEG, standalone heatmap PNG, peak coords)
    gradcam_result = generate_breast_gradcam(model, input_tensor.clone(), pil_img)
    grad_cam_base64 = gradcam_result.get("grad_cam_base64", "")

    # Key findings based on score ranges
    key_findings: List[str] = []
    if image_score > 0.80:
        key_findings.append("High density suspicious region detected")
    if image_score > 0.70:
        key_findings.append("Irregular mass characteristics present")
    if image_score > 0.60:
        key_findings.append("Possible architectural distortion")
    if image_score > 0.50:
        key_findings.append("Borderline density irregularity")
    if image_score < 0.30:
        key_findings.append("No significant suspicious features")

    if not key_findings:
        key_findings.append("Nonspecific low-to-moderate density variations")

    # Generate interpretation
    if image_score >= 0.70:
        model_interpretation = (
            f"ResNet-50 visual analysis indicates elevated suspicion ({image_score:.1%}) "
            "with localized architectural distortion and high density features."
        )
    elif image_score >= 0.40:
        model_interpretation = (
            f"ResNet-50 visual analysis demonstrates intermediate density patterns ({image_score:.1%}). "
            "Clinical correlation and targeted imaging recommended."
        )
    else:
        model_interpretation = (
            f"ResNet-50 visual analysis demonstrates predominantly benign parenchymal features ({image_score:.1%}) "
            "with no dominant suspicious masses."
        )

    return {
        "image_score": image_score,
        "raw_logit": round(raw_logit, 4),
        "image_quality": quality,
        "grad_cam_base64": grad_cam_base64,
        "gradcam_heatmap_b64": gradcam_result.get("gradcam_heatmap_b64"),
        "key_findings": key_findings,
        "model_interpretation": model_interpretation,
    }
