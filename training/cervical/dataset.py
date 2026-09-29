import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, 'D:/python_packages')

"""
Cervical Cytology Dataset Loader (SIPaKMeD, Mendeley Multi Cancer, Herlev).
Supports multi-source Pap smear cytology image datasets aligned to 5 Bethesda classes:
  0: Dyskeratotic (HSIL)
  1: Koilocytotic (LSIL)
  2: Metaplastic (ASC-US)
  3: Parabasal (ASC-H)
  4: Normal (NILM)

Handles native BMP/PNG/JPG formats, multi-source ingestion, stratified splitting,
and synthetic test data fallback.
"""
import random
from typing import Callable, List, Optional, Tuple, Union

import numpy as np
import torch
from PIL import Image
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset

CLASS_NAMES = [
    "Dyskeratotic",
    "Koilocytotic",
    "Metaplastic",
    "Parabasal",
    "Normal",
]

DIRECTORY_TO_CLASS = {
    "im_dyskeratotic": 0,
    "dyskeratotic": 0,
    "im_koilocytotic": 1,
    "koilocytotic": 1,
    "im_metaplastic": 2,
    "metaplastic": 2,
    "im_parabasal": 3,
    "parabasal": 3,
    "im_superficial-intermediate": 4,
    "im_superficial_intermediate": 4,
    "superficial-intermediate": 4,
    "normal": 4,
}


class SIPaKMeDDataset(Dataset):
    """
    PyTorch Dataset for Cervical Single-Cell Images.
    Loads BMP, PNG, or JPEG cytology scans and returns (image_tensor, long_label).
    """
    def __init__(
        self,
        image_paths: List[str],
        labels: List[int],
        transform: Optional[Callable] = None,
    ):
        self.image_paths = list(image_paths)
        self.labels = list(labels)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path = self.image_paths[idx]
        label = self.labels[idx]

        try:
            img = Image.open(img_path)
            if img.mode != "RGB":
                img = img.convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), color=(200, 180, 190))

        if self.transform:
            image = self.transform(img)
        else:
            from torchvision import transforms
            fallback_tf = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
            image = fallback_tf(img)

        return image, torch.tensor(label, dtype=torch.long)


# Backwards compatibility alias
CervicalDataset = SIPaKMeDDataset


def _generate_synthetic_sipakmed(data_dir: str) -> Tuple[List[str], List[int]]:
    """
    Generates 250 synthetic single-cell cytology images (50 per class) with realistic
    cytoplasmic and nuclear morphological features (N/C ratio, chromatin density).
    """
    synth_dir = os.path.join(data_dir, "synthetic_sipakmed")
    os.makedirs(synth_dir, exist_ok=True)

    print("\n" + "=" * 65)
    print(" [!] NOTICE: Real SIPaKMeD dataset not detected.")
    print(" Generating 250-sample SYNTHETIC TEST DATA (50/class) for cytology pipeline...")
    print("=" * 65 + "\n")

    random.seed(42)
    np.random.seed(42)

    image_paths = []
    labels = []

    # Morphological characteristics per class:
    # 0: Dyskeratotic (dark hyperchromatic nucleus, high N/C ratio)
    # 1: Koilocytotic (perinuclear halo / clearing around nucleus)
    # 2: Metaplastic (dense cytoplasm, rounded cell)
    # 3: Parabasal (small rounded cell, large central nucleus)
    # 4: Normal (large transparent cytoplasm, tiny pyknotic nucleus)
    class_specs = [
        {"name": "im_Dyskeratotic", "label": 0, "nuc_radius": 42, "halo": False, "chromatin": 35},
        {"name": "im_Koilocytotic", "label": 1, "nuc_radius": 34, "halo": True, "chromatin": 55},
        {"name": "im_Metaplastic", "label": 2, "nuc_radius": 28, "halo": False, "chromatin": 70},
        {"name": "im_Parabasal", "label": 3, "nuc_radius": 36, "halo": False, "chromatin": 60},
        {"name": "im_Superficial-Intermediate", "label": 4, "nuc_radius": 14, "halo": False, "chromatin": 40},
    ]

    for spec in class_specs:
        folder = os.path.join(synth_dir, spec["name"], "CROPPED")
        os.makedirs(folder, exist_ok=True)

        for i in range(50):
            filename = f"cell_{spec['name']}_{i:03d}.bmp"
            full_path = os.path.join(folder, filename)

            # Cytology canvas: 224x224
            canvas = np.full((224, 224, 3), fill_value=225, dtype=np.uint8)

            # Cytoplasm boundary (elliptical)
            cy, cx = 112 + random.randint(-5, 5), 112 + random.randint(-5, 5)
            y, x = np.ogrid[:224, :224]

            cyto_radius = random.randint(70, 95)
            cyto_mask = ((x - cx) ** 2 + (y - cy) ** 2) <= cyto_radius ** 2
            # Light Papanicolaou bluish-pink cytoplasm
            canvas[cyto_mask] = [random.randint(185, 210), random.randint(195, 225), random.randint(215, 240)]

            # Koilocytotic perinuclear halo
            if spec["halo"]:
                halo_radius = spec["nuc_radius"] + 16
                halo_mask = ((x - cx) ** 2 + (y - cy) ** 2) <= halo_radius ** 2
                canvas[halo_mask & cyto_mask] = [235, 235, 245]

            # Nucleus
            nuc_r = spec["nuc_radius"] + random.randint(-3, 3)
            nuc_mask = ((x - cx) ** 2 + (y - cy) ** 2) <= nuc_r ** 2
            # Dark purple-blue hematoxylin nucleus
            nuc_color = [spec["chromatin"], spec["chromatin"] + 10, spec["chromatin"] + 50]
            canvas[nuc_mask] = nuc_color

            pil_img = Image.fromarray(canvas)
            pil_img.save(full_path)

            image_paths.append(full_path)
            labels.append(spec["label"])

    print(f" Generated {len(image_paths)} synthetic cytology cell images in: {synth_dir}")
    return image_paths, labels


def prepare_cervical_dataset(
    sipakmed_dir: str = "",
    herlev_dir: str = "",
    mendeley_dir: str = "",
) -> Tuple[List[str], List[int]]:
    """
    Collects cervical cytology images across three sources:
      1. SIPaKMeD at sipakmed_dir
      2. Mendeley Multi Cancer cervical subset at mendeley_dir
      3. Herlev dataset at herlev_dir (train & test splits)
    """
    valid_extensions = {".bmp", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}

    # SOURCE 1 — SIPaKMeD
    sipakmed_paths: List[str] = []
    sipakmed_labels: List[int] = []
    if sipakmed_dir and os.path.exists(sipakmed_dir):
        for root, _, files in os.walk(sipakmed_dir):
            if "synthetic" in root.lower():
                continue
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in valid_extensions:
                    rel_parts = root.lower().replace("\\", "/").split("/")
                    matched_label = None
                    for part in rel_parts:
                        clean_part = part.strip()
                        if clean_part in DIRECTORY_TO_CLASS:
                            matched_label = DIRECTORY_TO_CLASS[clean_part]
                            break
                        for k, v in DIRECTORY_TO_CLASS.items():
                            if k in clean_part:
                                matched_label = v
                                break
                        if matched_label is not None:
                            break
                    if matched_label is not None:
                        sipakmed_paths.append(os.path.join(root, file))
                        sipakmed_labels.append(matched_label)
    print(f" SIPaKMeD: Loaded {len(sipakmed_paths)} images.")

    # SOURCE 2 — Mendeley Multi Cancer cervical subset
    mendeley_paths: List[str] = []
    mendeley_labels: List[int] = []
    mendeley_map = {
        "cervix_dyk": 0,
        "cervix_koc": 1,
        "cervix_mep": 2,
        "cervix_pab": 3,
        "cervix_sfi": 4,
    }
    if mendeley_dir and os.path.exists(mendeley_dir):
        mendeley_base = os.path.join(mendeley_dir, "Multi Cancer", "Multi Cancer", "Cervical Cancer")
        if not os.path.exists(mendeley_base):
            if any(os.path.exists(os.path.join(mendeley_dir, k)) for k in mendeley_map):
                mendeley_base = mendeley_dir

        for subfolder, class_idx in mendeley_map.items():
            sub_path = os.path.join(mendeley_base, subfolder)
            if os.path.exists(sub_path):
                for root, _, files in os.walk(sub_path):
                    for file in files:
                        ext = os.path.splitext(file)[1].lower()
                        if ext in valid_extensions:
                            mendeley_paths.append(os.path.join(root, file))
                            mendeley_labels.append(class_idx)
    print(f" Mendeley: Loaded {len(mendeley_paths)} images.")

    # SOURCE 3 — Herlev
    herlev_paths: List[str] = []
    herlev_labels: List[int] = []
    herlev_map = {
        "normal_columnar": 4,
        "normal_intermediate": 4,
        "normal_superficiel": 4,
        "light_dysplastic": 1,
        "moderate_dysplastic": 1,
        "severe_dysplastic": 0,
        "carcinoma_in_situ": 0,
    }
    if herlev_dir and os.path.exists(herlev_dir):
        herlev_base = os.path.join(herlev_dir, "Herlev Dataset")
        if not os.path.exists(herlev_base):
            if any(os.path.exists(os.path.join(herlev_dir, split)) for split in ["train", "test"]):
                herlev_base = herlev_dir

        for split in ["train", "test"]:
            split_dir = os.path.join(herlev_base, split)
            if os.path.exists(split_dir):
                for subfolder, class_idx in herlev_map.items():
                    sub_path = os.path.join(split_dir, subfolder)
                    if os.path.exists(sub_path):
                        for root, _, files in os.walk(sub_path):
                            for file in files:
                                ext = os.path.splitext(file)[1].lower()
                                if ext in valid_extensions:
                                    herlev_paths.append(os.path.join(root, file))
                                    herlev_labels.append(class_idx)
    print(f" Herlev: Loaded {len(herlev_paths)} images.")

    all_paths = sipakmed_paths + mendeley_paths + herlev_paths
    all_labels = sipakmed_labels + mendeley_labels + herlev_labels

    if len(all_paths) == 0:
        print(" WARNING: No real cervical data found across sources. Falling back to synthetic.")
        synth_target = sipakmed_dir if sipakmed_dir else "training/data/cervical/raw"
        return _generate_synthetic_sipakmed(synth_target)

    # Class distribution summary
    counts = {name: 0 for name in CLASS_NAMES}
    for l in all_labels:
        counts[CLASS_NAMES[l]] += 1

    print("\n--- Cervical Dataset Class Distribution ---")
    for name in CLASS_NAMES:
        print(f" {name:<26}: {counts[name]} images")
    print(f" {'Total':<26}: {len(all_paths)} images")
    print("-------------------------------------------\n")

    return all_paths, all_labels


def prepare_sipakmed(data_dir: str) -> Tuple[List[str], List[int]]:
    """Thin wrapper preserving backwards compatibility with existing pipeline callers."""
    return prepare_cervical_dataset(data_dir, "", "")


def split_dataset(
    image_paths: List[str],
    labels: List[int],
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
    seed: Optional[int] = None,
) -> Tuple[List[str], List[int], List[str], List[int], List[str], List[int]]:
    """
    Stratified 3-way train/validation/test split preserving multi-class proportions.
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
