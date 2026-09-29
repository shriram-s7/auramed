import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, 'D:/python_packages')

"""
CBIS-DDSM & INbreast Breast Cancer Mammography Dataset Loader.
Supports Curated Breast Imaging Subset of DDSM (CBIS-DDSM) with DICOM (.dcm),
INbreast digital mammography dataset, automatic pathology mapping,
stratified splitting, and synthetic test data fallback generation.
"""
import csv
import random
from typing import Callable, List, Optional, Tuple, Union

import numpy as np
import torch
from PIL import Image
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset


class CBISDDSMDataset(Dataset):
    """
    PyTorch Dataset for CBIS-DDSM Mammography Screening.
    Loads standard raster images (PNG, JPEG) or raw DICOM files,
    applies preprocessing transformations, and returns normalized tensors.
    """
    def __init__(
        self,
        image_paths: List[str],
        labels: List[Union[int, float]],
        transform: Optional[Callable] = None,
    ):
        self.image_paths = list(image_paths)
        self.labels = list(labels)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        image_path = self.image_paths[idx]
        label = self.labels[idx]

        # 1. Load Image (handling DICOM vs Standard Formats)
        ext = os.path.splitext(image_path)[1].lower()
        if ext in [".dcm", ".dicom"]:
            try:
                import pydicom
                dcm = pydicom.dcmread(image_path)
                pixel_array = dcm.pixel_array.astype(float)
                # Rescale intercept & slope if present
                slope = getattr(dcm, "RescaleSlope", 1.0)
                intercept = getattr(dcm, "RescaleIntercept", 0.0)
                pixel_array = pixel_array * slope + intercept
                # Normalize to 0-255 uint8
                p_min, p_max = pixel_array.min(), pixel_array.max()
                if p_max > p_min:
                    norm_array = (pixel_array - p_min) / (p_max - p_min) * 255.0
                else:
                    norm_array = np.zeros_like(pixel_array)
                img = Image.fromarray(norm_array.astype(np.uint8))
            except ImportError:
                # If pydicom not installed, create placeholder image
                img = Image.new("RGB", (224, 224), color=128)
            except Exception as e:
                # Fallback on corrupted DICOM
                img = Image.new("RGB", (224, 224), color=128)
        else:
            try:
                img = Image.open(image_path)
            except Exception:
                img = Image.new("RGB", (224, 224), color=128)

        # Convert to RGB
        if img.mode != "RGB":
            img = img.convert("RGB")

        # 2. Apply Transformations
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

        return image, torch.tensor(label, dtype=torch.float32)


def _generate_synthetic_cbis_ddsm(data_dir: str) -> Tuple[List[str], List[int]]:
    """
    Generates a 200-sample synthetic dataset with realistic noisy mammography textures
    and pathology labels when real CBIS-DDSM data is not present.
    """
    synth_dir = os.path.join(data_dir, "synthetic_cbis_ddsm")
    os.makedirs(synth_dir, exist_ok=True)
    images_dir = os.path.join(synth_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    csv_path = os.path.join(synth_dir, "synthetic_labels.csv")

    image_paths = []
    labels = []

    print("\n" + "=" * 65)
    print(" [!] NOTICE: Real CBIS-DDSM dataset not detected.")
    print(" Generating 200-sample SYNTHETIC TEST DATA for end-to-end pipeline...")
    print("=" * 65 + "\n")

    random.seed(42)
    np.random.seed(42)

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["image_path", "pathology", "label"])

        for i in range(200):
            # 35% malignant prevalence (typical clinical screening enrichments)
            is_malignant = 1 if (i % 3 == 0) else 0
            pathology_name = "MALIGNANT" if is_malignant == 1 else "BENIGN"

            filename = f"synth_mammo_{i:04d}_{pathology_name.lower()}.png"
            full_path = os.path.join(images_dir, filename)

            # Generate textured mammographic synthetic pattern
            base = np.random.normal(loc=60, scale=25, size=(256, 256)).clip(0, 255).astype(np.uint8)
            # Add synthetic mass / lesion if malignant
            if is_malignant == 1:
                cx, cy = random.randint(80, 176), random.randint(80, 176)
                r = random.randint(15, 30)
                y, x = np.ogrid[:256, :256]
                mask = ((x - cx) ** 2 + (y - cy) ** 2) <= r ** 2
                base[mask] = np.clip(base[mask] + 120, 0, 255)

            pil_img = Image.fromarray(base).convert("RGB")
            pil_img.save(full_path)

            writer.writerow([full_path, pathology_name, is_malignant])
            image_paths.append(full_path)
            labels.append(is_malignant)

    print(f" Generated {len(image_paths)} synthetic images in: {synth_dir}")
    return image_paths, labels


def prepare_cbis_ddsm(data_dir: str) -> Tuple[List[str], List[int]]:
    pathology_map = {
        "malignant": 1,
        "benign": 0,
        "benign_without_callback": 0,
    }
    csv_dir = os.path.dirname(data_dir.rstrip("/\\"))  # parent of cbis_ddsm/
    # Actually: CSVs are in the raw\ folder, images are in raw\cbis_ddsm\
    # data_dir will be passed as CBIS_DDSM_DIR = D:/auramed_datasets/breast/cbis_ddsm/raw
    # CSVs sit directly in data_dir
    # Image paths in CSV are like: CBIS-DDSM/Mass-Training.../000000.dcm
    # Resolve against data_dir\cbis_ddsm\

    csv_files = [
        os.path.join(data_dir, "mass_case_description_train_set.csv"),
        os.path.join(data_dir, "mass_case_description_test_set.csv"),
        os.path.join(data_dir, "calc_case_description_train_set.csv"),
        os.path.join(data_dir, "calc_case_description_test_set.csv"),
    ]

    image_paths = []
    labels = []

    for csv_file in csv_files:
        if not os.path.exists(csv_file):
            continue
        with open(csv_file, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Find pathology column
                path_col = next((c for c in row if "image file path" in c.lower()), None)
                label_col = next((c for c in row if "pathology" in c.lower()), None)
                if not path_col or not label_col:
                    # Try once with fieldnames directly
                    break
                rel_path = row[path_col].strip().replace("/", os.sep)
                raw_label = row[label_col].strip().lower().replace(" ", "_")
                label_val = pathology_map.get(raw_label)
                if label_val is None:
                    continue
                # Images are inside data_dir\cbis_ddsm\
                full_path = os.path.join(data_dir, "cbis_ddsm", rel_path)
                if os.path.exists(full_path):
                    image_paths.append(full_path)
                    labels.append(label_val)
                else:
                    # Case folder resolution for TCIA/Kaggle formatted downloads
                    case_folder = rel_path.split(os.sep)[0]
                    case_dir = os.path.join(data_dir, "cbis_ddsm", case_folder)
                    if os.path.exists(case_dir):
                        found_dcm = None
                        for root, _, files in os.walk(case_dir):
                            dcms = [f for f in files if f.lower().endswith(".dcm")]
                            if dcms:
                                found_dcm = os.path.join(root, dcms[0])
                                if "full mammogram" in root.lower():
                                    break
                        if found_dcm:
                            image_paths.append(found_dcm)
                            labels.append(label_val)

    if len(image_paths) == 0:
        # Check if existing synthetic test dataset exists or generate fallback if no real CSVs
        synth_csv = os.path.join(data_dir, "synthetic_cbis_ddsm", "synthetic_labels.csv")
        if os.path.exists(synth_csv):
            with open(synth_csv, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if os.path.exists(row["image_path"]):
                        image_paths.append(row["image_path"])
                        labels.append(int(row["label"]))
            if len(image_paths) >= 50:
                print(f" Loaded {len(image_paths)} SYNTHETIC TEST DATA samples from {synth_csv}")
                return image_paths, labels
        if not any(os.path.exists(cf) for cf in csv_files):
            return _generate_synthetic_cbis_ddsm(data_dir)

    print(f" CBIS-DDSM: Loaded {len(image_paths)} mammography scans.")
    return image_paths, labels


def prepare_inbreast(data_dir: str) -> Tuple[List[str], List[int]]:
    """
    Loads INbreast mammography dataset.
    data_dir = D:/auramed_datasets/breast/inbreast/raw/INbreast Release 1.0
    Images in: AllDICOMs\
    Labels in: INbreast.csv — column "Bi-Rads": 1,2,3 -> 0 (benign), 4,5,6 -> 1 (malignant)
    """
    if not os.path.exists(os.path.join(data_dir, "INbreast.csv")) and os.path.exists(
        os.path.join(data_dir, "INbreast Release 1.0", "INbreast.csv")
    ):
        data_dir = os.path.join(data_dir, "INbreast Release 1.0")

    dicom_dir = os.path.join(data_dir, "AllDICOMs")
    csv_path = os.path.join(data_dir, "INbreast.csv")

    if not os.path.exists(csv_path) or not os.path.exists(dicom_dir):
        print(f" INbreast: Not found at {data_dir}, skipping.")
        return [], []

    image_paths = []
    labels = []

    dicom_files = [f for f in os.listdir(dicom_dir) if f.lower().endswith(".dcm")]

    with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            file_name_col = next((c for c in row if "file name" in c.lower()), None)
            birads_col = next((c for c in row if "bi-rads" in c.lower() or "birads" in c.lower()), None)
            if not file_name_col or not birads_col:
                break
            file_name = row[file_name_col].strip()
            birads_raw = (
                row[birads_col]
                .strip()
                .replace("A", "")
                .replace("B", "")
                .replace("C", "")
                .replace("a", "")
                .replace("b", "")
                .replace("c", "")
            )
            try:
                birads = int(float(birads_raw))
            except ValueError:
                continue
            label_val = 0 if birads <= 3 else 1

            # Find matching DICOM file in AllDICOMs
            for fname in dicom_files:
                if fname.startswith(file_name):
                    image_paths.append(os.path.join(dicom_dir, fname))
                    labels.append(label_val)
                    break

    print(f" INbreast: Loaded {len(image_paths)} mammography scans.")
    return image_paths, labels


def prepare_breast_dataset(cbis_dir: str, inbreast_dir: str) -> Tuple[List[str], List[int]]:
    cbis_paths, cbis_labels = prepare_cbis_ddsm(cbis_dir)
    inbreast_paths, inbreast_labels = prepare_inbreast(inbreast_dir)
    all_paths = cbis_paths + inbreast_paths
    all_labels = cbis_labels + inbreast_labels
    print(f" Breast total: {len(all_paths)} scans ({sum(all_labels)} malignant, {len(all_labels)-sum(all_labels)} benign)")
    if len(all_paths) == 0:
        print(" WARNING: No real breast data found. Falling back to synthetic.")
        return _generate_synthetic_cbis_ddsm(cbis_dir)
    return all_paths, all_labels


def split_dataset(
    image_paths: List[str],
    labels: List[int],
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
    seed: Optional[int] = None,
) -> Tuple[List[str], List[int], List[str], List[int], List[str], List[int]]:
    """
    Splits dataset into Train, Validation, and Test partitions using stratified sampling
    to preserve class balance across all subsets.

    Returns:
      train_paths, train_labels, val_paths, val_labels, test_paths, test_labels
    """
    if seed is not None:
        random_state = seed
    total = len(image_paths)
    if total < 5:
        # Trivial edge case for micro-tests
        return image_paths, labels, image_paths, labels, image_paths, labels

    # 1. Stratified split for Test set
    train_val_paths, test_paths, train_val_labels, test_labels = train_test_split(
        image_paths,
        labels,
        test_size=test_size,
        stratify=labels if len(np.unique(labels)) > 1 else None,
        random_state=random_state,
    )

    # 2. Stratified split for Validation set from remainder
    effective_val_size = val_size / (1.0 - test_size)
    train_paths, val_paths, train_labels, val_labels = train_test_split(
        train_val_paths,
        train_val_labels,
        test_size=effective_val_size,
        stratify=train_val_labels if len(np.unique(train_val_labels)) > 1 else None,
        random_state=random_state,
    )

    # Print class distributions
    def _dist_str(subset_labels: List[int]) -> str:
        pos = sum(1 for l in subset_labels if l == 1)
        neg = len(subset_labels) - pos
        pct = (pos / len(subset_labels) * 100) if subset_labels else 0
        return f"Total: {len(subset_labels):<4} (Benign: {neg:<3}, Malignant: {pos:<3} | {pct:.1f}% positive)"

    print("\n--- CBIS-DDSM Stratified Dataset Splits ---")
    print(f" Train: {len(train_paths):<5} | {_dist_str(train_labels)}")
    print(f" Val:   {len(val_paths):<5} | {_dist_str(val_labels)}")
    print(f" Test:  {len(test_paths):<5} | {_dist_str(test_labels)}")
    print("-------------------------------------------\n")

    return train_paths, train_labels, val_paths, val_labels, test_paths, test_labels
