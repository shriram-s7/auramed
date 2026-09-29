"""
AuraMed Model Evaluation - Corrected
Uses exact architecture and class mapping from checkpoint metadata
"""
import subprocess
subprocess.run("pip install torch torchvision timm pillow numpy --break-system-packages -q",
               shell=True, capture_output=True)

import torch
import torch.nn as nn
import timm
from torchvision import transforms
from PIL import Image
import numpy as np
from pathlib import Path

DEMO_ROOT = Path("E:/auramed/demo_data")
WEIGHTS   = Path("E:/auramed/backend/app/ml/weights")
device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}\n")

# ── Custom model wrappers matching your training code ────────────────────────

class BreastModel(nn.Module):
    """Matches breast training: resnet50 with custom head, keys prefixed 'resnet.'"""
    def __init__(self):
        super().__init__()
        import torchvision.models as tvm
        base = tvm.resnet50(weights=None)
        # Replace fc with single output (binary)
        base.fc = nn.Linear(base.fc.in_features, 1)
        self.resnet = base

    def forward(self, x):
        return self.resnet(x)

    def load(self, path):
        ckpt = torch.load(path, map_location=device)
        sd = ckpt["model_state_dict"]
        # Keys are like 'resnet.conv1.weight' -> load directly
        self.load_state_dict(sd, strict=True)
        threshold = ckpt.get("optimal_threshold", 0.18)
        print(f"  Loaded breast model. Threshold: {threshold}")
        return threshold


class PCOSModel(nn.Module):
    """Matches PCOS training: resnet50 with Sequential fc, keys prefixed 'resnet.'"""
    def __init__(self):
        super().__init__()
        import torchvision.models as tvm
        base = tvm.resnet50(weights=None)
        # PCOS uses Sequential fc: [Linear(2048,1), Sigmoid] based on key 'resnet.fc.1'
        base.fc = nn.Sequential(
            nn.Linear(base.fc.in_features, 1),
            nn.Sigmoid()
        )
        self.resnet = base

    def forward(self, x):
        return self.resnet(x)

    def load(self, path):
        ckpt = torch.load(path, map_location=device)
        sd = ckpt["model_state_dict"]
        self.load_state_dict(sd, strict=True)
        threshold = ckpt.get("optimal_threshold", 0.04)
        print(f"  Loaded PCOS model. Threshold: {threshold}")
        return threshold


def load_cervical(path):
    """ViT-Base with 5 classes, keys have no prefix (standard timm)"""
    ckpt = torch.load(path, map_location=device)
    sd = ckpt["model_state_dict"]
    model = timm.create_model("vit_base_patch16_224", pretrained=False, num_classes=5)
    model.load_state_dict(sd, strict=True)
    print(f"  Loaded cervical model (ViT-Base, 5 classes)")
    return model


# ── Transforms ───────────────────────────────────────────────────────────────
tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def infer_image(model, img_path, is_sigmoid=False):
    img = Image.open(str(img_path)).convert("RGB")
    t = tf(img).unsqueeze(0).to(device)
    with torch.no_grad():
        out = model(t)
    return out


# ── BREAST ───────────────────────────────────────────────────────────────────
def eval_breast():
    print("\n" + "="*60)
    print("BREAST CANCER MODULE")
    print("="*60)
    # Classes from checkpoint: ['Benign', 'Malignant']
    # Binary: score >= threshold -> malignant
    # Our demo labels: benign/ malignant/

    model = BreastModel().to(device)
    try:
        threshold = model.load(str(WEIGHTS / "breast_model.pth"))
    except Exception as e:
        print(f"  Load error: {e}")
        # Try with strict=False to see which keys mismatch
        ckpt = torch.load(str(WEIGHTS / "breast_model.pth"), map_location=device)
        sd = ckpt["model_state_dict"]
        print("  Sample keys:", list(sd.keys())[:5])
        return

    model.eval()
    results = []

    for label_dir in ["benign", "malignant"]:
        d = DEMO_ROOT / "breast" / label_dir
        true_class = 0 if label_dir == "benign" else 1
        for img_path in sorted(d.glob("*.png")) + sorted(d.glob("*.jpg")):
            out = infer_image(model, img_path)
            score = torch.sigmoid(out).item()
            pred = 1 if score >= threshold else 0
            pred_label = "malignant" if pred == 1 else "benign"
            correct = pred == true_class
            mark = "OK   " if correct else "WRONG"
            print(f"  [{mark}] {img_path.name}: score={score:.3f} "
                  f"pred={pred_label} true={label_dir}")
            results.append(correct)

    acc = sum(results) / len(results) * 100 if results else 0
    print(f"\n  Accuracy: {sum(results)}/{len(results)} ({acc:.1f}%)")
    return results


# ── CERVICAL ─────────────────────────────────────────────────────────────────
def eval_cervical():
    print("\n" + "="*60)
    print("CERVICAL CANCER MODULE")
    print("="*60)

    # SIPaKMeD 5 classes:
    # 0=Dyskeratotic, 1=Koilocytotic, 2=Metaplastic, 3=Parabasal, 4=Normal
    # Clinical mapping:
    #   Dyskeratotic -> HSIL (abnormal, high-grade)
    #   Koilocytotic -> LSIL (HPV-associated, low-grade)
    #   Metaplastic  -> NILM (normal transformation zone)
    #   Parabasal    -> NILM (normal basal layer)
    #   Normal       -> NILM (normal superficial)
    SIPAKMED_TO_BETHESDA = {
        0: "HSIL",   # Dyskeratotic
        1: "LSIL",   # Koilocytotic
        2: "NILM",   # Metaplastic
        3: "NILM",   # Parabasal
        4: "NILM",   # Normal
    }
    CLASS_NAMES = ["Dyskeratotic", "Koilocytotic", "Metaplastic", "Parabasal", "Normal"]

    try:
        model = load_cervical(str(WEIGHTS / "cervical_model.pth"))
    except Exception as e:
        print(f"  Load error: {e}")
        return

    model = model.to(device)
    model.eval()
    results = []

    # Our demo has HSIL/ and LSIL/ folders
    # Expected: HSIL images -> model predicts Dyskeratotic (class 0)
    #           LSIL images -> model predicts Koilocytotic (class 1)
    DEMO_TO_BETHESDA = {"HSIL": "HSIL", "LSIL": "LSIL"}

    for label_dir in ["HSIL", "LSIL"]:
        d = DEMO_ROOT / "cervical" / label_dir
        if not d.exists():
            continue
        for img_path in sorted(d.glob("*.jpg")) + sorted(d.glob("*.png")):
            out = infer_image(model, img_path)
            probs = torch.softmax(out, dim=1)[0]
            pred_class = probs.argmax().item()
            pred_sipakmed = CLASS_NAMES[pred_class]
            pred_bethesda = SIPAKMED_TO_BETHESDA[pred_class]
            conf = probs[pred_class].item()
            correct = pred_bethesda == label_dir
            mark = "OK   " if correct else "WRONG"
            print(f"  [{mark}] {img_path.name}: "
                  f"pred_cell={pred_sipakmed}({pred_bethesda}) "
                  f"true={label_dir} conf={conf:.3f}")
            results.append(correct)

    acc = sum(results) / len(results) * 100 if results else 0
    print(f"\n  Accuracy: {sum(results)}/{len(results)} ({acc:.1f}%)")
    print(f"  Note: HSIL=Dyskeratotic, LSIL=Koilocytotic in SIPaKMeD mapping")
    return results


# ── PCOS ─────────────────────────────────────────────────────────────────────
def eval_pcos():
    print("\n" + "="*60)
    print("PCOS MODULE")
    print("="*60)

    model = PCOSModel().to(device)
    try:
        threshold = model.load(str(WEIGHTS / "pcos_model.pth"))
    except Exception as e:
        print(f"  Strict load failed: {e}")
        # Try to diagnose key mismatch
        ckpt = torch.load(str(WEIGHTS / "pcos_model.pth"), map_location=device)
        sd = ckpt["model_state_dict"]
        model_keys = set(dict(model.named_parameters()).keys())
        ckpt_keys  = set(sd.keys())
        missing = model_keys - ckpt_keys
        extra   = ckpt_keys - model_keys
        print(f"  Missing keys ({len(missing)}): {list(missing)[:5]}")
        print(f"  Extra keys ({len(extra)}): {list(extra)[:5]}")
        return

    model.eval()
    results = []

    for label_dir in ["healthy", "pcos"]:
        d = DEMO_ROOT / "pcos" / label_dir
        true_class = 0 if label_dir == "healthy" else 1
        for img_path in sorted(d.glob("*.jpg")) + sorted(d.glob("*.png")):
            out = infer_image(model, img_path)
            # PCOS model has Sigmoid in fc, so output is already 0-1
            score = out.item()
            pred = 1 if score >= threshold else 0
            pred_label = "pcos" if pred == 1 else "healthy"
            correct = pred == true_class
            mark = "OK   " if correct else "WRONG"
            print(f"  [{mark}] {img_path.name}: score={score:.3f} "
                  f"pred={pred_label} true={label_dir} (threshold={threshold})")
            results.append(correct)

    acc = sum(results) / len(results) * 100 if results else 0
    print(f"\n  Accuracy: {sum(results)}/{len(results)} ({acc:.1f}%)")
    return results


# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("AuraMed Model Evaluation (Corrected Architecture)")
    print(f"Demo data: {DEMO_ROOT}")
    print(f"Weights:   {WEIGHTS}\n")

    b = eval_breast()
    c = eval_cervical()
    p = eval_pcos()

    print("\n" + "="*60)
    print("OVERALL SUMMARY")
    print("="*60)
    all_res = []
    for name, res in [("Breast", b), ("Cervical", c), ("PCOS", p)]:
        if res:
            acc = sum(res) / len(res) * 100
            print(f"  {name}: {sum(res)}/{len(res)} ({acc:.1f}%)")
            all_res.extend(res)
    if all_res:
        total_acc = sum(all_res) / len(all_res) * 100
        print(f"\n  TOTAL: {sum(all_res)}/{len(all_res)} ({total_acc:.1f}%)")
    print("="*60)

if __name__ == "__main__":
    main()