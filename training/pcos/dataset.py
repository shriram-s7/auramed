import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, 'D:/python_packages')

"""
PCOS Pelvic Ultrasound Dataset Loader, Quality Assessment & Preprocessing.
Supports Kaggle PCOS ultrasound image datasets:
  - 'ultrasound-images-for-pcos-classification'
  - 'pcos-detection-using-deep-learning'
Handles standard and train/test nested directory structures transparently,
applies ultrasound quality rejection filters, and performs dynamic oversampling
for class imbalance mitigation.
"""
import logging
import random
from typing import List, Optional, Tuple

import numpy as np
import torch
from PIL import Image
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset

logger = logging.getLogger("auramed.training.pcos.dataset")

CLASS_NAMES = ["Normal", "PCOS"]


class PCOSDataset(Dataset):
    """
    PyTorch Dataset for Pelvic Ultrasound PCOS Screening.
    Loads JPG, PNG, and JPEG ultrasound images and applies quality filtering.
    """
    def __init__(
        self,
        image_paths: List[str],
        labels: List[int],
        transform=None,
    ):
        self.image_paths = image_paths
        self.labels = labels
        self.transform = transform

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path = self.image_paths[idx]
        label = self.labels[idx]

        try:
            pil_img = Image.open(img_path).convert("RGB")
        except Exception as e:
            logger.warning("Failed to open ultrasound image %s: %s. Using blank fallback.", img_path, str(e))
            pil_img = Image.new("RGB", (224, 224), color=(30, 30, 30))

        if self.transform is not None:
            image = self.transform(pil_img)
        else:
            arr = np.array(pil_img, dtype=np.float32) / 255.0
            image = torch.from_numpy(arr.transpose(2, 0, 1)).float()

        return image, torch.tensor(label, dtype=torch.long)


def is_image_valid_quality(img_path: str) -> bool:
    """
    Applies image quality checks for ultrasound scans:
      - Dimensions must be >= 64x64
      - Must not be entirely black (mean intensity < 5.0) or entirely white (> 250.0)
    """
    try:
        with Image.open(img_path) as img:
            w, h = img.size
            if w < 64 or h < 64:
                return False

            gray = img.convert("L")
            arr = np.array(gray, dtype=np.float32)
            mean_intensity = float(arr.mean())
            if mean_intensity < 5.0 or mean_intensity > 250.0:
                return False

        return True
    except Exception:
        return False


def _generate_synthetic_pcos_dataset(data_dir: str) -> Tuple[List[str], List[int]]:
    """
    Generates synthetic pelvic ultrasound dataset (100 Normal, 100 PCOS)
    when real Kaggle data is not yet downloaded.
    - Normal: Homogeneous ovarian stroma with 1-3 dominant physiological follicles.
    - PCOS: Enlarged ovarian volume with central hyperechoic stroma and
      peripheral 'string of pearls' arrangement (12-18 small subcapsular follicles).
    """
    synth_dir = os.path.join(data_dir, "synthetic_pcos")
    normal_dir = os.path.join(synth_dir, "Normal")
    pcos_dir = os.path.join(synth_dir, "PCOS")

    os.makedirs(normal_dir, exist_ok=True)
    os.makedirs(pcos_dir, exist_ok=True)

    print("\n" + "=" * 65)
    print(" [!] NOTICE: Real PCOS ultrasound dataset not detected.")
    print(" Generating 200-sample SYNTHETIC ULTRASOUND DATA (100 Normal, 100 PCOS)...")
    print("=" * 65 + "\n")

    image_paths = []
    labels = []

    # 1. Normal Ovary Ultrasound
    for i in range(100):
        filename = f"ultrasound_normal_{i:03d}.png"
        full_path = os.path.join(normal_dir, filename)

        # Grayscale ultrasound acoustic canvas
        canvas = np.random.normal(loc=45, scale=12, size=(224, 224)).clip(10, 85).astype(np.uint8)

        # Ovarian boundary (smooth oval)
        cy, cx = 112 + random.randint(-5, 5), 112 + random.randint(-5, 5)
        ry, rx = random.randint(60, 75), random.randint(70, 85)
        y, x = np.ogrid[:224, :224]
        ovary_mask = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) <= 1.0
        canvas[ovary_mask] = np.random.normal(loc=70, scale=14, size=canvas[ovary_mask].shape).clip(30, 110).astype(np.uint8)

        # 1-3 physiological follicles (dark anechoic fluid collections)
        num_follicles = random.randint(1, 3)
        for _ in range(num_follicles):
            f_cx = cx + random.randint(-rx // 2, rx // 2)
            f_cy = cy + random.randint(-ry // 2, ry // 2)
            f_r = random.randint(10, 16)
            f_mask = ((x - f_cx) ** 2 + (y - f_cy) ** 2) <= f_r ** 2
            canvas[f_mask & ovary_mask] = np.random.normal(loc=15, scale=5, size=canvas[f_mask & ovary_mask].shape).clip(5, 30).astype(np.uint8)

        pil_img = Image.fromarray(np.stack([canvas] * 3, axis=-1))
        pil_img.save(full_path)
        image_paths.append(full_path)
        labels.append(0)

    # 2. Polycystic Ovary Ultrasound (PCOS)
    for i in range(100):
        filename = f"ultrasound_pcos_{i:03d}.png"
        full_path = os.path.join(pcos_dir, filename)

        canvas = np.random.normal(loc=45, scale=12, size=(224, 224)).clip(10, 85).astype(np.uint8)

        # Enlarged ovary
        cy, cx = 112 + random.randint(-5, 5), 112 + random.randint(-5, 5)
        ry, rx = random.randint(72, 88), random.randint(82, 98)
        y, x = np.ogrid[:224, :224]
        ovary_mask = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) <= 1.0

        # Dense hyperechoic central stroma
        canvas[ovary_mask] = np.random.normal(loc=88, scale=16, size=canvas[ovary_mask].shape).clip(45, 140).astype(np.uint8)

        # 'String of pearls' sign: 12-18 small peripheral follicles (4-8px radius)
        num_follicles = random.randint(12, 18)
        angles = np.linspace(0, 2 * np.pi, num_follicles, endpoint=False) + random.uniform(0, 0.5)
        for theta in angles:
            dist = random.uniform(0.72, 0.88)
            f_cx = int(cx + rx * dist * np.cos(theta))
            f_cy = int(cy + ry * dist * np.sin(theta))
            f_r = random.randint(4, 7)
            f_mask = ((x - f_cx) ** 2 + (y - f_cy) ** 2) <= f_r ** 2
            canvas[f_mask & ovary_mask] = np.random.normal(loc=12, scale=4, size=canvas[f_mask & ovary_mask].shape).clip(5, 25).astype(np.uint8)

        pil_img = Image.fromarray(np.stack([canvas] * 3, axis=-1))
        pil_img.save(full_path)
        image_paths.append(full_path)
        labels.append(1)

    print(f"[+] Generated {len(image_paths)} synthetic PCOS ultrasound scans in: {synth_dir}")
    return image_paths, labels


def prepare_pcos_dataset(data_dir: str) -> Tuple[List[str], List[int]]:
    """
    Discovers, validates, and balances PCOS pelvic ultrasound images.
    
    Expected Directory Structures:
      1. Primary:
         data/pcos/raw/
           PCOS/
           Normal/
      2. Alternative (Kaggle nested):
         data/pcos/raw/data/
           train/
             PCOS/
             notPCOS/
           test/
             PCOS/
             notPCOS/
    
    Class Mapping:
      PCOS / polycystic / yes -> 1
      Normal / notPCOS / no / healthy -> 0
    
    Applies image quality checks (skipping < 64x64, all-black, all-white),
    evaluates class imbalance, and oversamples minority class if ratio > 3:1.
    """
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)

    valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
    image_paths: List[str] = []
    labels: List[int] = []

    # 1. Walk directory tree looking for PCOS and Normal folders
    skipped_count = 0
    for root, _, files in os.walk(data_dir):
        if "synthetic" in root.lower():
            continue

        rel_lower = root.lower().replace("\\", "/")
        current_label = None

        # Determine class from folder naming
        parts = rel_lower.split("/")
        for part in reversed(parts):
            if any(k in part for k in ["notpcos", "notinfected", "normal", "healthy", "non-pcos", "not_pcos", "without_pcos"]):
                current_label = 0
                break
            elif any(k in part for k in ["pcos", "polycystic", "infected", "with_pcos"]) and "notinfected" not in part:
                current_label = 1
                break

        if current_label is not None:
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in valid_exts:
                    full_p = os.path.join(root, f)
                    if is_image_valid_quality(full_p):
                        image_paths.append(full_p)
                        labels.append(current_label)
                    else:
                        skipped_count += 1

    if skipped_count > 0:
        print(f"[!] Quality filter: Skipped {skipped_count} corrupted/low-resolution ultrasound images (<64x64 or blank).")

    # 2. Fallback to existing synthetic data
    if len(image_paths) == 0:
        synth_dir = os.path.join(data_dir, "synthetic_pcos")
        if os.path.exists(synth_dir):
            for root, _, files in os.walk(synth_dir):
                for f in files:
                    if os.path.splitext(f)[1].lower() in valid_exts:
                        full_p = os.path.join(root, f)
                        if "pcos" in root.lower() and "normal" not in root.lower():
                            image_paths.append(full_p)
                            labels.append(1)
                        elif "normal" in root.lower():
                            image_paths.append(full_p)
                            labels.append(0)

    # 3. Generate synthetic data if still empty
    if len(image_paths) == 0:
        image_paths, labels = _generate_synthetic_pcos_dataset(data_dir)

    # 4. Class Imbalance Assessment & Oversampling
    normal_count = labels.count(0)
    pcos_count = labels.count(1)

    majority = max(normal_count, pcos_count)
    minority = min(normal_count, pcos_count)

    if minority > 0 and (majority / minority) > 3.0:
        minority_label = 0 if normal_count < pcos_count else 1
        print(f"[!] Class imbalance detected ({majority}:{minority} > 3:1). Applied oversampling.")

        minority_indices = [idx for idx, lbl in enumerate(labels) if lbl == minority_label]
        target_minority_count = int(majority / 2.0)  # balance to approximately 2:1
        num_to_add = target_minority_count - minority

        for _ in range(num_to_add):
            chosen_idx = random.choice(minority_indices)
            image_paths.append(image_paths[chosen_idx])
            labels.append(minority_label)

    # 5. Summary Print
    normal_final = labels.count(0)
    pcos_final = labels.count(1)
    total_final = len(labels)

    print("\n--- PCOS Ultrasound Dataset Distribution ---")
    print(f" Normal: {normal_final} images")
    print(f" PCOS  : {pcos_final} images")
    print(f" Total : {total_final} images")
    print("--------------------------------------------\n")

    return image_paths, labels


def split_dataset(
    image_paths: List[str],
    labels: List[int],
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
    seed: Optional[int] = None,
) -> Tuple[List[str], List[int], List[str], List[int], List[str], List[int]]:
    """
    Stratified 3-way split (70% train / 15% val / 15% test).
    """
    if seed is not None:
        random_state = seed

    total = len(image_paths)
    if total < 15:
        return image_paths, labels, image_paths, labels, image_paths, labels

    train_val_paths, test_paths, train_val_labels, test_labels = train_test_split(
        image_paths,
        labels,
        test_size=test_size,
        stratify=labels,
        random_state=random_state,
    )

    effective_val_size = val_size / (1.0 - test_size)
    train_paths, val_paths, train_labels, val_labels = train_test_split(
        train_val_paths,
        train_val_labels,
        test_size=effective_val_size,
        stratify=train_val_labels,
        random_state=random_state,
    )

    print("--- Stratified Split Summary ---")
    print(f" Train: {len(train_paths)} samples")
    print(f" Val:   {len(val_paths)} samples")
    print(f" Test:  {len(test_paths)} samples")
    print("--------------------------------\n")

    return train_paths, train_labels, val_paths, val_labels, test_paths, test_labels
