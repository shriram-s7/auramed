"""
Temperature Scaling Probability Calibration for Cervical ViT Model.
Optimizes a scalar temperature T on validation logits to minimize multi-class
Negative Log Likelihood (NLL) and Expected Calibration Error (ECE).
Updates cervical_model_metadata.json with calibrated parameters.
"""
import argparse
import json
import os
import sys
from typing import Dict, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import timm
import torch
import torch.nn as nn
from torch.optim import LBFGS
from torch.utils.data import DataLoader

current_dir = os.path.dirname(os.path.abspath(__file__))
training_root = os.path.dirname(current_dir)
if training_root not in sys.path:
    sys.path.insert(0, training_root)

from cervical.augmentations import get_cervical_val_transforms
from cervical.dataset import CLASS_NAMES, SIPaKMeDDataset, prepare_sipakmed, split_dataset


def compute_multiclass_ece(
    probs: np.ndarray,
    labels: np.ndarray,
    n_bins: int = 15,
) -> float:
    """
    Computes Expected Calibration Error (ECE) for multi-class classification
    using maximum confidence predictions.
    """
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels).astype(float)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    total_samples = len(labels)

    for i in range(n_bins):
        bin_lower, bin_upper = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

    return float(ece)


class ModelWithTemperature(nn.Module):
    """
    Applies temperature scaling to logits of a trained classification model.
    """
    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)

    def forward(self, input_tensor: torch.Tensor) -> torch.Tensor:
        logits = self.model(input_tensor)
        return self.temperature_scale(logits)

    def temperature_scale(self, logits: torch.Tensor) -> torch.Tensor:
        temp = self.temperature.unsqueeze(1).expand(logits.size(0), logits.size(1))
        return logits / temp


def calibrate_cervical_model(
    model_path: str,
    data_dir: str,
    device: str = "cuda" if torch.cuda.is_available() else "cpu",
    output_dir: str = os.path.join(training_root, "logs"),
    metadata_path: str = os.path.join(training_root, "weights", "cervical_model_metadata.json"),
) -> float:
    """Performs temperature scaling calibration on validation set."""
    dev = torch.device(device)
    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "=" * 65)
    print(" CERVICAL VI-T TEMPERATURE SCALING CALIBRATION")
    print("=" * 65)

    # 1. Dataset
    image_paths, labels = prepare_sipakmed(data_dir)
    _, _, val_paths, val_labels, _, _ = split_dataset(image_paths, labels, seed=42)

    val_transforms = get_cervical_val_transforms()
    val_dataset = SIPaKMeDDataset(val_paths, val_labels, transform=val_transforms)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=0)
    print(f"Validation calibration set size: {len(val_dataset)} samples")

    # 2. Model
    base_model = timm.create_model("vit_base_patch16_224", pretrained=False, num_classes=5)
    if os.path.exists(model_path):
        checkpoint = torch.load(model_path, map_location=dev)
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        base_model.load_state_dict(state_dict)
        print(f"[+] Loaded weights from: {model_path}")
    else:
        print(f"[!] Checkpoint not found at {model_path}. Proceeding with initialized model.")

    base_model.to(dev)
    base_model.eval()

    # 3. Collect logits and labels
    logits_list = []
    labels_list = []

    with torch.no_grad():
        for images, targets in val_loader:
            images = images.to(dev)
            logits = base_model(images)
            logits_list.append(logits.cpu())
            labels_list.append(targets)

    logits_all = torch.cat(logits_list, dim=0).to(dev)
    labels_all = torch.cat(labels_list, dim=0).to(dev)

    # Metrics before calibration
    nll_criterion = nn.CrossEntropyLoss()
    before_nll = float(nll_criterion(logits_all, labels_all).item())
    before_probs = torch.softmax(logits_all, dim=1).cpu().numpy()
    before_ece = compute_multiclass_ece(before_probs, labels_all.cpu().numpy())

    print(f"Before Calibration -> NLL: {before_nll:.4f} | ECE: {before_ece:.4f}")

    # 4. Optimize Temperature T using L-BFGS
    temp_model = ModelWithTemperature(base_model).to(dev)
    optimizer = LBFGS([temp_model.temperature], lr=0.01, max_iter=50)

    def eval_fn():
        optimizer.zero_grad()
        scaled_logits = temp_model.temperature_scale(logits_all)
        loss = nll_criterion(scaled_logits, labels_all)
        loss.backward()
        return loss

    optimizer.step(eval_fn)
    optimal_t = float(temp_model.temperature.item())

    # Metrics after calibration
    scaled_logits = temp_model.temperature_scale(logits_all)
    after_nll = float(nll_criterion(scaled_logits, labels_all).item())
    after_probs = torch.softmax(scaled_logits, dim=1).detach().cpu().numpy()
    after_ece = compute_multiclass_ece(after_probs, labels_all.cpu().numpy())

    print(f"Optimized Temperature T: {optimal_t:.4f}")
    print(f"After Calibration  -> NLL: {after_nll:.4f} | ECE: {after_ece:.4f}")
    ece_reduction = ((before_ece - after_ece) / before_ece * 100.0) if before_ece > 0 else 0.0
    print(f"ECE Reduction:      {ece_reduction:.1f}%")

    # 5. Save Calibration Plot
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.bar(["Before Calibration", "After Calibration"], [before_ece, after_ece], color=["#EF4444", "#10B981"], width=0.4)
    ax.set_ylabel("Expected Calibration Error (ECE)", fontweight="bold")
    ax.set_title(f"Cervical Model Reliability Calibration (T = {optimal_t:.3f})", fontweight="bold")
    ax.grid(axis="y", linestyle=":", alpha=0.6)
    for i, v in enumerate([before_ece, after_ece]):
        ax.text(i, v + 0.005, f"{v:.4f}", ha="center", fontweight="bold")
    cal_plot_path = os.path.join(output_dir, "cervical_calibration.png")
    plt.tight_layout()
    plt.savefig(cal_plot_path, dpi=300)
    plt.close()
    print(f"[+] Calibration diagram saved to: {cal_plot_path}")

    # 6. Update metadata JSON
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r") as f:
                meta = json.load(f)
        except Exception:
            meta = {}
    else:
        meta = {}

    meta["temperature"] = round(optimal_t, 4)
    meta["calibration"] = {
        "temperature": round(optimal_t, 4),
        "nll_before": round(before_nll, 4),
        "nll_after": round(after_nll, 4),
        "ece_before": round(before_ece, 4),
        "ece_after": round(after_ece, 4),
        "ece_reduction_pct": round(ece_reduction, 2),
    }

    os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
    with open(metadata_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"[+] Updated metadata with temperature at: {metadata_path}")

    print("=" * 65 + "\n")
    return optimal_t


def main():
    parser = argparse.ArgumentParser(description="Calibrate Cervical ViT Model")
    parser.add_argument(
        "--model_path",
        type=str,
        default=os.path.join(training_root, "weights", "cervical_model.pth"),
        help="Path to trained cervical ViT model weights",
    )
    parser.add_argument(
        "--data_dir",
        type=str,
        default=os.path.join(training_root, "data", "cervical", "raw"),
        help="Path to raw SIPaKMeD data folder",
    )
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument(
        "--output_dir",
        type=str,
        default=os.path.join(training_root, "logs"),
        help="Output directory for calibration plots",
    )
    parser.add_argument(
        "--metadata_path",
        type=str,
        default=os.path.join(training_root, "weights", "cervical_model_metadata.json"),
        help="Path to metadata JSON file",
    )
    args = parser.parse_args()

    calibrate_cervical_model(
        model_path=args.model_path,
        data_dir=args.data_dir,
        device=args.device,
        output_dir=args.output_dir,
        metadata_path=args.metadata_path,
    )


if __name__ == "__main__":
    main()
