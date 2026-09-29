"""
Shared Clinical Evaluation Metrics for AuraMed Models.
Provides clinical-grade metrics focusing on high sensitivity, PPV/NPV,
optimal threshold calibration, and formatted clinical reports.
"""
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    auc,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
)


def compute_clinical_metrics(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[float], np.ndarray],
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Computes all metrics needed for clinical validation of screening models.
    
    Clinical Note: In screening applications, sensitivity (recall) is prioritized
    over specificity to minimize false negatives (missed cases), even at the cost
    of manageable increases in false positives.
    
    Returns:
        auc_roc: float
        auc_pr: float
        sensitivity: float (True Positive Rate / Recall)
        specificity: float (True Negative Rate)
        ppv: float (Positive Predictive Value / Precision)
        npv: float (Negative Predictive Value)
        f1_score: float
        accuracy: float
        confusion_matrix: list of lists [[TN, FP], [FN, TP]]
        threshold_used: float
        threshold_analysis: list of dicts with sensitivity & specificity across thresholds
    """
    y_true_arr = np.asarray(y_true, dtype=int)
    y_pred_arr = np.asarray(y_pred_proba, dtype=float)

    if len(y_true_arr) == 0:
        raise ValueError("y_true and y_pred_proba cannot be empty.")

    # AUC-ROC and AUC-PR (handle single-class edge cases gracefully)
    has_both_classes = len(np.unique(y_true_arr)) > 1
    if has_both_classes:
        try:
            auc_roc_val = float(roc_auc_score(y_true_arr, y_pred_arr))
        except Exception:
            auc_roc_val = 0.5
        try:
            precisions, recalls, _ = precision_recall_curve(y_true_arr, y_pred_arr)
            auc_pr_val = float(auc(recalls, precisions))
        except Exception:
            auc_pr_val = 0.0
    else:
        auc_roc_val = 1.0 if np.all(y_true_arr == (y_pred_arr >= threshold)) else 0.5
        auc_pr_val = 1.0 if np.all(y_true_arr == 1) else 0.0

    # Binary classification at threshold
    y_pred_bin = (y_pred_arr >= threshold).astype(int)

    # Confusion matrix: [[TN, FP], [FN, TP]]
    cm = confusion_matrix(y_true_arr, y_pred_bin, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    sensitivity = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    ppv = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    npv = float(tn / (tn + fn)) if (tn + fn) > 0 else 0.0

    acc = float(accuracy_score(y_true_arr, y_pred_bin))
    f1 = float(f1_score(y_true_arr, y_pred_bin, zero_division=0))

    # Multi-threshold analysis across standard screening operating points
    test_thresholds = [0.3, 0.4, 0.5, 0.6, 0.7]
    threshold_analysis = []
    for th in test_thresholds:
        preds_th = (y_pred_arr >= th).astype(int)
        cm_th = confusion_matrix(y_true_arr, preds_th, labels=[0, 1])
        tn_i, fp_i, fn_i, tp_i = cm_th.ravel()
        sens_i = float(tp_i / (tp_i + fn_i)) if (tp_i + fn_i) > 0 else 0.0
        spec_i = float(tn_i / (tn_i + fp_i)) if (tn_i + fp_i) > 0 else 0.0
        threshold_analysis.append({
            "threshold": th,
            "sensitivity": round(sens_i, 4),
            "specificity": round(spec_i, 4),
            "ppv": round(float(tp_i / (tp_i + fp_i)) if (tp_i + fp_i) > 0 else 0.0, 4),
            "npv": round(float(tn_i / (tn_i + fn_i)) if (tn_i + fn_i) > 0 else 0.0, 4),
        })

    return {
        "auc_roc": round(auc_roc_val, 4),
        "auc_pr": round(auc_pr_val, 4),
        "sensitivity": round(sensitivity, 4),
        "specificity": round(specificity, 4),
        "ppv": round(ppv, 4),
        "npv": round(npv, 4),
        "f1_score": round(f1, 4),
        "accuracy": round(acc, 4),
        "confusion_matrix": cm.tolist(),
        "threshold_used": float(threshold),
        "threshold_analysis": threshold_analysis,
    }


def find_optimal_threshold(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[float], np.ndarray],
    optimize_for: str = "sensitivity",
    min_sensitivity: float = 0.90,
) -> float:
    """
    Finds the optimal classification threshold that satisfies clinical screening goals.
    
    For clinical screening: finds the threshold where sensitivity >= min_sensitivity (default 90%)
    while maximizing specificity to prevent unnecessary false alarms.
    
    If no threshold achieves min_sensitivity, returns the threshold that maximizes sensitivity.
    """
    y_true_arr = np.asarray(y_true, dtype=int)
    y_pred_arr = np.asarray(y_pred_proba, dtype=float)

    # Scan candidate thresholds from 0.01 to 0.99
    candidates = np.linspace(0.01, 0.99, 197)
    valid_thresholds = []

    best_threshold = 0.5
    max_sens = -1.0
    best_spec_under_constraint = -1.0

    for th in candidates:
        preds = (y_pred_arr >= th).astype(int)
        cm = confusion_matrix(y_true_arr, preds, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()

        sens = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

        if sens >= min_sensitivity:
            valid_thresholds.append((th, sens, spec))
            if spec > best_spec_under_constraint:
                best_spec_under_constraint = spec
                best_threshold = float(th)
        else:
            if sens > max_sens:
                max_sens = sens

    # If constraint satisfied, return the threshold that maximizes specificity
    if valid_thresholds:
        return round(best_threshold, 3)

    # Fallback: find threshold with highest sensitivity
    best_fallback_th = 0.5
    highest_sens = -1.0
    for th in candidates:
        preds = (y_pred_arr >= th).astype(int)
        cm = confusion_matrix(y_true_arr, preds, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        sens = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        if sens > highest_sens:
            highest_sens = sens
            best_fallback_th = float(th)

    return round(best_fallback_th, 3)


def print_clinical_report(
    metrics: Dict[str, Any],
    model_name: str,
    dataset_name: str,
):
    """
    Prints a formatted clinical validation report conforming to standard regulatory
    and clinical decision support documentation guidelines.
    """
    auc_roc = metrics.get("auc_roc", 0.0)
    auc_pr = metrics.get("auc_pr", 0.0)
    th = metrics.get("threshold_used", 0.5)
    sens = metrics.get("sensitivity", 0.0)
    spec = metrics.get("specificity", 0.0)
    ppv = metrics.get("ppv", 0.0)
    npv = metrics.get("npv", 0.0)
    f1 = metrics.get("f1_score", 0.0)
    acc = metrics.get("accuracy", 0.0)
    cm = metrics.get("confusion_matrix", [[0, 0], [0, 0]])
    analysis = metrics.get("threshold_analysis", [])

    print("================================================")
    print("CLINICAL VALIDATION REPORT")
    print(f"Model: {model_name}")
    print(f"Dataset: {dataset_name}")
    print("================================================\n")

    print("PRIMARY METRICS:")
    print(f"AUC-ROC:          {auc_roc:.4f}")
    print(f"AUC-PR:           {auc_pr:.4f}\n")

    print(f"AT OPTIMAL THRESHOLD ({th:.2f}):")
    print(f"Sensitivity:      {sens:.4f} ({sens * 100:.1f}%)")
    print(f"Specificity:      {spec:.4f} ({spec * 100:.1f}%)")
    print(f"PPV:              {ppv:.4f}")
    print(f"NPV:              {npv:.4f}")
    print(f"F1 Score:         {f1:.4f}")
    print(f"Accuracy:         {acc:.4f}\n")

    print("CONFUSION MATRIX:")
    tn, fp = cm[0][0], cm[0][1]
    fn, tp = cm[1][0], cm[1][1]
    print(f"                 Predicted Negative    Predicted Positive")
    print(f"Actual Negative  {tn:<21} {fp:<21} (TN={tn}, FP={fp})")
    print(f"Actual Positive  {fn:<21} {tp:<21} (FN={fn}, TP={tp})\n")

    print("THRESHOLD ANALYSIS:")
    print(f"{'Threshold':<12} {'Sensitivity':<14} {'Specificity':<14} {'PPV':<10} {'NPV':<10}")
    print("-" * 60)
    for row in analysis:
        print(
            f"{row['threshold']:<12.2f} "
            f"{row['sensitivity']:<14.4f} "
            f"{row['specificity']:<14.4f} "
            f"{row.get('ppv', 0.0):<10.4f} "
            f"{row.get('npv', 0.0):<10.4f}"
        )
    print()

    print("CLINICAL INTERPRETATION:")
    print(f"At this threshold ({th:.2f}), the model correctly identifies")
    print(f"{sens * 100:.1f}% of positive cases (sensitivity).")
    print(f"{spec * 100:.1f}% of negative cases are correctly")
    print(f"identified as negative (specificity).")
    print("================================================")


def compute_multiclass_metrics(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[List[float]], np.ndarray],
    class_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Computes comprehensive clinical validation metrics for multi-class medical diagnostic models.
    
    Returns:
      accuracy: overall accuracy
      per_class_accuracy: dict of {class_name: accuracy}
      per_class_sensitivity: dict of {class_name: sensitivity/recall}
      per_class_specificity: dict of {class_name: specificity}
      per_class_precision: dict of {class_name: precision/PPV}
      per_class_auc: dict of One-vs-Rest AUC-ROC per class
      macro_f1: unweighted average F1 across all classes
      weighted_f1: F1 weighted by class support
      confusion_matrix: N x N list of lists
      classification_report: dict report of per-class precision, recall, F1, and support
    """
    y_true_arr = np.asarray(y_true, dtype=int)
    probs_arr = np.asarray(y_pred_proba, dtype=float)

    if probs_arr.ndim == 1:
        # Reshape if 1D
        probs_arr = probs_arr.reshape(-1, 1)

    n_classes = probs_arr.shape[1]
    if class_names is None:
        class_names = [f"Class_{i}" for i in range(n_classes)]

    preds = np.argmax(probs_arr, axis=1)
    acc = float(accuracy_score(y_true_arr, preds))
    cm = confusion_matrix(y_true_arr, preds, labels=list(range(n_classes)))

    per_class_acc = {}
    per_class_sens = {}
    per_class_spec = {}
    per_class_prec = {}
    per_class_auc = {}

    total_samples = len(y_true_arr)

    for i, c_name in enumerate(class_names):
        # One-vs-rest binary metrics for class i
        tp = int(cm[i, i])
        fn = int(np.sum(cm[i, :]) - tp)
        fp = int(np.sum(cm[:, i]) - tp)
        tn = int(total_samples - (tp + fn + fp))

        sens = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        c_acc = float((tp + tn) / total_samples) if total_samples > 0 else 0.0

        per_class_acc[c_name] = round(c_acc, 4)
        per_class_sens[c_name] = round(sens, 4)
        per_class_spec[c_name] = round(spec, 4)
        per_class_prec[c_name] = round(prec, 4)

        # OvR AUC
        try:
            bin_true = (y_true_arr == i).astype(int)
            if len(np.unique(bin_true)) > 1:
                auc_i = float(roc_auc_score(bin_true, probs_arr[:, i]))
            else:
                auc_i = 1.0
            per_class_auc[c_name] = round(auc_i, 4)
        except Exception:
            per_class_auc[c_name] = 0.5

    macro_f1 = float(f1_score(y_true_arr, preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_true_arr, preds, average="weighted", zero_division=0))

    # Sklearn classification report
    from sklearn.metrics import classification_report
    cls_report = classification_report(
        y_true_arr,
        preds,
        labels=list(range(n_classes)),
        target_names=class_names,
        output_dict=True,
        zero_division=0,
    )

    return {
        "accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "per_class_accuracy": per_class_acc,
        "per_class_sensitivity": per_class_sens,
        "per_class_specificity": per_class_spec,
        "per_class_precision": per_class_prec,
        "per_class_auc": per_class_auc,
        "confusion_matrix": cm.tolist(),
        "classification_report": cls_report,
    }


def evaluate_bethesda_clinical_mapping(
    y_true: Union[List[int], np.ndarray],
    y_pred_proba: Union[List[List[float]], np.ndarray],
    class_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Translates model predictions to the clinical 2014 Bethesda System for Cervical Cytology:
      - Normal (4) -> NILM (Negative for Intraepithelial Lesion or Malignancy)
      - Koilocytotic (1) -> LSIL (Low-grade Squamous Intraepithelial Lesion)
      - Metaplastic (2) -> ASC-US (Atypical Squamous Cells of Undetermined Significance)
      - Parabasal (3) -> ASC-H (Atypical Squamous Cells, cannot exclude HSIL)
      - Dyskeratotic (0) -> HSIL (High-grade Squamous Intraepithelial Lesion)
      
    Specifically evaluates high-risk detection (HSIL sensitivity), which is the most critical
    clinical safety metric to prevent progression to invasive cervical carcinoma.
    """
    y_true_arr = np.asarray(y_true, dtype=int)
    probs_arr = np.asarray(y_pred_proba, dtype=float)
    preds = np.argmax(probs_arr, axis=1)

    bethesda_map = {
        0: "HSIL (High-Grade Lesion)",
        1: "LSIL (Low-Grade Lesion)",
        2: "ASC-US (Atypical Squamous Cells)",
        3: "ASC-H (Cannot exclude HSIL)",
        4: "NILM (Negative / Normal)",
    }

    # HSIL is Class 0 (Dyskeratotic)
    hsil_true_indices = (y_true_arr == 0)
    total_hsil = int(np.sum(hsil_true_indices))
    correct_hsil = int(np.sum(preds[hsil_true_indices] == 0)) if total_hsil > 0 else 0
    hsil_sensitivity = float(correct_hsil / total_hsil) if total_hsil > 0 else 0.0

    pct = hsil_sensitivity * 100.0

    print("\n" + "=" * 65)
    print(" BETHESDA SYSTEM CLINICAL SAFETY EVALUATION")
    print("=" * 65)
    print(f" High-risk detection (HSIL sensitivity): {pct:.1f}% ({correct_hsil}/{total_hsil} cases)")
    print(f" Clinical Significance:")
    print(f"   This means {pct:.1f}% of high-grade dysplasia cases (HSIL)")
    print(f"   are correctly flagged for immediate colposcopy and clinical attention.")
    print("=" * 65 + "\n")

    return {
        "hsil_sensitivity": round(hsil_sensitivity, 4),
        "total_hsil_cases": total_hsil,
        "correct_hsil_cases": correct_hsil,
        "bethesda_map": bethesda_map,
    }

