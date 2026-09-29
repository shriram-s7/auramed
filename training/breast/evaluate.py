"""
Comprehensive Evaluation Script for Breast Cancer Model (CBIS-DDSM).
Computes clinical validation metrics, produces publication-grade curves (ROC, PR, CM),
visualizes correct and incorrect sample predictions with confidence scores,
and provides direct comparison against published CBIS-DDSM benchmarks (~0.87 - 0.92 AUC).
"""
import argparse
import os
import sys
from typing import List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader

current_dir = os.path.dirname(os.path.abspath(__file__))
training_root = os.path.dirname(current_dir)
if training_root not in sys.path:
    sys.path.insert(0, training_root)

from breast.augmentations import get_val_transforms
from breast.dataset import CBISDDSMDataset, prepare_cbis_ddsm, split_dataset
from breast.train import BreastCancerModel, evaluate_loader
from shared.metrics import compute_clinical_metrics, find_optimal_threshold, print_clinical_report
from shared.visualize import plot_confusion_matrix, plot_pr_curve, plot_roc_curve


def plot_sample_predictions(
    test_paths: List[str],
    y_true: np.ndarray,
    y_probs: np.ndarray,
    threshold: float,
    save_path: str,
):
    """
    Renders visual panel showing 5 correct predictions and 5 incorrect predictions
    along with ground truth, predicted probability, and clinical diagnosis.
    """
    os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
    preds = (y_probs >= threshold).astype(int)
    correct_mask = (preds == y_true)
    incorrect_mask = (preds != y_true)

    correct_indices = np.where(correct_mask)[0][:5]
    incorrect_indices = np.where(incorrect_mask)[0][:5]

    total_samples = len(correct_indices) + len(incorrect_indices)
    if total_samples == 0:
        return

    fig, axes = plt.subplots(2, 5, figsize=(16, 7))
    class_labels = {0: "Benign", 1: "Malignant"}

    # Top row: Correct predictions
    for col, idx in enumerate(correct_indices):
        ax = axes[0, col]
        try:
            img = Image.open(test_paths[idx]).convert("RGB").resize((128, 128))
            ax.imshow(img)
        except Exception:
            ax.imshow(np.zeros((128, 128, 3), dtype=np.uint8))
        prob = y_probs[idx]
        true_l = class_labels[int(y_true[idx])]
        pred_l = class_labels[int(preds[idx])]
        ax.set_title(f"CORRECT\nTrue: {true_l}\nPred: {pred_l} ({prob:.2f})", fontsize=9, color="#15803D", fontweight="bold")
        ax.axis("off")

    # If fewer than 5 correct, blank out remaining columns
    for col in range(len(correct_indices), 5):
        axes[0, col].axis("off")

    # Bottom row: Incorrect predictions (false positives / false negatives)
    for col, idx in enumerate(incorrect_indices):
        ax = axes[1, col]
        try:
            img = Image.open(test_paths[idx]).convert("RGB").resize((128, 128))
            ax.imshow(img)
        except Exception:
            ax.imshow(np.zeros((128, 128, 3), dtype=np.uint8))
        prob = y_probs[idx]
        true_l = class_labels[int(y_true[idx])]
        pred_l = class_labels[int(preds[idx])]
        ax.set_title(f"MISCLASSIFIED\nTrue: {true_l}\nPred: {pred_l} ({prob:.2f})", fontsize=9, color="#B91C1C", fontweight="bold")
        ax.axis("off")

    for col in range(len(incorrect_indices), 5):
        axes[1, col].axis("off")

    plt.suptitle("CBIS-DDSM Mammography Model - Qualitative Sample Predictions", fontsize=13, fontweight="bold", y=0.98)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close(fig)
    print(f" Saved sample predictions visualization to: {save_path}")


def print_benchmark_comparison(model_auc: float):
    """
    Compares the evaluated model's AUC against published peer-reviewed CBIS-DDSM benchmarks:
    - Shen et al., Nature Scientific Reports (Deep Learning on CBIS-DDSM): AUC ~ 0.88 - 0.91
    - Lotter et al., Nature Medicine: AUC ~ 0.89 - 0.93
    """
    bench_low = 0.87
    bench_high = 0.92

    if model_auc >= bench_high:
        comp_str = "ABOVE published benchmark (Exceeds typical literature baseline)"
    elif model_auc >= bench_low:
        comp_str = "AT published benchmark (Clinically comparable to peer-reviewed models)"
    else:
        comp_str = "BELOW published benchmark (Consider training for more epochs with full dataset)"

    print("\n" + "=" * 65)
    print(" CBIS-DDSM PUBLISHED BENCHMARK COMPARISON")
    print("=" * 65)
    print(f" Your Model AUC:                       {model_auc:.4f}")
    print(f" Published CBIS-DDSM Benchmark Range:  ~0.8700 - 0.9200")
    print(f" Comparison Status:                    {comp_str}")
    print(" Reference Citations:")
    print("   1. Shen et al. Scientific Reports (Deep Learning on CBIS-DDSM)")
    print("   2. Lotter et al. Nature Medicine (Mammographic AI Diagnostic Benchmark)")
    print("=" * 65 + "\n")


def evaluate_breast_model(
    model_path: str,
    test_dir: str,
    device: str = "cuda" if torch.cuda.is_available() else "cpu",
    batch_size: int = 16,
) -> dict:
    """
    Loads saved checkpoint, runs evaluation on test data, prints reports,
    generates figures, and compares with published benchmarks.
    """
    dev = torch.device(device)
    logs_dir = os.path.join(training_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)

    print(f" Loading Breast Cancer Model from: {model_path}")
    model = BreastCancerModel(pretrained=False).to(dev)

    if os.path.exists(model_path):
        checkpoint = torch.load(model_path, map_location=dev, weights_only=False)
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state_dict)
        print(" Successfully loaded model state dict.")
    else:
        print(f"[!] Warning: Model path {model_path} does not exist. Running evaluation with initialized weights.")

    model.eval()

    # Load test split
    image_paths, labels = prepare_cbis_ddsm(test_dir)
    _, _, _, _, test_paths, test_labels = split_dataset(image_paths, labels, test_size=0.15, val_size=0.15)

    test_dataset = CBISDDSMDataset(test_paths, test_labels, transform=get_val_transforms())
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    criterion = nn.BCEWithLogitsLoss()

    _, y_true, y_probs = evaluate_loader(model, test_loader, criterion, dev)

    # 1. Optimal threshold calculation prioritizing >=90% sensitivity
    optimal_th = find_optimal_threshold(y_true, y_probs, min_sensitivity=0.90)
    metrics = compute_clinical_metrics(y_true, y_probs, threshold=optimal_th)

    # 2. Print Full Clinical Report
    print_clinical_report(metrics, model_name="AuraMed ResNet-50 Mammography", dataset_name="CBIS-DDSM Test Partition")

    # 3. Save Visualizations to logs/
    roc_file = os.path.join(logs_dir, "breast_roc_curve.png")
    pr_file = os.path.join(logs_dir, "breast_pr_curve.png")
    cm_file = os.path.join(logs_dir, "breast_cm.png")
    samples_file = os.path.join(logs_dir, "breast_sample_predictions.png")

    plot_roc_curve(y_true, y_probs, metrics["auc_roc"], "Breast Screening (CBIS-DDSM)", save_path=roc_file)
    plot_pr_curve(y_true, y_probs, metrics["auc_pr"], "Breast Screening (CBIS-DDSM)", save_path=pr_file)
    plot_confusion_matrix(metrics["confusion_matrix"], ["Benign", "Malignant"], "Breast Screening", save_path=cm_file)
    plot_sample_predictions(test_paths, y_true, y_probs, optimal_th, samples_file)

    # 4. Benchmark Comparison
    print_benchmark_comparison(metrics["auc_roc"])

    print(f" All clinical evaluation figures successfully saved to: {logs_dir}")
    return metrics


def main():
    parser = argparse.ArgumentParser(description="Evaluate Breast Cancer Model on CBIS-DDSM Benchmark")
    parser.add_argument("--model_path", type=str, default=os.path.join(training_root, "weights", "breast_model.pth"))
    parser.add_argument("--data_dir", type=str, default=os.path.join(training_root, "data", "breast", "raw"))
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    evaluate_breast_model(
        model_path=args.model_path,
        test_dir=args.data_dir,
        device=args.device,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    main()
