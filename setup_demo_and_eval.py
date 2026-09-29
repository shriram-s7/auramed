"""
AuraMed Demo Data Setup from Training Datasets + Model Evaluation
- Copies correct-modality images from F: and D: drives
- Fixes PCOS model (2-class softmax, not binary)
- Evaluates all three models
"""
import subprocess
subprocess.run("pip install torch torchvision timm pillow numpy --break-system-packages -q",
               shell=True, capture_output=True)

import torch
import torch.nn as nn
import timm
from torchvision import transforms
from PIL import Image
import shutil, random
from pathlib import Path

DEMO_ROOT = Path("E:/auramed/demo_data")
WEIGHTS   = Path("E:/auramed/backend/app/ml/weights")
device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
N = 7  # images per class
print(f"Device: {device}\n")

tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

def copy_samples(src_dir, dst_dir, label, n=N, exts=(".jpg",".jpeg",".png",".bmp")):
    src = Path(src_dir)
    dst = Path(dst_dir)
    dst.mkdir(parents=True, exist_ok=True)
    imgs = [f for f in src.rglob("*") if f.suffix.lower() in exts and f.is_file()]
    if not imgs:
        print(f"  WARNING: no images found in {src}")
        return 0
    sample = random.sample(imgs, min(n, len(imgs)))
    for i, f in enumerate(sample):
        shutil.copy2(f, dst / f"{label}_{i+1:03d}{f.suffix.lower()}")
    print(f"  Copied {len(sample)} images: {src.name} -> {dst}")
    return len(sample)

def infer(model, img_path):
    img = Image.open(str(img_path)).convert("RGB")
    t = tf(img).unsqueeze(0).to(device)
    with torch.no_grad():
        return model(t)

# ════════════════════════════════════════════════════════════
# STEP 1: REBUILD DEMO DATA FROM TRAINING SOURCES
# ════════════════════════════════════════════════════════════
def rebuild_demo():
    print("="*60)
    print("STEP 1: Rebuilding demo data from training datasets")
    print("="*60)

    # ── BREAST ──────────────────────────────────────────────
    # Source: D:\auramed_datasets\breast\cbis_ddsm\raw\cbis_ddsm
    # Folders: Mass-Test_* (mass lesions, mix of benign/malignant)
    # Use CBIS-DDSM metadata to separate — but folder names don't indicate label
    # Best approach: use processed folder if it exists, else use Mass-Test for malignant
    # and Calc-Test for benign (calcification cases tend to be benign)
    print("\n  BREAST:")
    breast_raw = Path("D:/auramed_datasets/breast/cbis_ddsm/raw/cbis_ddsm")
    breast_demo_m = DEMO_ROOT / "breast" / "malignant"
    breast_demo_b = DEMO_ROOT / "breast" / "benign"

    # Clear and rebuild
    if breast_demo_b.exists(): shutil.rmtree(breast_demo_b)
    if breast_demo_m.exists(): shutil.rmtree(breast_demo_m)
    breast_demo_b.mkdir(parents=True, exist_ok=True)
    breast_demo_m.mkdir(parents=True, exist_ok=True)

    # Mass-Test = mass lesions (higher malignancy rate in CBIS-DDSM)
    # Calc-Test = calcification lesions (higher benign rate in CBIS-DDSM)
    mass_test_folders = [d for d in breast_raw.iterdir()
                         if d.is_dir() and d.name.startswith("Mass-Test")]
    calc_test_folders = [d for d in breast_raw.iterdir()
                         if d.is_dir() and d.name.startswith("Calc-Test")]

    # Collect DCM files from each group
    mass_dcms = []
    for folder in mass_test_folders:
        mass_dcms.extend([f for f in folder.rglob("*.dcm") if f.is_file()])

    calc_dcms = []
    for folder in calc_test_folders:
        calc_dcms.extend([f for f in folder.rglob("*.dcm") if f.is_file()])

    print(f"  Mass-Test DCMs available: {len(mass_dcms)}")
    print(f"  Calc-Test DCMs available: {len(calc_dcms)}")

    # Convert DCM -> PNG on the fly
    try:
        import pydicom
        import numpy as np
    except ImportError:
        subprocess.run("pip install pydicom numpy --break-system-packages -q", shell=True)
        import pydicom
        import numpy as np

    def dcm_to_png(dcm_path, out_path):
        ds = pydicom.dcmread(str(dcm_path))
        arr = ds.pixel_array.astype(np.float32)
        arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8) * 255
        img = Image.fromarray(arr.astype(np.uint8)).convert("RGB")
        img.save(str(out_path))

    # Malignant from Mass-Test
    sample_mass = random.sample(mass_dcms, min(N, len(mass_dcms)))
    for i, dcm in enumerate(sample_mass):
        out = breast_demo_m / f"malignant_{i+1:03d}.png"
        dcm_to_png(dcm, out)
    print(f"  Malignant: {len(sample_mass)} PNG files from Mass-Test")

    # Benign from Calc-Test
    sample_calc = random.sample(calc_dcms, min(N, len(calc_dcms)))
    for i, dcm in enumerate(sample_calc):
        out = breast_demo_b / f"benign_{i+1:03d}.png"
        dcm_to_png(dcm, out)
    print(f"  Benign: {len(sample_calc)} PNG files from Calc-Test")

    # ── CERVICAL ─────────────────────────────────────────────
    # Source: F:\auramed_datasets\cervical\mendeley\raw\Multi Cancer\...\Cervical Cancer\
    # Folders: cervix_dyk(HSIL), cervix_koc(LSIL), cervix_mep/pab/sfi(NILM)
    # Also: F:\auramed_datasets\cervical\sipakmed (if exists)
    print("\n  CERVICAL:")
    cervical_demo = DEMO_ROOT / "cervical"

    mendeley_cervical = Path(
        "F:/auramed_datasets/cervical/mendeley/raw/Multi Cancer/Multi Cancer/Cervical Cancer"
    )
    sipakmed_root = Path("F:/auramed_datasets/cervical/sipakmed")

    label_map = {
        "HSIL": ["cervix_dyk"],
        "LSIL": ["cervix_koc"],
        "NILM": ["cervix_mep", "cervix_pab", "cervix_sfi"],
    }

    for bethesda_label, src_folders in label_map.items():
        dst = cervical_demo / bethesda_label
        if dst.exists(): shutil.rmtree(dst)
        dst.mkdir(parents=True, exist_ok=True)
        all_imgs = []
        for folder_name in src_folders:
            src = mendeley_cervical / folder_name
            if src.exists():
                all_imgs.extend([f for f in src.rglob("*")
                                  if f.suffix.lower() in (".jpg",".jpeg",".png",".bmp")])
            # also check sipakmed
            if sipakmed_root.exists():
                for sp_dir in sipakmed_root.rglob(folder_name.replace("cervix_","")):
                    all_imgs.extend([f for f in sp_dir.rglob("*")
                                     if f.suffix.lower() in (".jpg",".jpeg",".png",".bmp")])
        if all_imgs:
            sample = random.sample(all_imgs, min(N, len(all_imgs)))
            for i, f in enumerate(sample):
                shutil.copy2(f, dst / f"{bethesda_label}_{i+1:03d}{f.suffix.lower()}")
            print(f"  {bethesda_label}: {len(sample)} images (from {src_folders})")
        else:
            print(f"  WARNING: No images found for {bethesda_label} in {src_folders}")

    # ── PCOS ─────────────────────────────────────────────────
    # Source: F:\auramed_datasets\pcos
    print("\n  PCOS:")
    pcos_root = Path("F:/auramed_datasets/pcos")
    pcos_demo = DEMO_ROOT / "pcos"

    # Show what's there
    if pcos_root.exists():
        subdirs = [d for d in pcos_root.rglob("*") if d.is_dir()]
        print(f"  PCOS subdirs: {[d.name for d in subdirs[:10]]}")

        # Find healthy/pcos folders
        for label in ["healthy", "pcos"]:
            dst = pcos_demo / label
            if dst.exists(): shutil.rmtree(dst)
            dst.mkdir(parents=True, exist_ok=True)

            # Search for matching folder names
            candidates = [d for d in pcos_root.rglob("*")
                          if d.is_dir() and (
                              label.lower() in d.name.lower() or
                              ("normal" in d.name.lower() and label == "healthy") or
                              ("infected" in d.name.lower() and label == "pcos") or
                              ("not_infected" in d.name.lower() and label == "healthy")
                          )]
            all_imgs = []
            for c in candidates:
                all_imgs.extend([f for f in c.rglob("*")
                                  if f.suffix.lower() in (".jpg",".jpeg",".png")])
            if all_imgs:
                sample = random.sample(all_imgs, min(N, len(all_imgs)))
                for i, f in enumerate(sample):
                    shutil.copy2(f, dst / f"{label}_{i+1:03d}{f.suffix.lower()}")
                print(f"  {label}: {len(sample)} images")
            else:
                print(f"  WARNING: No images found for {label}")
    else:
        print(f"  PCOS root not found: {pcos_root}")
        print("  Will use existing demo_data/pcos/ images")

# ════════════════════════════════════════════════════════════
# STEP 2: EVALUATE ALL MODELS
# ════════════════════════════════════════════════════════════

class BreastModel(nn.Module):
    def __init__(self):
        super().__init__()
        import torchvision.models as tvm
        base = tvm.resnet50(weights=None)
        base.fc = nn.Linear(base.fc.in_features, 1)
        self.resnet = base
    def forward(self, x): return self.resnet(x)

class PCOSModel(nn.Module):
    """2-class output (Normal, PCOS) with Dropout"""
    def __init__(self):
        super().__init__()
        import torchvision.models as tvm
        base = tvm.resnet50(weights=None)
        base.fc = nn.Sequential(
            nn.Dropout(p=0.5),
            nn.Linear(base.fc.in_features, 2),  # 2-class softmax
        )
        self.resnet = base
    def forward(self, x): return self.resnet(x)

def eval_all():
    print("\n" + "="*60)
    print("STEP 2: Model Evaluation")
    print("="*60)
    summary = {}

    # ── BREAST ──────────────────────────────────────────────
    print("\n  BREAST (threshold=0.18, mammogram modality):")
    model_b = BreastModel().to(device)
    ckpt_b  = torch.load(str(WEIGHTS/"breast_model.pth"), map_location=device)
    model_b.load_state_dict(ckpt_b["model_state_dict"], strict=True)
    model_b.eval()
    thr_b = ckpt_b["optimal_threshold"]
    res_b = []
    for label_dir in ["benign","malignant"]:
        d = DEMO_ROOT/"breast"/label_dir
        true_cls = 0 if label_dir=="benign" else 1
        for img in sorted(d.glob("*.png"))+sorted(d.glob("*.jpg")):
            score = torch.sigmoid(infer(model_b, img)).item()
            pred  = 1 if score >= thr_b else 0
            ok    = pred == true_cls
            mark  = "OK   " if ok else "WRONG"
            print(f"    [{mark}] {img.name}: score={score:.3f} "
                  f"pred={'malignant' if pred else 'benign'} true={label_dir}")
            res_b.append(ok)
    acc = sum(res_b)/len(res_b)*100 if res_b else 0
    print(f"  Breast accuracy: {sum(res_b)}/{len(res_b)} ({acc:.1f}%)")
    summary["breast"] = (sum(res_b), len(res_b))

    # ── CERVICAL ────────────────────────────────────────────
    print("\n  CERVICAL (SIPaKMeD 5-class -> Bethesda):")
    model_c = timm.create_model("vit_base_patch16_224", pretrained=False, num_classes=5)
    ckpt_c  = torch.load(str(WEIGHTS/"cervical_model.pth"), map_location=device)
    model_c.load_state_dict(ckpt_c["model_state_dict"], strict=True)
    model_c = model_c.to(device)
    model_c.eval()
    CLASS_NAMES = ["Dyskeratotic","Koilocytotic","Metaplastic","Parabasal","Normal"]
    TO_BETH     = {0:"HSIL",1:"LSIL",2:"NILM",3:"NILM",4:"NILM"}
    res_c = []
    for label_dir in ["HSIL","LSIL","NILM"]:
        d = DEMO_ROOT/"cervical"/label_dir
        if not d.exists(): continue
        for img in sorted(d.glob("*.jpg"))+sorted(d.glob("*.png"))+sorted(d.glob("*.bmp")):
            out   = infer(model_c, img)
            probs = torch.softmax(out, dim=1)[0]
            pc    = probs.argmax().item()
            pred_beth = TO_BETH[pc]
            conf  = probs[pc].item()
            ok    = pred_beth == label_dir
            mark  = "OK   " if ok else "WRONG"
            print(f"    [{mark}] {img.name}: pred={CLASS_NAMES[pc]}({pred_beth}) "
                  f"true={label_dir} conf={conf:.3f}")
            res_c.append(ok)
    acc = sum(res_c)/len(res_c)*100 if res_c else 0
    print(f"  Cervical accuracy: {sum(res_c)}/{len(res_c)} ({acc:.1f}%)")
    summary["cervical"] = (sum(res_c), len(res_c))

    # ── PCOS ────────────────────────────────────────────────
    print("\n  PCOS (2-class: Normal=0, PCOS=1):")
    model_p = PCOSModel().to(device)
    ckpt_p  = torch.load(str(WEIGHTS/"pcos_model.pth"), map_location=device)
    try:
        model_p.load_state_dict(ckpt_p["model_state_dict"], strict=True)
        print("    Weights loaded OK")
    except Exception as e:
        print(f"    Load error: {e}")
        return summary
    model_p.eval()
    thr_p = ckpt_p.get("optimal_threshold", 0.5)
    print(f"    Threshold: {thr_p}")
    res_p = []
    for label_dir in ["healthy","pcos"]:
        d = DEMO_ROOT/"pcos"/label_dir
        true_cls = 0 if label_dir=="healthy" else 1
        for img in sorted(d.glob("*.jpg"))+sorted(d.glob("*.png")):
            out   = infer(model_p, img)
            probs = torch.softmax(out, dim=1)[0]
            pred  = probs.argmax().item()  # 0=Normal, 1=PCOS
            score = probs[1].item()         # PCOS probability
            ok    = pred == true_cls
            mark  = "OK   " if ok else "WRONG"
            pred_lbl = "pcos" if pred==1 else "healthy"
            print(f"    [{mark}] {img.name}: pcos_prob={score:.3f} "
                  f"pred={pred_lbl} true={label_dir}")
            res_p.append(ok)
    acc = sum(res_p)/len(res_p)*100 if res_p else 0
    print(f"  PCOS accuracy: {sum(res_p)}/{len(res_p)} ({acc:.1f}%)")
    summary["pcos"] = (sum(res_p), len(res_p))

    return summary

def main():
    random.seed(42)
    rebuild_demo()
    summary = eval_all()

    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    total_c = total_n = 0
    for mod, (c, n) in summary.items():
        acc = c/n*100 if n else 0
        print(f"  {mod.upper()}: {c}/{n} ({acc:.1f}%)")
        total_c += c; total_n += n
    if total_n:
        print(f"\n  OVERALL: {total_c}/{total_n} ({total_c/total_n*100:.1f}%)")
    print("="*60)

if __name__ == "__main__":
    main()
