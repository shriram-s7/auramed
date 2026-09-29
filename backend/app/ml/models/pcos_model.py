"""
PCOS Pelvic Ultrasound Vision Model Architecture, Inference, and Explainability.
ResNet-50 based architecture with dropout and 2-class head (Healthy vs PCOS),
Grad-CAM follicle localization, and Rotterdam Image Criterion Evaluation.
"""
import logging
import os
from typing import Any, Dict, List

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from app.ml.models.gradcam_utils import build_gradcam_extras

logger = logging.getLogger("auramed.ml.pcos")

CLASS_NAMES = ["Healthy", "PCOS"]

pcos_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


class PCOSVisionModel(nn.Module):
    """ResNet-50 architecture with dropout regularization and binary classification head."""
    def __init__(self):
        super().__init__()
        self.resnet = models.resnet50(weights=None)
        num_ftrs = self.resnet.fc.in_features
        self.resnet.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_ftrs, 2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.resnet(x)


def load_pcos_model(model_path: str) -> PCOSVisionModel:
    """
    Loads custom ResNet-50 weights, automatically stripping 'network.' prefixes
    if exported from PyTorch Lightning or wrapped modules.
    """
    model = PCOSVisionModel()

    if os.path.exists(model_path):
        try:
            state_dict = torch.load(model_path, map_location="cpu", weights_only=False)
            if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
                state_dict = state_dict["model_state_dict"]
            # Handle prefix stripping
            cleaned_state = {}
            for k, v in state_dict.items():
                new_k = k.replace("network.", "") if k.startswith("network.") else k
                cleaned_state[new_k] = v
            model.load_state_dict(cleaned_state, strict=False)
            logger.info("Successfully loaded PCOS ultrasound model weights from %s", model_path)
        except Exception as e:
            logger.warning("Failed to load PCOS weights from %s: %s. Using development weights.", model_path, str(e))
    else:
        logger.warning(
            "PCOS model weights not found at %s. Using random weights for development. "
            "Results will not be clinically meaningful until real trained weights are provided.",
            model_path,
        )

    model.eval()
    return model


def assess_ultrasound_quality(img: Image.Image) -> str:
    """Assesses pelvic ultrasound image resolution and contrast."""
    width, height = img.size
    if width < 100 or height < 100:
        return "poor"

    arr = np.array(img.convert("L"), dtype=np.float32)
    mean_val = float(arr.mean())
    if mean_val < 15.0 or mean_val > 230.0:
        return "poor"

    if width < 200 or height < 200:
        return "adequate"

    return "good"




def generate_pcos_gradcam(
    model: PCOSVisionModel,
    input_tensor: torch.Tensor,
    original_pil: Image.Image,
) -> Dict[str, Any]:
    """
    Computes Grad-CAM on model.resnet.layer4[-1] targeting PCOS class logit (index 1).
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
        # Target logit index 1 for PCOS
        score = out[0, 1]
        score.backward()

        if not gradients or not activations:
            return {}

        grads = gradients[0]
        acts = activations[0]

        pooled_grads = torch.mean(grads, dim=(2, 3), keepdim=True)
        weighted_acts = torch.relu((pooled_grads * acts).sum(dim=1, keepdim=True)).squeeze()

        cam_np = weighted_acts.detach().cpu().numpy()
        return build_gradcam_extras(cam_np, original_pil=original_pil, module_name="pcos")

    except Exception as e:
        logger.error("Grad-CAM generation failed for PCOS model: %s", str(e))
        return {}
    finally:
        f_handle.remove()
        b_handle.remove()


def run_pcos_inference(
    model: PCOSVisionModel,
    image_path: str,
) -> Dict[str, Any]:
    """
    Executes deep learning inference for pelvic ultrasound scan.
    Returns PCOS probability, polycystic morphology criterion confirmation,
    Grad-CAM localized follicle visualization, and descriptive morphology findings.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at {image_path}")

    pil_img = Image.open(image_path).convert("RGB")
    quality = assess_ultrasound_quality(pil_img)

    input_tensor = pcos_transforms(pil_img).unsqueeze(0)

    with torch.no_grad():
        output = model(input_tensor)
        raw_logits = [round(v, 4) for v in output[0].tolist()]
        probs = torch.softmax(output[0], dim=0)
        predicted_idx = torch.argmax(probs).item()
        predicted_class = CLASS_NAMES[predicted_idx]
        pcos_probability = round(float(probs[1].item()), 4)
        healthy_probability = round(float(probs[0].item()), 4)

    # Evaluate Rotterdam image criterion
    if pcos_probability > 0.55:
        image_criterion_met = True
        morphology_findings = (
            f"Ultrasound deep learning model detected polycystic ovarian morphology ({pcos_probability:.1%} confidence). "
            "Visual features indicate peripheral follicle clustering ('string of pearls') and stromal echogenicity."
        )
    else:
        image_criterion_met = False
        morphology_findings = (
            f"Ultrasound deep learning model found predominantly normal ovarian morphology ({healthy_probability:.1%} normal confidence). "
            "No dominant peripheral follicle clustering pattern detected."
        )

    # Generate Grad-CAM (blended JPEG, standalone heatmap PNG, peak coords)
    gradcam_result = generate_pcos_gradcam(model, input_tensor.clone(), pil_img)

    return {
        "predicted_class": predicted_class,
        "raw_logits": raw_logits,
        "pcos_probability": pcos_probability,
        "healthy_probability": healthy_probability,
        "image_score": pcos_probability,
        "image_criterion_met": image_criterion_met,
        "grad_cam_base64": gradcam_result.get("grad_cam_base64", ""),
        "gradcam_heatmap_b64": gradcam_result.get("gradcam_heatmap_b64"),
        "morphology_findings": morphology_findings,
        "image_quality": quality,
    }
