import subprocess
subprocess.run("pip install torch torchvision timm pillow numpy --break-system-packages -q",
               shell=True, capture_output=True)

import torch
import torch.nn as nn
import timm
from torchvision import transforms
from PIL import Image
from pathlib import Path

DEMO_ROOT = Path("E:/auramed/demo_data")
WEIGHTS   = Path("E:/auramed/backend/app/ml/weights")
device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}\n")

tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

def infer(model, img_path):
    img = Image.open(str(img_path)).convert("RGB")
    t = tf(img).unsqueeze(0).to(device)
    with torch.no_grad():
        return model(t)

# ── BREAST ───────────────────────────────────────────────────────────────────
class BreastModel(nn.Module):
    def __init__(self):
        super().__init__()
        import torchvision.models as tvm
        base = tvm.resnet50(weights=None)
        base.fc = nn.Linear(base.fc.in_features, 1)
        self.resnet = base
    def forward(self, x):
        return self.resnet(x)

def eval_breast():
    print("="*60)
    print("BREAST")
    print("="*60)
    print("NOTE: Benign images are histopathology (BreaKHis).")
    print("      Model trained on mammograms (CBIS-DDSM).")
    print("      Modality mismatch — benign results unreliable.")
    print("      Malignant images ARE mammograms (CBIS-DDSM test set) — valid.\n")

    model = BreastModel().to(device)
    ckpt = torch.load(str(WEIGHTS/"breast_model.pth"), map_location=device)
    model.load_state_dict(ckpt["model_state_dict"], strict=True)
    model.eval()
    threshold = ckpt["optimal_threshold"]
    print(f"  Threshold: {threshold}")

    results = []
    for label_dir in ["benign", "malignant"]:
        d = DEMO_ROOT / "breast" / label_dir
        true_cls = 0 if label_dir == "benign" else 1
        imgs = sorted(d.glob("*.png")) + sorted(d.glob("*.jpg"))
        for img_path in imgs:
            score = torch.sigmoid(infer(model, img_path)).item()
            pred = 1 if score >= threshold else 0
            pred_lbl = "malignant" if pred else "benign"
            correct = pred == true_cls
            mark = "OK   " if correct else "WRONG"
            flag = " [MODALITY MISMATCH]" if label_dir == "benign" else ""
            print(f"  [{mark}] {img_path.name}: score={score:.3f} pred={pred_lbl}{flag}")
            results.append((correct, label_dir == "malignant"))

    valid = [r[0] for r in results if r[1]]  # only malignant (valid modality)
    all_r = [r[0] for r in results]
    print(f"\n  Mammogram-only accuracy (malignant): {sum(valid)}/{len(valid)} ({sum(valid)/len(valid)*100:.1f}%)")
    print(f"  Overall (incl. mismatched benign): {sum(all_r)}/{len(all_r)} ({sum(all_r)/len(all_r)*100:.1f}%)")
    return all_r

# ── CERVICAL ─────────────────────────────────────────────────────────────────
def eval_cervical():
    print("\n" + "="*60)
    print("CERVICAL")
    print("="*60)
    print("NOTE: Demo images are LBC whole-slide cytology (Mendeley).")
    print("      Model trained on SIPaKMeD SINGLE ISOLATED CELLS.")
    print("      Modality mismatch — results expected to be poor.\n")

    model = timm.create_model("vit_base_patch16_224", pretrained=False, num_classes=5)
    ckpt = torch.load(str(WEIGHTS/"cervical_model.pth"), map_location=device)
    model.load_state_dict(ckpt["model_state_dict"], strict=True)
    model = model.to(device)
    model.eval()

    # SIPaKMeD classes -> Bethesda
    CLASS_NAMES = ["Dyskeratotic", "Koilocytotic", "Metaplastic", "Parabasal", "Normal"]
    TO_BETHESDA = {0:"HSIL", 1:"LSIL", 2:"NILM", 3:"NILM", 4:"NILM"}

    results = []
    for label_dir in ["HSIL", "LSIL"]:
        d = DEMO_ROOT / "cervical" / label_dir
        if not d.exists(): continue
        imgs = sorted(d.glob("*.jpg")) + sorted(d.glob("*.png"))
        for img_path in imgs:
            out = infer(model, img_path)
            probs = torch.softmax(out, dim=1)[0]
            pred_cls = probs.argmax().item()
            pred_bethesda = TO_BETHESDA[pred_cls]
            conf = probs[pred_cls].item()
            correct = pred_bethesda == label_dir
            mark = "OK   " if correct else "WRONG"
            print(f"  [{mark}] {img_path.name}: pred={CLASS_NAMES[pred_cls]}({pred_bethesda}) "
                  f"true={label_dir} conf={conf:.3f} [MODALITY MISMATCH]")
            results.append(correct)

    acc = sum(results)/len(results)*100 if results else 0
    print(f"\n  Accuracy: {sum(results)}/{len(results)} ({acc:.1f}%) — mismatch expected")
    return results

# ── PCOS ─────────────────────────────────────────────────────────────────────
class PCOSModel(nn.Module):
    """
    fc key is 'resnet.fc.1.weight' meaning Sequential index 1.
    Index 0 must be something without learnable params (e.g. Dropout or Identity).
    Try: Sequential(Dropout, Linear) or just remap the key directly.
    """
    def __init__(self):
        super().__init__()
        import torchvision.models as tvm
        base = tvm.resnet50(weights=None)
        # Use Dropout at index 0, Linear at index 1 to match key 'resnet.fc.1.*'
        base.fc = nn.Sequential(
            nn.Dropout(p=0.5),
            nn.Linear(base.fc.in_features, 1),
        )
        self.resnet = base
    def forward(self, x):
        return self.resnet(x)

def eval_pcos():
    print("\n" + "="*60)
    print("PCOS")
    print("="*60)

    model = PCOSModel().to(device)
    ckpt = torch.load(str(WEIGHTS/"pcos_model.pth"), map_location=device)
    sd = ckpt["model_state_dict"]

    try:
        model.load_state_dict(sd, strict=True)
        print("  Strict load: OK")
    except Exception as e:
        print(f"  Strict load failed: {e}")
        print("  Trying strict=False...")
        missing, unexpected = model.load_state_dict(sd, strict=False)
        print(f"  Missing: {missing}")
        print(f"  Unexpected: {unexpected}")

    model.eval()
    threshold = ckpt.get("optimal_threshold", 0.04)
    print(f"  Threshold: {threshold}\n")

    results = []
    for label_dir in ["healthy", "pcos"]:
        d = DEMO_ROOT / "pcos" / label_dir
        true_cls = 0 if label_dir == "healthy" else 1
        imgs = sorted(d.glob("*.jpg")) + sorted(d.glob("*.png"))
        for img_path in imgs:
            out = infer(model, img_path)
            # Apply sigmoid since fc ends with Linear (no sigmoid in model)
            score = torch.sigmoid(out).item()
            pred = 1 if score >= threshold else 0
            pred_lbl = "pcos" if pred else "healthy"
            correct = pred == true_cls
            mark = "OK   " if correct else "WRONG"
            print(f"  [{mark}] {img_path.name}: score={score:.4f} pred={pred_lbl} true={label_dir}")
            results.append(correct)

    acc = sum(results)/len(results)*100 if results else 0
    print(f"\n  Accuracy: {sum(results)}/{len(results)} ({acc:.1f}%)")
    return results

# ── MAIN ─────────────────────────────────────────────────────────────────────
b = eval_breast()
c = eval_cervical()
p = eval_pcos()

print("\n" + "="*60)
print("SUMMARY + DIAGNOSIS")
print("="*60)
all_r = (b or []) + (c or []) + (p or [])
if all_r:
    print(f"  Breast:   {sum(b)}/{len(b)} ({sum(b)/len(b)*100:.1f}%)")
    if c: print(f"  Cervical: {sum(c)}/{len(c)} ({sum(c)/len(c)*100:.1f}%)")
    if p: print(f"  PCOS:     {sum(p)}/{len(p)} ({sum(p)/len(p)*100:.1f}%)")
print()
print("  ROOT CAUSE ANALYSIS:")
print("  Breast benign: BreaKHis histology vs CBIS-DDSM mammogram = wrong modality")
print("  Cervical:      Mendeley LBC slides vs SIPaKMeD single cells = wrong modality")
print("  PCOS:          Same ultrasound modality - results most reliable")
print()
print("  RECOMMENDATION:")
print("  Replace benign breast images with actual mammogram images")
print("  Replace cervical images with SIPaKMeD-style single cell images")
print("  OR use the F-drive training data directly for demo")
print("="*60)
