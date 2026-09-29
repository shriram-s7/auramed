"""
Utility script to synchronize trained weights and metadata JSON files
from the training environment (training/weights) to the backend runtime (backend/app/ml/weights).
"""
import json
import os
import shutil
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)


def copy_weights_to_app(
    source_dir: str = os.path.join(current_dir, "weights"),
    dest_dir: str = os.path.join(project_root, "backend", "app", "ml", "weights"),
):
    """
    Copies trained .pth weights and .json metadata for Breast, Cervical, and PCOS
    to the backend application directory and prints descriptive model cards.
    """
    os.makedirs(dest_dir, exist_ok=True)
    models = ["breast", "cervical", "pcos"]

    print("\n" + "=" * 65)
    print(" SYNCHRONIZING TRAINED WEIGHTS & METADATA TO BACKEND")
    print("=" * 65)
    print(f"Source:      {source_dir}")
    print(f"Destination: {dest_dir}\n")

    for model in models:
        weight_file = f"{model}_model.pth"
        metadata_file = f"{model}_model_metadata.json"

        src_weight = os.path.join(source_dir, weight_file)
        dst_weight = os.path.join(dest_dir, weight_file)

        src_meta = os.path.join(source_dir, metadata_file)
        dst_meta = os.path.join(dest_dir, metadata_file)

        # 1. Copy Weights
        if os.path.exists(src_weight):
            shutil.copy2(src_weight, dst_weight)
            print(f"[+] Copied {model} weights -> {dst_weight}")
        else:
            print(f"[!] Warning: {model} weights not found. System will use formula-only mode for this module.")

        # 2. Copy & Inspect Metadata
        if os.path.exists(src_meta):
            shutil.copy2(src_meta, dst_meta)
            try:
                with open(src_meta, "r") as f:
                    meta = json.load(f)

                dataset = meta.get("dataset", meta.get("model_config", {}).get("dataset", "Benchmark Dataset"))
                metrics = meta.get("metrics", meta.get("performance_metrics", {}))

                auc = metrics.get("auc_roc", metrics.get("accuracy", metrics.get("macro_f1", "N/A")))
                sens = metrics.get("sensitivity", metrics.get("bethesda", {}).get("hsil_sensitivity", "N/A"))
                spec = metrics.get("specificity", "N/A")
                threshold = meta.get("optimal_threshold", 0.5)
                timestamp = meta.get("timestamp", meta.get("export_timestamp", "N/A"))

                print(f"    --- {model.upper()} MODEL SUMMARY ---")
                print(f"    Model:             {model}")
                print(f"    Trained on:        {dataset}")
                print(f"    AUC / Performance: {auc}")
                print(f"    Sensitivity:       {sens}")
                print(f"    Specificity:       {spec}")
                print(f"    Optimal threshold: {threshold}")
                print(f"    Trained on:        {timestamp}")
                print("    -----------------------------")
            except Exception as e:
                print(f"[!] Warning: Could not parse metadata for {model}: {e}")
        else:
            print(f"[!] Warning: {model} metadata not found.")

        print()

    print("=" * 65 + "\n")


if __name__ == "__main__":
    copy_weights_to_app()
