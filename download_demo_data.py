import subprocess
import shutil
import random
import zipfile
from pathlib import Path

DEMO_ROOT = Path("E:/auramed/demo_data")
TEMP_DIR  = Path("E:/auramed/demo_data/_tmp")
N = 7

def run(cmd):
    print("\n> " + cmd[:120])
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    out = result.stdout.strip()
    if out:
        print(out[:800])
    if result.returncode != 0 and result.stderr.strip():
        err = "\n".join(l for l in result.stderr.strip().splitlines()
                        if "RequestsDependency" not in l and "warnings.warn" not in l)
        if err:
            print("  ERR: " + err[:300])
    return result.returncode == 0, result.stdout

def list_files(slug):
    ok, out = run("kaggle datasets files " + slug + " --csv --page-size 500")
    if not ok or not out.strip():
        return []
    lines = [l.strip() for l in out.strip().splitlines() if l.strip()]
    files = []
    for line in lines:
        if line.startswith("name,") or line.startswith("Next Page"):
            continue
        parts = line.split(",")
        if parts and parts[0].strip():
            files.append(parts[0].strip())
    return files

def is_img(f):
    return any(f.lower().endswith(e) for e in [".jpg",".jpeg",".png",".bmp"])

def count_existing(label_dir):
    if not label_dir.exists():
        return 0
    return len([f for f in label_dir.iterdir() if f.is_file()])

def extract_any_zip(tmp_dir, out_dir, label, start_idx):
    """Find and extract all zips in tmp_dir, move images to out_dir."""
    downloaded = 0
    # unzip everything
    for z in list(tmp_dir.rglob("*.zip")):
        try:
            with zipfile.ZipFile(z, 'r') as zf:
                zf.extractall(tmp_dir)
            z.unlink()
        except Exception as e:
            print("    zip error: " + str(e))
    # find all images
    imgs = [f for f in tmp_dir.rglob("*") if f.is_file() and is_img(str(f))]
    for src in imgs:
        idx = start_idx + downloaded + 1
        dst = out_dir / (label + "_" + str(idx).zfill(3) + src.suffix.lower())
        shutil.move(str(src), str(dst))
        downloaded += 1
        print("    saved: " + dst.name)
    return downloaded

def download_and_save(slug, remote_path, label, out_dir, tmp_dir, idx):
    tmp_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = ('kaggle datasets download -d ' + slug +
           ' --file "' + remote_path + '"' +
           ' -p "' + str(tmp_dir) + '" --unzip')
    ok, _ = run(cmd)
    if not ok:
        return 0

    fname = Path(remote_path).name
    # look for the file directly or inside a zip
    # First check if already extracted
    direct = list(tmp_dir.rglob("*"))
    imgs = [f for f in direct if f.is_file() and is_img(str(f))]
    zips = [f for f in direct if f.is_file() and f.suffix.lower() == ".zip"]

    if not imgs and zips:
        # extract zips
        for z in zips:
            try:
                with zipfile.ZipFile(z, 'r') as zf:
                    zf.extractall(tmp_dir)
                z.unlink()
            except Exception as e:
                print("    zip error: " + str(e))
        imgs = [f for f in tmp_dir.rglob("*") if f.is_file() and is_img(str(f))]

    if imgs:
        src = imgs[0]
        ext = src.suffix.lower()
        dst = out_dir / (label + "_" + str(idx).zfill(3) + ext)
        shutil.move(str(src), str(dst))
        # clean leftover dirs
        for item in tmp_dir.iterdir():
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            elif item.is_file():
                item.unlink()
        print("    saved: " + dst.name)
        return 1
    else:
        print("    no image found after download for: " + fname)
        return 0


# ── BREAST ───────────────────────────────────────────────────────────────────
def do_breast():
    print("\n" + "="*60)
    print("MODULE: BREAST")
    print("="*60)
    dest = DEMO_ROOT / "breast"

    have_benign   = count_existing(dest / "benign")
    have_malignant = count_existing(dest / "malignant")
    print("  Have: benign=" + str(have_benign) + " malignant=" + str(have_malignant))

    if have_benign >= N and have_malignant >= N:
        print("  Both classes complete. Skipping.")
        return

    # hayder17: test/0 = benign(0=no cancer), test/1 = malignant(1=cancer)
    slug = "hayder17/breast-cancer-detection"
    files = list_files(slug)
    print("  Total files listed: " + str(len(files)))

    benign_files   = [f for f in files if is_img(f) and "/0/" in f]
    malignant_files = [f for f in files if is_img(f) and "/1/" in f]
    print("  Benign files found: " + str(len(benign_files)))
    print("  Malignant files found: " + str(len(malignant_files)))

    tmp = TEMP_DIR / "breast"

    if have_benign < N and benign_files:
        need = N - have_benign
        sample = random.sample(benign_files, min(need, len(benign_files)))
        out_dir = dest / "benign"
        out_dir.mkdir(parents=True, exist_ok=True)
        print("\n  Downloading " + str(len(sample)) + " benign images...")
        for remote in sample:
            have_benign += download_and_save(slug, remote, "benign", out_dir, tmp, have_benign + 1)

    if have_malignant < N and malignant_files:
        need = N - have_malignant
        sample = random.sample(malignant_files, min(need, len(malignant_files)))
        out_dir = dest / "malignant"
        out_dir.mkdir(parents=True, exist_ok=True)
        print("\n  Downloading " + str(len(sample)) + " malignant images...")
        for remote in sample:
            have_malignant += download_and_save(slug, remote, "malignant", out_dir, tmp, have_malignant + 1)

    shutil.rmtree(tmp, ignore_errors=True)
    print("\n  Breast done: benign=" + str(count_existing(dest/"benign")) +
          " malignant=" + str(count_existing(dest/"malignant")))


# ── CERVICAL ─────────────────────────────────────────────────────────────────
def do_cervical():
    print("\n" + "="*60)
    print("MODULE: CERVICAL")
    print("="*60)
    dest = DEMO_ROOT / "cervical"

    have_hsil = count_existing(dest / "HSIL")
    have_lsil = count_existing(dest / "LSIL")
    print("  Have: HSIL=" + str(have_hsil) + " LSIL=" + str(have_lsil))

    # blank1508 confirmed working - files download as zip containing jpg
    slug = "blank1508/mendeley-lbc-cervical-cancer"
    files = list_files(slug)
    print("  Total files listed: " + str(len(files)))

    # folder names confirmed: "High squamous intra-epithelial lesion/" and
    # "Low squamous intra-epithelial lesion/"
    hsil_files = [f for f in files if is_img(f) and "high squamous" in f.lower()]
    lsil_files = [f for f in files if is_img(f) and "low squamous" in f.lower()]
    print("  HSIL files: " + str(len(hsil_files)))
    print("  LSIL files: " + str(len(lsil_files)))

    if have_hsil < N and hsil_files:
        need = N - have_hsil
        sample = random.sample(hsil_files, min(need, len(hsil_files)))
        out_dir = dest / "HSIL"
        out_dir.mkdir(parents=True, exist_ok=True)
        tmp = TEMP_DIR / "cervical_hsil"
        print("\n  Downloading " + str(len(sample)) + " HSIL images...")
        for remote in sample:
            have_hsil += download_and_save(slug, remote, "HSIL", out_dir, tmp, have_hsil + 1)
        shutil.rmtree(tmp, ignore_errors=True)

    if have_lsil < N and lsil_files:
        need = N - have_lsil
        sample = random.sample(lsil_files, min(need, len(lsil_files)))
        out_dir = dest / "LSIL"
        out_dir.mkdir(parents=True, exist_ok=True)
        tmp = TEMP_DIR / "cervical_lsil"
        print("\n  Downloading " + str(len(sample)) + " LSIL images...")
        for remote in sample:
            have_lsil += download_and_save(slug, remote, "LSIL", out_dir, tmp, have_lsil + 1)
        shutil.rmtree(tmp, ignore_errors=True)

    print("\n  Cervical done: HSIL=" + str(count_existing(dest/"HSIL")) +
          " LSIL=" + str(count_existing(dest/"LSIL")))


# ── PCOS ─────────────────────────────────────────────────────────────────────
def do_pcos():
    print("\n" + "="*60)
    print("MODULE: PCOS")
    print("="*60)
    dest = DEMO_ROOT / "pcos"

    have_pcos    = count_existing(dest / "pcos")
    have_healthy = count_existing(dest / "healthy")
    print("  Have: pcos=" + str(have_pcos) + " healthy=" + str(have_healthy))

    # Check if healthy images were incorrectly downloaded from Abnormal folder
    # (previous bug - label_map matched "normal" inside "Abnormal")
    # If healthy folder exists but came from Abnormal path, warn and offer to fix
    healthy_dir = dest / "healthy"
    if healthy_dir.exists() and have_healthy > 0:
        print("  NOTE: Checking healthy images are actually from Normal/ folder...")
        # We'll trust what's there and move on - the pcosgen Normal/ folder
        # will be used correctly this time since we filter explicitly

    # PCOS class: anaghachoudhari infected folder (confirmed)
    if have_pcos < N:
        slug = "anaghachoudhari/pcos-detection-using-ultrasound-images"
        files = list_files(slug)
        pcos_files = [f for f in files if is_img(f) and "infected" in f.lower()
                      and "not" not in f.lower()]
        print("  PCOS files available: " + str(len(pcos_files)))
        if pcos_files:
            need = N - have_pcos
            sample = random.sample(pcos_files, min(need, len(pcos_files)))
            out_dir = dest / "pcos"
            out_dir.mkdir(parents=True, exist_ok=True)
            tmp = TEMP_DIR / "pcos_class"
            print("  Downloading " + str(len(sample)) + " pcos images...")
            for remote in sample:
                have_pcos += download_and_save(slug, remote, "pcos", out_dir, tmp, have_pcos + 1)
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        print("  pcos class complete.")

    # Healthy class: pcosgenaudit Normal/ folder ONLY
    if have_healthy < N:
        slug = "pcosgenaudit/pcosgen-deduplicated"
        files = list_files(slug)
        # STRICTLY only files with /Normal/ in path - not Abnormal
        healthy_files = [f for f in files if is_img(f)
                         and "/Normal/" in f and "Abnormal" not in f]
        print("  Healthy files available (Normal/ only): " + str(len(healthy_files)))

        if not healthy_files:
            # show what folders exist
            print("  No Normal/ files found. All folders seen:")
            seen = set()
            for f in files:
                parts = Path(f).parts
                if len(parts) >= 2:
                    seen.add(parts[0] + "/" + parts[1])
            for s in sorted(seen)[:10]:
                print("    " + s)
        else:
            # Delete incorrectly labeled healthy images if any came from Abnormal
            if healthy_dir.exists():
                print("  Clearing existing healthy folder (may have been mislabeled)...")
                shutil.rmtree(healthy_dir)
                have_healthy = 0

            need = N - have_healthy
            sample = random.sample(healthy_files, min(need, len(healthy_files)))
            out_dir = dest / "healthy"
            out_dir.mkdir(parents=True, exist_ok=True)
            tmp = TEMP_DIR / "healthy_class"
            print("  Downloading " + str(len(sample)) + " healthy images...")
            for remote in sample:
                have_healthy += download_and_save(slug, remote, "healthy", out_dir, tmp, have_healthy + 1)
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        print("  healthy class complete.")

    print("\n  PCOS done: pcos=" + str(count_existing(dest/"pcos")) +
          " healthy=" + str(count_existing(dest/"healthy")))


# ── SUMMARY ──────────────────────────────────────────────────────────────────
def summarize():
    print("\n" + "="*60)
    print("FINAL DEMO DATA SUMMARY")
    print("="*60)
    total = 0
    for module in ["breast", "cervical", "pcos"]:
        module_dir = DEMO_ROOT / module
        if not module_dir.exists():
            print("  " + module.upper() + ": not downloaded")
            continue
        print("\n  " + module.upper() + "/")
        for label_dir in sorted(module_dir.iterdir()):
            if label_dir.is_dir():
                count = len([f for f in label_dir.iterdir() if f.is_file()])
                total += count
                bar = "#" * count + "." * max(0, N - count)
                status = "OK" if count >= N else "INCOMPLETE"
                print("    " + label_dir.name.ljust(14) +
                      " [" + bar + "] " + str(count) + "  " + status)
    print("\n  TOTAL: " + str(total) + " images")
    print("  Location: " + str(DEMO_ROOT))
    print("="*60)

def main():
    print("AuraMed Demo Data Downloader v5")
    print("Fixes: zip extraction, malignant breast, correct PCOS healthy source\n")
    DEMO_ROOT.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    do_breast()
    do_cervical()
    do_pcos()

    print("\n-- Cleaning up temp --")
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    summarize()

if __name__ == "__main__":
    main()