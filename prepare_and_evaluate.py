"""
AuraMed Demo Data Preparation + Model Evaluation
1. Converts DICOM malignant breast images to PNG
2. Runs all demo images through all 3 models
3. Reports accuracy per class
"""

import subprocess
import sys
import os
from pathlib import Path

DEMO_ROOT = Path("E:/auramed/demo_data")
AURAMED   = Path("E:/auramed")

# ── STEP 1: Convert DICOM to PNG ────────────────────────────────────────────
def convert_dicoms():
    print("\n" + "="*60)
    print("STEP 1: Converting DICOM malignant images to PNG")
    print("="*60)

    malignant_dir = DEMO_ROOT / "breast" / "malignant"
    dcm_files = list(malignant_dir.glob("*.dcm"))

    if not dcm_files:
        print("  No DICOM files found in malignant folder.")
        return

    print(f"  Found {len(dcm_files)} DICOM files. Installing pydicom + pillow...")
    subprocess.run("pip install pydicom pillow numpy --break-system-packages -q",
                   shell=True)

    import importlib
    pydicom  = importlib.import_module("pydicom")
    PIL      = importlib.import_module("PIL.Image")
    np       = importlib.import_module("numpy")

    converted = 0
    for dcm_path in dcm_files:
        try:
            ds = pydicom.dcmread(str(dcm_path))
            arr = ds.pixel_array.astype(np.float32)
            # Normalize to 0-255
            arr_min, arr_max = arr.min(), arr.max()
            if arr_max > arr_min:
                arr = (arr - arr_min) / (arr_max - arr_min) * 255
            arr = arr.astype(np.uint8)
            img = PIL.fromarray(arr)
            if img.mode != "RGB":
                img = img.convert("RGB")
            out_path = malignant_dir / (dcm_path.stem + ".png")
            img.save(str(out_path))
            dcm_path.unlink()  # remove original dcm
            converted += 1
            print(f"  Converted: {dcm_path.name} -> {out_path.name}")
        except Exception as e:
            print(f"  Failed {dcm_path.name}: {e}")

    print(f"\n  Done. Converted {converted} DICOM files to PNG.")


# ── STEP 2: Run model inference on all demo images ──────────────────────────
def run_inference():
    print("\n" + "="*60)
    print("STEP 2: Running model inference on all demo images")
    print("="*60)

    # Install deps
    subprocess.run("pip install torch torchvision timm pillow numpy --break-system-packages -q",
                   shell=True)

    import importlib
    torch     = importlib.import_module("torch")
    timm      = importlib.import_module("timm")
    tv_trans  = importlib.import_module("torchvision.transforms")
    PIL       = importlib.import_module("PIL.Image")
    np        = importlib.import_module("numpy")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")

    # Model configs matching your training setup
    MODEL_CONFIGS = {
        "breast": {
            "weight_file": AURAMED / "backend/app/ml/weights/breast_model.pth",
            "arch": "efficientnet_b3",
            "num_classes": 1,
            "threshold": 0.18,
            "img_size": 224,
            "classes": {0: "benign", 1: "malignant"},
            "test_dir": DEMO_ROOT / "breast",
            "label_map": {"benign": 0, "malignant": 1},
        },
        "cervical": {
            "weight_file": AURAMED / "backend/app/ml/weights/cervical_model.pth",
            "arch": "vit_base_patch16_224",
            "num_classes": 5,
            "threshold": None,
            "img_size": 224,
            "classes": {0: "NILM", 1: "LSIL", 2: "HSIL", 3: "SCC", 4: "AGC"},
            "test_dir": DEMO_ROOT / "cervical",
            "label_map": {"NILM": 0, "LSIL": 1, "HSIL": 2, "SCC": 3, "AGC": 4},
        },
        "pcos": {
            "weight_file": AURAMED / "backend/app/ml/weights/pcos_model.pth",
            "arch": "resnet50",
            "num_classes": 1,
            "threshold": 0.5,
            "img_size": 224,
            "classes": {0: "healthy", 1: "pcos"},
            "test_dir": DEMO_ROOT / "pcos",
            "label_map": {"healthy": 0, "pcos": 1},
        },
    }

    transform = tv_trans.Compose([
        tv_trans.Resize((224, 224)),
        tv_trans.ToTensor(),
        tv_trans.Normalize([0.485, 0.456, 0.406],
                           [0.229, 0.224, 0.225]),
    ])

    all_results = {}

    for module, cfg in MODEL_CONFIGS.items():
        print(f"\n--- MODULE: {module.upper()} ---")

        weight_file = cfg["weight_file"]
        if not weight_file.exists():
            # try alternate names
            weights_dir = AURAMED / "backend/app/ml/weights"
            candidates = list(weights_dir.glob(f"*{module}*"))
            if candidates:
                weight_file = candidates[0]
                print(f"  Using weight file: {weight_file.name}")
            else:
                print(f"  ERROR: No weight file found for {module}. Skipping.")
                continue

        # Load model
        try:
            model = timm.create_model(
                cfg["arch"],
                pretrained=False,
                num_classes=cfg["num_classes"]
            )
            state = torch.load(str(weight_file), map_location=device)
            # Handle various checkpoint formats
            if isinstance(state, dict):
                if "model_state_dict" in state:
                    state = state["model_state_dict"]
                elif "state_dict" in state:
                    state = state["state_dict"]
            model.load_state_dict(state, strict=False)
            model.to(device)
            model.eval()
            print(f"  Model loaded: {cfg['arch']}")
        except Exception as e:
            print(f"  ERROR loading model: {e}")
            continue

        module_results = []
        test_dir = cfg["test_dir"]

        for label_dir in sorted(test_dir.iterdir()):
            if not label_dir.is_dir():
                continue
            true_label = label_dir.name
            true_class = cfg["label_map"].get(true_label)
            if true_class is None:
                print(f"  Skipping unknown label: {true_label}")
                continue

            imgs = [f for f in label_dir.iterdir()
                    if f.suffix.lower() in [".jpg",".jpeg",".png",".bmp"]]

            for img_path in sorted(imgs):
                try:
                    img = PIL.open(str(img_path)).convert("RGB")
                    tensor = transform(img).unsqueeze(0).to(device)

                    with torch.no_grad():
                        out = model(tensor)

                    if cfg["num_classes"] == 1:
                        score = torch.sigmoid(out).item()
                        pred_class = 1 if score >= cfg["threshold"] else 0
                        pred_label = cfg["classes"][pred_class]
                        correct = pred_class == true_class
                        module_results.append({
                            "file": img_path.name,
                            "true": true_label,
                            "pred": pred_label,
                            "score": round(score, 3),
                            "correct": correct,
                        })
                        mark = "OK" if correct else "WRONG"
                        print(f"  [{mark}] {img_path.name}: true={true_label} "
                              f"pred={pred_label} score={score:.3f}")
                    else:
                        probs = torch.softmax(out, dim=1)[0]
                        pred_class = probs.argmax().item()
                        pred_label = cfg["classes"][pred_class]
                        confidence = probs[pred_class].item()
                        correct = pred_class == true_class
                        module_results.append({
                            "file": img_path.name,
                            "true": true_label,
                            "pred": pred_label,
                            "score": round(confidence, 3),
                            "correct": correct,
                        })
                        mark = "OK" if correct else "WRONG"
                        print(f"  [{mark}] {img_path.name}: true={true_label} "
                              f"pred={pred_label} conf={confidence:.3f}")

                except Exception as e:
                    print(f"  ERROR on {img_path.name}: {e}")

        all_results[module] = module_results


    # ── SUMMARY ─────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("EVALUATION SUMMARY")
    print("="*60)

    total_correct = 0
    total_images  = 0

    for module, results in all_results.items():
        if not results:
            continue
        correct = sum(1 for r in results if r["correct"])
        total   = len(results)
        acc     = correct / total * 100 if total > 0 else 0
        total_correct += correct
        total_images  += total

        print(f"\n  {module.upper()}: {correct}/{total} correct ({acc:.1f}%)")

        # per-class breakdown
        classes = set(r["true"] for r in results)
        for cls in sorted(classes):
            cls_results = [r for r in results if r["true"] == cls]
            cls_correct = sum(1 for r in cls_results if r["correct"])
            print(f"    {cls}: {cls_correct}/{len(cls_results)}")

        # show wrong predictions
        wrong = [r for r in results if not r["correct"]]
        if wrong:
            print(f"  Mispredicted ({len(wrong)}):")
            for r in wrong:
                print(f"    {r['file']}: true={r['true']} pred={r['pred']} score={r['score']}")

    if total_images > 0:
        overall = total_correct / total_images * 100
        print(f"\n  OVERALL: {total_correct}/{total_images} correct ({overall:.1f}%)")
    print("="*60)


def main():
    print("AuraMed Demo Data: DICOM Conversion + Model Evaluation")
    convert_dicoms()
    run_inference()


if __name__ == "__main__":
    main()