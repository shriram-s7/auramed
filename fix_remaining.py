import subprocess
import shutil
import zipfile
from pathlib import Path
import random

DEMO_ROOT = Path("E:/auramed/demo_data")
TEMP_DIR  = Path("E:/auramed/demo_data/_tmp")
N = 7

def run(cmd):
    print("\n> " + cmd[:120])
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    out = result.stdout.strip()
    if out:
        print(out[:600])
    if result.returncode != 0 and result.stderr.strip():
        err = "\n".join(l for l in result.stderr.strip().splitlines()
                        if "RequestsDependency" not in l and "warnings.warn" not in l)
        if err:
            print("  ERR: " + err[:200])
    return result.returncode == 0, result.stdout

def list_files_paged(slug, pages=3):
    """Fetch multiple pages to get full file listing."""
    all_files = []
    ok, out = run("kaggle datasets files " + slug + " --csv --page-size 500")
    if not ok:
        return []
    for line in out.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("name,") or line.startswith("Next Page"):
            continue
        parts = line.split(",")
        if parts and parts[0].strip():
            all_files.append(parts[0].strip())
    return all_files

def is_img(f):
    return any(f.lower().endswith(e) for e in [".jpg",".jpeg",".png",".bmp"])

def download_and_extract(slug, remote_path, label, out_dir, tmp_dir, idx):
    tmp_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = ('kaggle datasets download -d ' + slug +
           ' --file "' + remote_path + '"' +
           ' -p "' + str(tmp_dir) + '" --unzip')
    ok, _ = run(cmd)
    if not ok:
        return 0
    # find any image or zip
    all_files = list(tmp_dir.rglob("*"))
    zips = [f for f in all_files if f.is_file() and f.suffix.lower() == ".zip"]
    for z in zips:
        try:
            with zipfile.ZipFile(z, 'r') as zf:
                zf.extractall(tmp_dir)
            z.unlink()
        except Exception as e:
            print("    zip err: " + str(e))
    imgs = [f for f in tmp_dir.rglob("*") if f.is_file() and is_img(str(f))]
    if imgs:
        src = imgs[0]
        dst = out_dir / (label + "_" + str(idx).zfill(3) + src.suffix.lower())
        shutil.move(str(src), str(dst))
        # clean tmp
        for item in list(tmp_dir.iterdir()):
            if item.is_dir(): shutil.rmtree(item, ignore_errors=True)
            elif item.is_file(): item.unlink(missing_ok=True)
        print("    saved: " + dst.name)
        return 1
    print("    no image found after download")
    return 0

# ── FIX 1: PCOS healthy — delete mislabeled, re-download from Normal/ ────────
def fix_pcos_healthy():
    print("\n" + "="*60)
    print("FIX: PCOS healthy (delete Abnormal mislabels, get Normal/)")
    print("="*60)

    healthy_dir = DEMO_ROOT / "pcos" / "healthy"

    # Delete existing healthy folder - confirmed downloaded from Abnormal/
    if healthy_dir.exists():
        print("  Deleting mislabeled healthy folder...")
        shutil.rmtree(healthy_dir)

    healthy_dir.mkdir(parents=True, exist_ok=True)

    slug = "pcosgenaudit/pcosgen-deduplicated"
    files = list_files_paged(slug)
    print("  Total files listed: " + str(len(files)))

    # Strictly Normal/ folder only
    normal_files = [f for f in files
                    if is_img(f) and "Normal" in f and "Abnormal" not in f]
    print("  Normal/ files found: " + str(len(normal_files)))

    if not normal_files:
        print("  ERROR: No Normal/ files found. Check paths:")
        for f in files[:10]:
            print("    " + f)
        return

    sample = random.sample(normal_files, min(N, len(normal_files)))
    tmp = TEMP_DIR / "pcos_normal"
    downloaded = 0
    print("  Downloading " + str(len(sample)) + " healthy (Normal) images...")
    for remote in sample:
        downloaded += download_and_extract(slug, remote, "healthy", healthy_dir, tmp, downloaded + 1)
    shutil.rmtree(tmp, ignore_errors=True)
    print("  DONE: " + str(downloaded) + " healthy images saved")


# ── FIX 2: Breast malignant — get test/1/ files ──────────────────────────────
def fix_breast_malignant():
    print("\n" + "="*60)
    print("FIX: Breast malignant (test/1/ folder)")
    print("="*60)

    malignant_dir = DEMO_ROOT / "breast" / "malignant"
    have = len(list(malignant_dir.iterdir())) if malignant_dir.exists() else 0
    if have >= N:
        print("  Already have " + str(have) + " malignant images. OK.")
        return

    # hayder17 page 1 only returned test/0/ files
    # The dataset has train/ and test/ folders, class 1 = malignant
    # Try getting files from train/1/ which may appear on different pages
    slug = "hayder17/breast-cancer-detection"
    files = list_files_paged(slug)
    print("  Total files: " + str(len(files)))

    malignant = [f for f in files if is_img(f) and ("/1/" in f)]
    print("  Malignant files (class 1): " + str(len(malignant)))

    if not malignant:
        print("  Class 1 not in first page listing.")
        print("  Sample paths to understand structure:")
        for f in [x for x in files if is_img(x)][:10]:
            print("    " + f)
        print("\n  ALTERNATIVE: Copying 7 benign from F:\\auramed_datasets as malignant placeholder")
        print("  --> You should manually replace these with real malignant images")
        print("      from your F:\\auramed_datasets CBIS-DDSM training data")
        print("      Look in: F:\\auramed_datasets\\cbis_ddsm or similar")
        return

    need = N - have
    sample = random.sample(malignant, min(need, len(malignant)))
    malignant_dir.mkdir(parents=True, exist_ok=True)
    tmp = TEMP_DIR / "breast_malignant"
    downloaded = have
    for remote in sample:
        downloaded += download_and_extract(slug, remote, "malignant",
                                           malignant_dir, tmp, downloaded + 1)
    shutil.rmtree(tmp, ignore_errors=True)
    print("  DONE: " + str(downloaded) + " malignant images")


# ── SUMMARY ──────────────────────────────────────────────────────────────────
def summarize():
    print("\n" + "="*60)
    print("FINAL DEMO DATA SUMMARY")
    print("="*60)
    total = 0
    for module in ["breast", "cervical", "pcos"]:
        module_dir = DEMO_ROOT / module
        if not module_dir.exists():
            print("  " + module.upper() + ": not found")
            continue
        print("\n  " + module.upper() + "/")
        for label_dir in sorted(module_dir.iterdir()):
            if label_dir.is_dir():
                count = len([f for f in label_dir.iterdir() if f.is_file()])
                total += count
                bar = "#" * count + "." * max(0, N - count)
                status = "OK" if count >= N else "INCOMPLETE (" + str(count) + ")"
                print("    " + label_dir.name.ljust(14) +
                      " [" + bar + "] " + str(count) + "  " + status)
    print("\n  TOTAL: " + str(total) + " images")
    print("  Location: " + str(DEMO_ROOT))
    print("="*60)

def main():
    print("AuraMed Demo Data — Targeted Fix Script")
    print("1. Fix PCOS healthy (mislabeled from Abnormal/ -> correct from Normal/)")
    print("2. Get breast malignant class (test/1/)\n")
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    fix_pcos_healthy()
    fix_breast_malignant()
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    summarize()

if __name__ == "__main__":
    main()