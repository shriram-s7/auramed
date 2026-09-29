"""
Model Exporter and Weight Serialization for AuraMed Training Environment.
Saves PyTorch state dicts, clinical validation metrics, hyperparameter configurations,
and metadata JSON documents for backend clinical inference consumption.
"""
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import numpy as np
import torch
import torch.nn as nn


def _sanitize_for_json(obj: Any) -> Any:
    """Recursively converts NumPy types, tensors, and non-serializable objects to JSON primitives."""
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, torch.Tensor):
        return obj.detach().cpu().numpy().tolist()
    elif hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj


def export_model(
    model: nn.Module,
    model_name: str,
    metrics: Dict[str, Any],
    config: Dict[str, Any],
    output_dir: Optional[str] = None,
) -> Dict[str, str]:
    """
    Saves the trained model checkpoint with clinical metadata and JSON descriptors.
    
    Outputs:
      1. training/weights/{model_name}.pth
         Contains dictionary:
           - model_state_dict: model.state_dict()
           - metrics: validation metrics dict
           - config: training configuration hyperparameters
           - timestamp: ISO datetime string
           - optimal_threshold: float (from metrics or config)
           - dataset: dataset name
           - architecture: architecture name
      2. training/weights/{model_name}_metadata.json
         Contains inference parameters and calibrated threshold for the clinical runtime.
         
    Returns:
      Dict with paths to saved checkpoint and metadata JSON:
      {"checkpoint_path": "...", "metadata_path": "..."}
    """
    if output_dir is None:
        # Default to training/weights/ relative to current file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        training_root = os.path.dirname(current_dir)
        output_dir = os.path.join(training_root, "weights")

    os.makedirs(output_dir, exist_ok=True)

    timestamp_str = datetime.now(timezone.utc).isoformat()
    optimal_th = float(
        metrics.get("threshold_used")
        or metrics.get("optimal_threshold")
        or config.get("optimal_threshold", 0.5)
    )
    dataset_name = config.get("dataset", "clinical_dataset")
    arch_name = config.get("architecture", model.__class__.__name__)

    # Extract state dict (handling DataParallel or DistributedDataParallel)
    raw_model = model.module if hasattr(model, "module") else model
    state_dict = raw_model.state_dict()

    checkpoint_payload = {
        "model_state_dict": state_dict,
        "metrics": _sanitize_for_json(metrics),
        "config": _sanitize_for_json(config),
        "timestamp": timestamp_str,
        "optimal_threshold": optimal_th,
        "dataset": dataset_name,
        "architecture": arch_name,
    }

    # 1. Save .pth checkpoint
    checkpoint_filename = f"{model_name}.pth"
    checkpoint_path = os.path.join(output_dir, checkpoint_filename)
    torch.save(checkpoint_payload, checkpoint_path)

    # 2. Save metadata JSON
    metadata_payload = {
        "model_name": model_name,
        "architecture": arch_name,
        "dataset": dataset_name,
        "optimal_threshold": optimal_th,
        "timestamp": timestamp_str,
        "metrics": _sanitize_for_json(metrics),
        "input_resolution": config.get("input_resolution", [224, 224]),
        "normalization": {
            "mean": config.get("mean", [0.485, 0.456, 0.406]),
            "std": config.get("std", [0.229, 0.224, 0.225]),
        },
        "classes": config.get("classes", ["Negative", "Positive"]),
    }

    metadata_filename = f"{model_name}_metadata.json"
    metadata_path = os.path.join(output_dir, metadata_filename)
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata_payload, f, indent=2)

    print(f" Successfully exported model to {checkpoint_path}")
    print(f" Successfully exported inference metadata to {metadata_path}")

    return {
        "checkpoint_path": checkpoint_path,
        "metadata_path": metadata_path,
    }
