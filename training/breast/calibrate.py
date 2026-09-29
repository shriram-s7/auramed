"""
Probability Calibration for Breast Cancer Model (CBIS-DDSM).
Applies temperature scaling (Guo et al., 2017) to optimize empirical confidence alignment,
minimizing Expected Calibration Error (ECE) and NLL on validation mammography scans.
"""
import argparse
import json
import os
import sys
from typing import Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
from sklearn.calibration import calibration_curve
from torch.optim import LBFGS
from torch.utils.data import DataLoader

current_dir = os.path.dirname(os.path.abspath(__file__))
training_root = os.path.dirname(current_dir)
if training_root not in sys.path:
    sys.path.insert(0, training_root)

from breast.augmentations import get_val_transforms
from breast.dataset import CBISDDSMDataset, prepare_cbis_ddsm, split_dataset
from breast.train import BreastCancerModel


class TemperatureScaler(nn.Module):
    """
    Temperature Scaling wrapper for binary classification models.
    Scales logits by 1/T prior to sigmoid probability mapping.
    """
    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        logits = self.model(x)
        return logits / self.temperature


def compute_binary_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 10) -> float:
    """Computes Expected Calibration Error (ECE) for binary classification."""
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    total = len(probs)
    for i in range(n_bins):
        bin_lower, bin_upper = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (probs >= bin_lower) & (probs <= bin_upper)
        count = np.sum(in_bin)
        if count > 0:
            avg_confidence = np.mean(probs[in_bin])
            empirical_accuracy = np.mean(labels[in_bin])
            ece += (count / total) * np.abs(avg_confidence - empirical_accuracy)
    return float(ece)


def plot_reliability_comparison(
    y_true: np.ndarray,
    uncal_probs: np.ndarray,
    cal_probs: np.ndarray,
    ece_before: float,
    ece_after: float,
    temp_val: float,
    save_path: str,
):
    """Plots comparative reliability diagram before and after temperature scaling."""
    os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
    fig, ax = plt.subplots(figsize=(7, 6))

    prob_true_before, prob_pred_before = calibration_curve(y_true, uncal_probs, n_bins=8, strategy="uniform")
    prob_true_after, prob_pred_after = calibration_curve(y_true, cal_probs, n_bins=8, strategy="uniform")

    ax.plot([0, 1], [0, 1], linestyle="--", color="#94A3B8", label="Perfect Calibration")
    ax.plot(prob_pred_before, prob_true_before, marker="s", color="#EF4444", lw=2, label=f"Uncalibrated (ECE = {ece_before:.4f})")
    ax.plot(prob_pred_after, prob_true_after, marker="o", color="#10B981", lw=2.5, label=f"Calibrated (T = {temp_val:.3f}, ECE = {ece_after:.4f})")

    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.0])
    ax.set_xlabel("Mean Predicted Malignancy Probability", fontsize=11, fontweight="bold")
    ax.set_ylabel("Empirical Fraction of Malignant Biopsies", fontsize=11, fontweight="bold")
    ax.set_title("Breast Screening Reliability Calibration Diagram", fontsize=13, fontweight="bold")
    ax.legend(loc="upper left", frameon=True, fontsize=10)
    ax.grid(True, linestyle=":", alpha=0.6)

    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close(fig)
    print(f" Saved reliability calibration plot to: {save_path}")


def calibrate_breast_model(
    model: nn.Module,
    val_loader: DataLoader,
    device: torch.device,
    metadata_path: str = None,
    save_plot_path: str = None,
) -> Tuple[float, float, float]:
    """
    Optimizes temperature scaling parameter on validation loader and evaluates ECE.
    """
    model.eval()
    model.to(device)

    scaler = TemperatureScaler(model).to(device)
    criterion = nn.BCEWithLogitsLoss()

    # 1. Collect validation logits and true labels
    logits_list = []
    labels_list = []

    with torch.no_grad():
        for images, labels in val_loader:
            images = images.to(device)
            labels = labels.to(device)

            out = model(images)
            out_logits = out.squeeze(1) if out.dim() > 1 else out
            logits_list.append(out_logits)
            labels_list.append(labels)

    all_logits = torch.cat(logits_list)
    all_labels = torch.cat(labels_list)

    # 2. Compute Uncalibrated Probabilities & Initial ECE
    uncal_probs = torch.sigmoid(all_logits).cpu().numpy()
    labels_np = all_labels.cpu().numpy()
    ece_before = compute_binary_ece(uncal_probs, labels_np)

    # 3. Optimize Temperature parameter using L-BFGS to minimize NLL
    optimizer = LBFGS([scaler.temperature], lr=0.01, max_iter=50)

    def eval_loss():
        optimizer.zero_grad()
        scaled = all_logits / scaler.temperature
        loss = criterion(scaled, all_labels)
        loss.backward()
        return loss

    optimizer.step(eval_loss)
    T = float(scaler.temperature.item())

    # 4. Compute Calibrated Probabilities & Post ECE
    with torch.no_grad():
        cal_probs = torch.sigmoid(all_logits / T).cpu().numpy()
    ece_after = compute_binary_ece(cal_probs, labels_np)

    # 5. Print Results
    print("\n" + "=" * 55)
    print(" TEMPERATURE SCALING CALIBRATION RESULTS")
    print("=" * 55)
    print(f" Before calibration ECE: {ece_before:.4f}")
    print(f" After calibration ECE:  {ece_after:.4f}")
    print(f" Temperature found:      {T:.4f}")
    print("=" * 55 + "\n")

    # 6. Save Plot
    if save_plot_path:
        plot_reliability_comparison(labels_np, uncal_probs, cal_probs, ece_before, ece_after, T, save_plot_path)

    # 7. Update Metadata JSON if file exists
    if metadata_path and os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            meta["temperature_scaling"] = {
                "temperature": round(T, 4),
                "ece_before": round(ece_before, 4),
                "ece_after": round(ece_after, 4),
            }
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)
            print(f" Updated calibration temperature into metadata: {metadata_path}")
        except Exception as e:
            print(f"[!] Could not update metadata JSON: {e}")

    return ece_before, ece_after, T


def main():
    parser = argparse.ArgumentParser(description="Calibrate Breast Cancer Model with Temperature Scaling")
    parser.add_argument("--model_path", type=str, default=os.path.join(training_root, "weights", "breast_best.pth"))
    parser.add_argument("--data_dir", type=str, default=os.path.join(training_root, "data", "breast", "raw"))
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f" Calibrating Breast Model on device: {device}")

    model = BreastCancerModel(pretrained=False).to(device)
    if os.path.exists(args.model_path):
        checkpoint = torch.load(args.model_path, map_location=device, weights_only=False)
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state_dict)
        print(f" Loaded weights from: {args.model_path}")
    else:
        print(f"[!] Warning: Model path {args.model_path} not found. Running with initialized weights.")

    # Load validation data
    image_paths, labels = prepare_cbis_ddsm(args.data_dir)
    _, _, val_paths, val_labels, _, _ = split_dataset(image_paths, labels, test_size=0.15, val_size=0.15)

    val_dataset = CBISDDSMDataset(val_paths, val_labels, transform=get_val_transforms())
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)

    metadata_file = os.path.join(training_root, "weights", "breast_model_metadata.json")
    plot_file = os.path.join(training_root, "logs", "breast_calibration_curve.png")

    calibrate_breast_model(
        model,
        val_loader,
        device,
        metadata_path=metadata_file,
        save_plot_path=plot_file,
    )


if __name__ == "__main__":
    main()
