"""
Probability Calibration for PCOS Pelvic Ultrasound Model.
Implements and compares:
  1. Platt Scaling (Logistic Regression on validation logits)
  2. Temperature Scaling (scalar optimization via L-BFGS)
Selects whichever calibration method achieves the lowest Expected Calibration Error (ECE),
plots reliability calibration diagrams, and updates pcos_model_metadata.json.
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
import torch
import torch.nn as nn
from sklearn.linear_model import LogisticRegression
from torch.optim import LBFGS
from torch.utils.data import DataLoader
from torchvision import models

current_dir = os.path.dirname(os.path.abspath(__file__))
training_root = os.path.dirname(current_dir)
if training_root not in sys.path:
    sys.path.insert(0, training_root)

from pcos.augmentations import get_pcos_val_transforms
from pcos.dataset import CLASS_NAMES, PCOSDataset, prepare_pcos_dataset, split_dataset
from shared.visualize import plot_calibration_curve


def compute_binary_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 10) -> float:
    """Computes Expected Calibration Error for binary predictions."""
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        b_low, b_high = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (probs > b_low) & (probs <= b_high)
        prop = np.mean(in_bin)
        if prop > 0:
            acc = np.mean(labels[in_bin])
            conf = np.mean(probs[in_bin])
            ece += np.abs(conf - acc) * prop
    return float(ece)


class PCOSInferenceModel(nn.Module):
    """ResNet-50 inference model with app-compatible head."""
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


def calibrate_pcos_model(
    model_path: str,
    data_dir: str,
    device: str = "cuda" if torch.cuda.is_available() else "cpu",
    output_dir: str = os.path.join(training_root, "logs"),
    metadata_path: str = os.path.join(training_root, "weights", "pcos_model_metadata.json"),
) -> Dict[str, any]:
    """Runs Platt Scaling vs Temperature Scaling calibration comparison."""
    dev = torch.device(device)
    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "=" * 65)
    print(" PCOS PELVIC ULTRASOUND CALIBRATION: PLATT vs TEMPERATURE SCALING")
    print("=" * 65)

    # 1. Dataset
    image_paths, labels = prepare_pcos_dataset(data_dir)
    _, _, val_paths, val_labels, _, _ = split_dataset(image_paths, labels, seed=42)

    val_transforms = get_pcos_val_transforms()
    val_dataset = PCOSDataset(val_paths, val_labels, transform=val_transforms)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, num_workers=0)
    print(f"Validation calibration set size: {len(val_dataset)} samples")

    # 2. Model Loading
    model = PCOSInferenceModel().to(dev)
    if os.path.exists(model_path):
        chk = torch.load(model_path, map_location=dev)
        state = chk.get("model_state_dict", chk)
        cleaned = {k.replace("network.", ""): v for k, v in state.items()}
        model.load_state_dict(cleaned, strict=False)
        print(f"[+] Loaded PCOS weights from: {model_path}")
    else:
        print(f"[!] Warning: Checkpoint not found at {model_path}. Using initialized model.")

    model.eval()

    # 3. Collect validation raw logits and ground truth
    logits_list = []
    labels_list = []

    with torch.no_grad():
        for images, targets in val_loader:
            images = images.to(dev)
            outputs = model(images)
            # Binary logit difference: z_1 - z_0
            diff = (outputs[:, 1] - outputs[:, 0]).cpu().numpy()
            logits_list.extend(diff)
            labels_list.extend(targets.numpy())

    raw_logits = np.array(logits_list, dtype=np.float32)
    y_val = np.array(labels_list, dtype=np.int32)

    # Uncalibrated baseline probabilities
    uncal_probs = 1.0 / (1.0 + np.exp(-raw_logits))
    uncal_ece = compute_binary_ece(uncal_probs, y_val)
    print(f"Uncalibrated Baseline -> ECE: {uncal_ece:.4f}")

    # 4. Platt Scaling (Logistic Regression on Logits)
    # P(y=1|z) = 1 / (1 + exp(-(a * z + b)))
    platt_clf = LogisticRegression(C=1.0, solver="lbfgs")
    platt_clf.fit(raw_logits.reshape(-1, 1), y_val)
    platt_probs = platt_clf.predict_proba(raw_logits.reshape(-1, 1))[:, 1]
    platt_ece = compute_binary_ece(platt_probs, y_val)
    platt_a = float(platt_clf.coef_[0][0])
    platt_b = float(platt_clf.intercept_[0])
    print(f"Platt Scaling         -> ECE: {platt_ece:.4f} (a={platt_a:.3f}, b={platt_b:.3f})")

    # 5. Temperature Scaling
    # P(y=1|z) = 1 / (1 + exp(-z / T))
    temperature_param = nn.Parameter(torch.ones(1) * 1.5)
    logits_tensor = torch.from_numpy(raw_logits).to(dev)
    targets_tensor = torch.from_numpy(y_val).float().to(dev)
    bce_loss_fn = nn.BCEWithLogitsLoss()

    optimizer = LBFGS([temperature_param], lr=0.01, max_iter=50)

    def eval_loss():
        optimizer.zero_grad()
        loss = bce_loss_fn(logits_tensor / temperature_param, targets_tensor)
        loss.backward()
        return loss

    optimizer.step(eval_loss)
    opt_temp = float(temperature_param.item())
    temp_probs = (1.0 / (1.0 + np.exp(-raw_logits / opt_temp)))
    temp_ece = compute_binary_ece(temp_probs, y_val)
    print(f"Temperature Scaling   -> ECE: {temp_ece:.4f} (T={opt_temp:.3f})")

    # 6. Select Best Calibration Method
    if platt_ece <= temp_ece:
        best_method = "platt_scaling"
        best_ece = platt_ece
        best_probs = platt_probs
        cal_details = {"method": "platt_scaling", "a": round(platt_a, 4), "b": round(platt_b, 4)}
        print(f"\n[+] Selected Best Calibration Method: Platt Scaling (ECE: {platt_ece:.4f})")
    else:
        best_method = "temperature_scaling"
        best_ece = temp_ece
        best_probs = temp_probs
        cal_details = {"method": "temperature_scaling", "temperature": round(opt_temp, 4)}
        print(f"\n[+] Selected Best Calibration Method: Temperature Scaling (ECE: {temp_ece:.4f})")

    # 7. Generate Comparative Plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    # Bar chart ECE comparison
    methods = ["Uncalibrated", "Platt Scaling", "Temperature Scaling"]
    eces = [uncal_ece, platt_ece, temp_ece]
    colors = ["#EF4444", "#3B82F6", "#10B981"]
    ax1.bar(methods, eces, color=colors, width=0.45)
    ax1.set_ylabel("Expected Calibration Error (ECE)", fontweight="bold")
    ax1.set_title("Calibration Method Comparison", fontweight="bold")
    ax1.grid(axis="y", linestyle=":", alpha=0.6)
    for i, v in enumerate(eces):
        ax1.text(i, v + 0.005, f"{v:.4f}", ha="center", fontweight="bold")

    # Reliability curve for best method
    from sklearn.calibration import calibration_curve
    prob_true_uncal, prob_pred_uncal = calibration_curve(y_val, uncal_probs, n_bins=10)
    prob_true_best, prob_pred_best = calibration_curve(y_val, best_probs, n_bins=10)

    ax2.plot(prob_pred_uncal, prob_true_uncal, marker="o", color="#EF4444", label=f"Uncalibrated (ECE={uncal_ece:.3f})")
    ax2.plot(prob_pred_best, prob_true_best, marker="s", color="#10B981", lw=2, label=f"Calibrated: {best_method} (ECE={best_ece:.3f})")
    ax2.plot([0, 1], [0, 1], linestyle="--", color="#94A3B8", label="Perfect Calibration")
    ax2.set_xlabel("Mean Predicted Probability", fontweight="bold")
    ax2.set_ylabel("Fraction of Positives", fontweight="bold")
    ax2.set_title("Reliability Curve", fontweight="bold")
    ax2.legend()
    ax2.grid(True, linestyle=":", alpha=0.6)

    plt.suptitle("AuraMed PCOS Ultrasound Reliability Calibration", fontsize=13, fontweight="bold")
    plt.tight_layout()
    cal_plot_path = os.path.join(output_dir, "pcos_calibration.png")
    plt.savefig(cal_plot_path, dpi=300)
    plt.close()
    print(f"[+] Saved comparative calibration diagram to: {cal_plot_path}")

    # 8. Update Metadata JSON
    meta = {}
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r") as f:
                meta = json.load(f)
        except Exception:
            meta = {}

    meta["calibration"] = {
        "best_method": best_method,
        "ece_before": round(uncal_ece, 4),
        "ece_after": round(best_ece, 4),
        "platt_ece": round(platt_ece, 4),
        "temperature_ece": round(temp_ece, 4),
        "params": cal_details,
    }
    if best_method == "temperature_scaling":
        meta["temperature"] = round(opt_temp, 4)

    os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
    with open(metadata_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"[+] Updated metadata at: {metadata_path}")
    print("=" * 65 + "\n")

    return {
        "best_method": best_method,
        "best_ece": best_ece,
        "uncal_ece": uncal_ece,
        "platt_ece": platt_ece,
        "temp_ece": temp_ece,
    }


def main():
    parser = argparse.ArgumentParser(description="Calibrate PCOS Pelvic Ultrasound Model")
    parser.add_argument(
        "--model_path",
        type=str,
        default=os.path.join(training_root, "weights", "pcos_model.pth"),
    )
    parser.add_argument(
        "--data_dir",
        type=str,
        default=os.path.join(training_root, "data", "pcos", "raw"),
    )
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument(
        "--output_dir",
        type=str,
        default=os.path.join(training_root, "logs"),
    )
    parser.add_argument(
        "--metadata_path",
        type=str,
        default=os.path.join(training_root, "weights", "pcos_model_metadata.json"),
    )
    args = parser.parse_args()

    calibrate_pcos_model(
        model_path=args.model_path,
        data_dir=args.data_dir,
        device=args.device,
        output_dir=args.output_dir,
        metadata_path=args.metadata_path,
    )


if __name__ == "__main__":
    main()
