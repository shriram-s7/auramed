"""
Clinical Visualization Tools for AuraMed Training Environment.
Generates publication-ready figures for ROC curves, Precision-Recall curves,
Confusion Matrices, Reliability Calibration Curves, and Training History.
"""
import os
from typing import Any, Dict, List, Optional, Union

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless/server training
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.calibration import calibration_curve
from sklearn.metrics import precision_recall_curve, roc_curve


def plot_roc_curve(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[float], np.ndarray],
    auc_roc: float,
    model_name: str,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """Plots and optionally saves a publication-grade ROC curve."""
    fpr, tpr, _ = roc_curve(y_true, y_pred_proba)
    fig, ax = plt.subplots(figsize=(7, 6))

    ax.plot(fpr, tpr, color="#2563EB", lw=2.5, label=f"{model_name} (AUC = {auc_roc:.3f})")
    ax.plot([0, 1], [0, 1], color="#94A3B8", lw=1.5, linestyle="--", label="Random Chance (AUC = 0.500)")

    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.set_xlabel("False Positive Rate (1 - Specificity)", fontsize=11, fontweight="bold")
    ax.set_ylabel("True Positive Rate (Sensitivity)", fontsize=11, fontweight="bold")
    ax.set_title(f"Receiver Operating Characteristic (ROC) - {model_name}", fontsize=13, fontweight="bold")
    ax.legend(loc="lower right", frameon=True, fontsize=10)
    ax.grid(True, linestyle=":", alpha=0.6)

    plt.tight_layout()
    if save_path:
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        plt.savefig(save_path, dpi=300)
    return fig


def plot_multiclass_roc_curve(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[List[float]], np.ndarray],
    class_names: List[str],
    model_name: str,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """Plots per-class One-vs-Rest ROC curves on the same plot."""
    y_true_arr = np.asarray(y_true, dtype=int)
    probs_arr = np.asarray(y_pred_proba, dtype=float)
    n_classes = len(class_names)

    fig, ax = plt.subplots(figsize=(8, 7))
    palette = ["#DC2626", "#F59E0B", "#10B981", "#6366F1", "#3B82F6", "#8B5CF6", "#EC4899"]

    for i in range(n_classes):
        bin_true = (y_true_arr == i).astype(int)
        if len(np.unique(bin_true)) > 1:
            fpr, tpr, _ = roc_curve(bin_true, probs_arr[:, i])
            from sklearn.metrics import auc
            roc_auc = auc(fpr, tpr)
            color = palette[i % len(palette)]
            ax.plot(fpr, tpr, color=color, lw=2.2, label=f"{class_names[i]} (AUC = {roc_auc:.3f})")

    ax.plot([0, 1], [0, 1], color="#94A3B8", lw=1.5, linestyle="--", label="Random Chance (AUC = 0.500)")
    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.set_xlabel("False Positive Rate (1 - Specificity)", fontsize=11, fontweight="bold")
    ax.set_ylabel("True Positive Rate (Sensitivity)", fontsize=11, fontweight="bold")
    ax.set_title(f"Per-Class One-vs-Rest ROC Curves - {model_name}", fontsize=13, fontweight="bold")
    ax.legend(loc="lower right", frameon=True, fontsize=9)
    ax.grid(True, linestyle=":", alpha=0.6)

    plt.tight_layout()
    if save_path:
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        plt.savefig(save_path, dpi=300)
    return fig


def plot_pr_curve(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[float], np.ndarray],
    auc_pr: float,
    model_name: str,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """Plots and optionally saves a Precision-Recall curve."""
    precisions, recalls, _ = precision_recall_curve(y_true, y_pred_proba)
    fig, ax = plt.subplots(figsize=(7, 6))

    ax.plot(recalls, precisions, color="#0D9488", lw=2.5, label=f"{model_name} (AUC-PR = {auc_pr:.3f})")

    baseline = np.mean(y_true)
    ax.axhline(y=baseline, color="#94A3B8", lw=1.5, linestyle="--", label=f"Prevalence Baseline ({baseline:.2%})")

    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.set_xlabel("Recall (Sensitivity)", fontsize=11, fontweight="bold")
    ax.set_ylabel("Precision (PPV)", fontsize=11, fontweight="bold")
    ax.set_title(f"Precision-Recall (PR) Curve - {model_name}", fontsize=13, fontweight="bold")
    ax.legend(loc="lower left", frameon=True, fontsize=10)
    ax.grid(True, linestyle=":", alpha=0.6)

    plt.tight_layout()
    if save_path:
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        plt.savefig(save_path, dpi=300)
    return fig


def plot_confusion_matrix(
    cm: List[List[int]],
    class_names: List[str],
    model_name: str,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """Plots a styled clinical confusion matrix heatmap."""
    fig, ax = plt.subplots(figsize=(6, 5))
    cm_arr = np.array(cm)

    # Compute row percentages (sensitivity and specificity per row)
    row_sums = cm_arr.sum(axis=1, keepdims=True)
    annot_data = np.empty_like(cm_arr, dtype=object)
    for i in range(cm_arr.shape[0]):
        for j in range(cm_arr.shape[1]):
            pct = (cm_arr[i, j] / row_sums[i, 0] * 100) if row_sums[i, 0] > 0 else 0
            annot_data[i, j] = f"{cm_arr[i, j]}\n({pct:.1f}%)"

    sns.heatmap(
        cm_arr,
        annot=annot_data,
        fmt="",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        cbar=False,
        ax=ax,
        annot_kws={"fontsize": 11, "fontweight": "bold"},
    )

    ax.set_xlabel("Predicted Clinical Class", fontsize=11, fontweight="bold")
    ax.set_ylabel("Ground Truth Pathology", fontsize=11, fontweight="bold")
    ax.set_title(f"Confusion Matrix - {model_name}", fontsize=13, fontweight="bold")

    plt.tight_layout()
    if save_path:
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        plt.savefig(save_path, dpi=300)
    return fig


def plot_calibration_curve(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[float], np.ndarray],
    model_name: str,
    n_bins: int = 10,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """Plots a reliability diagram / probability calibration curve."""
    prob_true, prob_pred = calibration_curve(y_true, y_pred_proba, n_bins=n_bins, strategy="uniform")

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(prob_pred, prob_true, marker="o", lw=2, color="#7C3AED", label=f"{model_name}")
    ax.plot([0, 1], [0, 1], linestyle="--", color="#94A3B8", label="Perfect Calibration")

    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.0])
    ax.set_xlabel("Mean Predicted Probability", fontsize=11, fontweight="bold")
    ax.set_ylabel("Fraction of Positives (Empirical)", fontsize=11, fontweight="bold")
    ax.set_title(f"Reliability Calibration Curve - {model_name}", fontsize=13, fontweight="bold")
    ax.legend(loc="upper left", frameon=True, fontsize=10)
    ax.grid(True, linestyle=":", alpha=0.6)

    plt.tight_layout()
    if save_path:
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        plt.savefig(save_path, dpi=300)
    return fig


def plot_training_history(
    history: Dict[str, List[float]],
    model_name: str,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """Plots train vs val loss and accuracy over epochs."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    epochs = range(1, len(history.get("train_loss", [])) + 1)

    # Loss plot
    if "train_loss" in history:
        ax1.plot(epochs, history["train_loss"], label="Train Loss", color="#2563EB", lw=2)
    if "val_loss" in history:
        ax1.plot(epochs, history["val_loss"], label="Val Loss", color="#DC2626", lw=2)
    ax1.set_xlabel("Epoch", fontsize=11, fontweight="bold")
    ax1.set_ylabel("Loss", fontsize=11, fontweight="bold")
    ax1.set_title("Training & Validation Loss", fontsize=12, fontweight="bold")
    ax1.legend()
    ax1.grid(True, linestyle=":", alpha=0.6)

    # Accuracy / AUC plot
    metric_key = "val_auc" if "val_auc" in history else ("val_acc" if "val_acc" in history else None)
    if "train_acc" in history:
        ax2.plot(epochs, history["train_acc"], label="Train Acc", color="#2563EB", lw=2)
    if metric_key and metric_key in history:
        label_text = "Val AUC" if "auc" in metric_key else "Val Acc"
        ax2.plot(epochs, history[metric_key], label=label_text, color="#16A34A", lw=2)
    ax2.set_xlabel("Epoch", fontsize=11, fontweight="bold")
    ax2.set_ylabel("Metric Score", fontsize=11, fontweight="bold")
    ax2.set_title("Training & Validation Performance", fontsize=12, fontweight="bold")
    ax2.legend()
    ax2.grid(True, linestyle=":", alpha=0.6)

    plt.suptitle(f"Training History - {model_name}", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()
    if save_path:
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        plt.savefig(save_path, dpi=300)
    return fig
