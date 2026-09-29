"""
Step 1: Inspect checkpoint files to understand their exact structure
Run this first to see what keys are in each weight file
"""
import subprocess
subprocess.run("pip install torch --break-system-packages -q", shell=True)

import torch
from pathlib import Path

WEIGHTS_DIR = Path("E:/auramed/backend/app/ml/weights")

print("Inspecting weight files in:", WEIGHTS_DIR)
print()

for wf in sorted(WEIGHTS_DIR.glob("*")):
    if wf.suffix in [".pth", ".pt", ".bin", ".ckpt"]:
        print("="*60)
        print("FILE:", wf.name, f"({wf.stat().st_size / 1024 / 1024:.1f} MB)")
        try:
            ckpt = torch.load(str(wf), map_location="cpu")
            if isinstance(ckpt, dict):
                print("  Type: dict")
                print("  Top-level keys:", list(ckpt.keys())[:10])
                # Find the actual state dict
                for k in ["model_state_dict", "state_dict", "model", "weights"]:
                    if k in ckpt:
                        sd = ckpt[k]
                        keys = list(sd.keys())
                        print(f"  State dict under '{k}': {len(keys)} keys")
                        print(f"  First 3 keys: {keys[:3]}")
                        print(f"  Last 3 keys: {keys[-3:]}")
                        break
                else:
                    # maybe it IS the state dict directly
                    keys = list(ckpt.keys())
                    print(f"  Direct state dict: {len(keys)} keys")
                    print(f"  First 3 keys: {keys[:3]}")
                    # check if values are tensors
                    first_val = list(ckpt.values())[0]
                    print(f"  First value type: {type(first_val)}")
                    if hasattr(first_val, 'shape'):
                        print(f"  First value shape: {first_val.shape}")
                # check for extra metadata
                for k in ["epoch", "best_auc", "val_auc", "threshold", "config"]:
                    if k in ckpt:
                        print(f"  Metadata '{k}': {ckpt[k]}")
            else:
                print("  Type:", type(ckpt))
        except Exception as e:
            print("  ERROR:", e)
        print()