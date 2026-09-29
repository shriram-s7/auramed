"""
Evaluation and Diagnostic Benchmark Suite for Cervical Cancer ViT Model.
Evaluates 5-class SIPaKMeD cytology model on test dataset with:
  - 5-class multi-class metrics (accuracy, macro/weighted F1, per-class AUC/sens/spec)
  - 5x5 confusion matrix heatmap with Bethesda class names
  - Per-class One-vs-Rest ROC curves on a single plot
  - Top-3 most common misclassification pairs analysis
  - Bethesda clinical mapping safety evaluation (HSIL sensitivity)
  - Published SIPaKMeD benchmark comparison (~96-98% accuracy)
"""
import argparse
import os
import sys
from typing import Dict, List, Tuple

import numpy as np
import timm
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

current_dir = os.path.dirname(os.path.abspath(__file__))
training_root = os.path.dirname(current_dir)
if training_root not in sys.path:
    sys.path.insert(0, training_root)

from cervical.augmentations import get_cervical_val_transforms
from cervical.dataset import CLASS_NAMES, SIPaKMeDDataset, prepare_sipakmed, split_dataset
from shared.metrics import compute_multiclass_metrics, evaluate_bethesda_clinical_mapping
from shared.visualize import plot_confusion_matrix, plot_multiclass_roc_curve


def analyze_misclassifications(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: List[str],
    top_k: int = 3,
) -> List[Dict[str, any]]:
    """
    Analyzes and ranks the most frequent confusion/misclassification pairs.
    """
    cm = np.zeros((len(class_names), len(class_names)), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1

    total_errors = int(np.sum(y_true != y_pred))
    confusion_pairs = []

    for i in range(len(class_names)):
        for j in range(len(class_names)):
            if i != j and cm[i, j] > 0:
                count = int(cm[i, j])
                pct_of_errors = (count / total_errors * 100.0) if total_errors > 0 else 0.0
                pct_of_class = (count / np.sum(cm[i, :]) * 100.0) if np.sum(cm[i, :]) > 0 else 0.0
                confusion_pairs.append({
                    "actual": class_names[i],
                    "predicted": class_names[j],
                    "count": count,
                    "pct_of_errors": pct_of_errors,
                    "pct_of_class": pct_of_class,
                })

    confusion_pairs.sort(key=lambda x: x["count"], reverse=True)
    return confusion_pairs[:top_k]


def run_evaluation(
    model_path: str,
    data_dir: str,
    batch_size: int = 32,
    device: str = "cuda" if torch.cuda.is_available() else "cpu",
    output_dir: str = os.path.join(training_root, "logs"),
):
    """Executes full clinical evaluation pipeline."""
    dev = torch.device(device)
    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "=" * 65)
    print(" SIPAKMED CERVICAL VI-T EVALUATION & BENCHMARK SUITE")
    print("=" * 65)
    print(f"Model path: {model_path}")
    print(f"Data root:  {data_dir}")
    print(f"Device:     {dev}")

    # 1. Dataset Preparation
    image_paths, labels = prepare_sipakmed(data_dir)
    _, _, _, _, test_paths, test_labels = split_dataset(image_paths, labels, seed=42)

    val_transforms = get_cervical_val_transforms()
    test_dataset = SIPaKMeDDataset(test_paths, test_labels, transform=val_transforms)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"Test samples: {len(test_dataset)}")

    # 2. Model Loading
    model = timm.create_model("vit_base_patch16_224", pretrained=False, num_classes=5)
    if os.path.exists(model_path):
        checkpoint = torch.load(model_path, map_location=dev)
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state_dict)
        print(f"[+] Loaded model weights successfully from: {model_path}")
    else:
        print(f"[!] Warning: Checkpoint not found at {model_path}. Running evaluation with initialized model.")

    model.to(dev)
    model.eval()

    # 3. Inference
    all_preds = []
    all_probs = []
    all_labels = []

    with torch.no_grad():
        for images, targets in test_loader:
            images = images.to(dev)
            outputs = model(images)
            probs = torch.softmax(outputs, dim=1).cpu().numpy()
            preds = np.argmax(probs, axis=1)

            all_probs.extend(probs)
            all_preds.extend(preds)
            all_labels.extend(targets.numpy())

    y_true = np.array(all_labels)
    y_pred = np.array(all_preds)
    y_probs = np.array(all_probs)

    # 4. Multi-class Metrics
    metrics = compute_multiclass_metrics(y_true, y_probs, class_names=CLASS_NAMES)
    acc = metrics["accuracy"]

    print("\n" + "-" * 65)
    print(f"Overall Accuracy:  {acc * 100:.2f}% ({metrics['accuracy']:.4f})")
    print(f"Macro F1 Score:    {metrics['macro_f1']:.4f}")
    print(f"Weighted F1 Score: {metrics['weighted_f1']:.4f}")
    print("\nPer-Class Breakdown:")
    for c_name in CLASS_NAMES:
        c_acc = metrics["per_class_accuracy"].get(c_name, 0.0)
        c_sens = metrics["per_class_sensitivity"].get(c_name, 0.0)
        c_spec = metrics["per_class_specificity"].get(c_name, 0.0)
        c_auc = metrics["per_class_auc"].get(c_name, 0.0)
        print(f"  {c_name:<16} | Acc: {c_acc * 100:5.1f}% | Sens: {c_sens * 100:5.1f}% | Spec: {c_spec * 100:5.1f}% | AUC: {c_auc:.3f}")

    # 5. Bethesda Clinical Safety Evaluation
    bethesda_results = evaluate_bethesda_clinical_mapping(y_true, y_probs, class_names=CLASS_NAMES)

    # 6. Misclassification Analysis (Top 3 pairs)
    print("\nMOST COMMON MISCLASSIFICATIONS:")
    top_pairs = analyze_misclassifications(y_true, y_pred, CLASS_NAMES, top_k=3)
    if top_pairs:
        for idx, pair in enumerate(top_pairs, 1):
            act = pair["actual"]
            prd = pair["predicted"]
            cnt = pair["count"]
            pct = pair["pct_of_class"]
            print(f'  {idx}. Model most often confuses {act} with {prd} ({cnt} cases, {pct:.1f}%)')
    else:
        print("  None detected (100% accuracy on test set).")

    # 7. Benchmark Comparison
    print("\n" + "=" * 65)
    print("BENCHMARK COMPARISON:")
    print("  Published SIPaKMeD benchmark (best models): ~96-98% accuracy")
    print(f"  Your model: {acc * 100:.1f}%")
    print("=" * 65 + "\n")

    # 8. Visualizations
    # 5x5 confusion matrix heatmap
    cm_path = os.path.join(output_dir, "cervical_cm.png")
    plot_confusion_matrix(
        metrics["confusion_matrix"],
        CLASS_NAMES,
        model_name="SIPaKMeD 5-Class ViT",
        save_path=cm_path,
    )
    print(f"[+] Saved 5x5 Confusion Matrix to: {cm_path}")

    # Per-class ROC curves
    roc_path = os.path.join(output_dir, "cervical_roc_curves.png")
    plot_multiclass_roc_curve(
        y_true,
        y_probs,
        CLASS_NAMES,
        model_name="SIPaKMeD 5-Class ViT",
        save_path=roc_path,
    )
    print(f"[+] Saved Per-Class ROC Curves to: {roc_path}")

    return {
        "metrics": metrics,
        "bethesda": bethesda_results,
        "top_misclassifications": top_pairs,
        "accuracy": acc,
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate Cervical Cytology ViT Model on SIPaKMeD")
    parser.add_argument(
        "--model_path",
        type=str,
        default=os.path.join(training_root, "weights", "cervical_model.pth"),
        help="Path to trained ViT model weights (.pth)",
    )
    parser.add_argument(
        "--data_dir",
        type=str,
        default=os.path.join(training_root, "data", "cervical", "raw"),
        help="Path to SIPaKMeD raw data folder",
    )
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument(
        "--output_dir",
        type=str,
        default=os.path.join(training_root, "logs"),
        help="Directory to save evaluation plots and artifacts",
    )
    args = parser.parse_args()

    run_evaluation(
        model_path=args.model_path,
        data_dir=args.data_dir,
        batch_size=args.batch_size,
        device=args.device,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    main()
