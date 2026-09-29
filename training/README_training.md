# AuraMed Model Training & Clinical Validation Environment

This dedicated training framework is decoupled from the main FastAPI clinical application. It provides complete data ingestion, domain-tailored augmentations, model architectures, sensitivity-prioritized clinical metrics, probability calibration, and export pipelines for all three AuraMed screening modalities:

1. **Breast Cancer Screening**: Mammography & Ultrasound (ResNet-50 Binary Classification)
2. **Cervical Cancer Cytology**: Pap Smear Cytology (ViT-Base-Patch16-224 5-Class Bethesda Classification)
3. **PCOS Screening**: Pelvic & Ovarian Ultrasound (ResNet-50 with Dropout Regularization)

---

## Directory Structure

```text
auramed/
  training/
    breast/
      train.py               # ResNet-50 training loop, BCE/Focal loss, scheduler, checkpointing
      dataset.py             # PyTorch Dataset for CBIS-DDSM / BUSI (PNG/JPEG/DICOM)
      augmentations.py       # Albumentations transforms for mammography & breast ultrasound
      evaluate.py            # Standalone clinical evaluation CLI & visualization generator
      calibrate.py           # Temperature scaling / Platt probability calibration
    cervical/
      train.py               # ViT-Base-Patch16-224 (timm) 5-class Pap smear cytology training
      dataset.py             # PyTorch Dataset for SIPaKMeD / Herlev cytology
      augmentations.py       # Cytology-specific stain variations (color jitter, rotation, zoom)
      evaluate.py            # 5-class + binary HSIL/LSIL clinical evaluation
      calibrate.py           # Multi-class softmax temperature scaling
    pcos/
      train.py               # ResNet-50 2-class pelvic ultrasound training loop
      dataset.py             # Ovarian ultrasound image loader (healthy vs PCOS)
      augmentations.py       # Ultrasound speckle, acoustic contrast, affine augmentations
      evaluate.py            # Pelvic ultrasound clinical evaluation
      calibrate.py           # Platt scaling calibration
    shared/
      metrics.py             # Clinical metrics (AUC-ROC, AUC-PR, Sensitivity@90%, Specificity, PPV, NPV, F1)
      visualize.py           # Publication-ready plots: ROC, PR, Confusion Matrix, Calibration curve
      export.py              # Checkpoint exporter (.pth) + inference metadata JSON generator
    data/
      breast/{raw,processed}/
      cervical/{raw,processed}/
      pcos/{raw,processed}/
    weights/
      breast_model.pth
      cervical_model.pth
      pcos_model.pth
    logs/
    requirements_training.txt
    README_training.md
```

---

## 1. Environment Setup

It is strongly recommended to use a dedicated Python 3.10+ virtual environment for training:

```bash
# Navigate to the training root
cd training

# Create a virtual environment
python -m venv .venv_train

# Activate the virtual environment
# On Linux/macOS:
source .venv_train/bin/activate
# On Windows (PowerShell):
.\.venv_train\Scripts\Activate.ps1

# Upgrade pip
pip install --upgrade pip

# Install training dependencies
pip install -r requirements_training.txt
```

---

## 2. Dataset Acquisition & Preparation

### A. Breast Cancer Screening (Mammography & Ultrasound)
- **Primary Open Datasets**:
  - **CBIS-DDSM (Curated Breast Imaging Subset of DDSM)**: [TCIA CBIS-DDSM Portal](https://wiki.cancerimagingarchive.net/display/Public/CBIS-DDSM) (contains full-field digital mammography DICOM images with biopsy-proven ground truth).
  - **BUSI (Breast Ultrasound Images Dataset)**: [Kaggle Breast Ultrasound Dataset](https://www.kaggle.com/datasets/aryashah2k/breast-ultrasound-images-dataset) (1,114 normal, benign, and malignant breast ultrasound images).
- **Placement**:
  - Place raw files in `training/data/breast/raw/`.
  - Organize into `benign/` and `malignant/` directories under `training/data/breast/processed/`:
    ```text
    data/breast/processed/
      benign/
        image_001.png
        ...
      malignant/
        image_101.png
        ...
    ```

### B. Cervical Cytology & Colposcopy
- **Primary Open Datasets**:
  - **SIPaKMeD**: [SIPaKMeD Cytology Dataset](https://www.cs.uoi.gr/~maramis/sipakmed/) (4,049 single-cell cervical images across 5 classes).
  - **Herlev Pap Smear Dataset**: [Herlev Benchmark](http://mlearn.ics.uci.edu/databases/cervical-cancer/) (7-class cytology data mapped into Bethesda categories).
- **Placement**:
  - Organize into the 5 standard Bethesda class directories under `training/data/cervical/processed/`:
    ```text
    data/cervical/processed/
      Dyskeratotic/     # High-grade Squamous Intraepithelial Lesion (HSIL)
      Koilocytotic/     # Low-grade Squamous Intraepithelial Lesion (LSIL)
      Metaplastic/      # Atypical Squamous Cells (ASC-US)
      Parabasal/        # Atypical Squamous Cells, cannot exclude HSIL (ASC-H)
      Normal/           # Negative for Intraepithelial Lesion or Malignancy (NILM)
    ```

### C. Polycystic Ovary Syndrome (PCOS) Ultrasound
- **Primary Open Datasets**:
  - **Kaggle PCOS Ultrasound Dataset**: [Polycystic Ovary Syndrome (PCOS) Dataset](https://www.kaggle.com/datasets/prasunroy/natural-images) / [Kaggle PCOS Ultrasound](https://www.kaggle.com/datasets/anaghachoudhari/pcos-ultrasound-images) (transvaginal/pelvic ultrasound scans).
- **Placement**:
  - Organize under `training/data/pcos/processed/`:
    ```text
    data/pcos/processed/
      healthy/         # Normal ovarian follicles
      pcos/            # Polycystic ovary morphology
    ```

---

## 3. How to Run Each Training Script

Each training module accepts standard CLI arguments including `--data_dir`, `--epochs`, `--batch_size`, `--lr`, `--device`, and `--output_dir`.

### Train Breast Screening Model (ResNet-50)
```bash
python breast/train.py \
  --data_dir data/breast/processed \
  --epochs 25 \
  --batch_size 16 \
  --lr 1e-4 \
  --pos_weight 2.0 \
  --device cuda
```

### Train Cervical Cytology Model (ViT-Base-Patch16-224)
```bash
python cervical/train.py \
  --data_dir data/cervical/processed \
  --epochs 20 \
  --batch_size 16 \
  --lr 5e-5 \
  --device cuda
```

### Train PCOS Ultrasound Model (ResNet-50 with Dropout)
```bash
python pcos/train.py \
  --data_dir data/pcos/processed \
  --epochs 20 \
  --batch_size 16 \
  --lr 1e-4 \
  --device cuda
```

---

## 4. How to Interpret the Metrics Output

Screening diagnostics must minimize false negatives above all else to ensure patient safety.

When running `evaluate.py` or completing training, the formatted **Clinical Validation Report** is printed:

```text
================================================
CLINICAL VALIDATION REPORT
Model: ResNet-50 Breast Screening
Dataset: CBIS-DDSM Holdout Set
================================================

PRIMARY METRICS:
AUC-ROC:          0.9420
AUC-PR:           0.9150

AT OPTIMAL THRESHOLD (0.42):
Sensitivity:      0.9230 (92.3%)
Specificity:      0.8850 (88.5%)
PPV:              0.8710
NPV:              0.9320
F1 Score:         0.8960
Accuracy:         0.9020

CONFUSION MATRIX:
                 Predicted Negative    Predicted Positive
Actual Negative  115                   15                    (TN=115, FP=15)
Actual Positive  8                     96                    (FN=8, TP=96)

THRESHOLD ANALYSIS:
Threshold    Sensitivity    Specificity    PPV        NPV       
------------------------------------------------------------
0.30         0.9808         0.8000         0.7969     0.9811
0.40         0.9423         0.8692         0.8522     0.9496
0.50         0.8846         0.9154         0.8932     0.9084
0.60         0.8269         0.9462         0.9247     0.8723
0.70         0.7308         0.9769         0.9620     0.8208

CLINICAL INTERPRETATION:
At this threshold (0.42), the model correctly identifies
92.3% of positive cases (sensitivity).
88.5% of negative cases are correctly
identified as negative (specificity).
================================================
```

### Key Clinical Metrics:
1. **Sensitivity (Recall / True Positive Rate)**:
   - Percentage of true disease cases correctly detected by the model. Target: $\ge 90\%$.
2. **Specificity (True Negative Rate)**:
   - Percentage of benign/normal scans correctly categorized as negative. Prevents unnecessary invasive biopsies and patient anxiety.
3. **Positive Predictive Value (PPV / Precision)**:
   - Probability that a patient flagged positive truly has the condition.
4. **Negative Predictive Value (NPV)**:
   - Probability that a patient flagged negative is truly disease-free. A high NPV ($>93\%$) offers reassurance in clinical screening.
5. **Calibrated Threshold**:
   - Rather than relying on an arbitrary 0.5 threshold, `find_optimal_threshold()` automatically sweeps operating points to guarantee sensitivity $\ge 0.90$ while maximizing specificity.

---

## 5. How to Deploy Trained Weights to the Main Application

Once trained and exported, the checkpoint `.pth` file and its metadata `.json` are written to `training/weights/`.

To deploy them into the AuraMed clinical inference engine:

```bash
# From the project root (auramed/)
# 1. Copy weight files
cp training/weights/breast_model.pth backend/app/ml/weights/
cp training/weights/cervical_model.pth backend/app/ml/weights/
cp training/weights/pcos_model.pth backend/app/ml/weights/

# 2. On Windows (PowerShell):
Copy-Item training/weights/breast_model.pth backend/app/ml/weights/
Copy-Item training/weights/cervical_model.pth backend/app/ml/weights/
Copy-Item training/weights/pcos_model.pth backend/app/ml/weights/
```

When the FastAPI backend starts, `ModelLoader.get_instance().load_all_models()` detects the `.pth` files and automatically initializes the calibrated vision models with real weights.

---

## 6. Expected Training Time: CPU vs GPU

| Modality | Architecture | Dataset Size | GPU (NVIDIA RTX 3080/4090) | GPU (NVIDIA T4 / V100) | CPU (8-core Intel/AMD) |
|---|---|---|---|---|---|
| **Breast** | ResNet-50 | ~2,500 images | ~12 - 18 minutes | ~25 - 35 minutes | ~3.5 - 5.0 hours |
| **Cervical** | ViT-Base-16-224 | ~4,000 images | ~20 - 30 minutes | ~40 - 55 minutes | ~7.0 - 9.5 hours |
| **PCOS** | ResNet-50 | ~1,800 images | ~8 - 14 minutes | ~18 - 25 minutes | ~2.5 - 4.0 hours |

---

## 7. Minimum & Recommended Hardware Requirements

### Minimum Hardware (Inference / Micro-Training):
- **CPU**: Quad-core x86-64 CPU (Intel Core i5 8th gen or AMD Ryzen 5)
- **RAM**: 16 GB System Memory
- **Storage**: 25 GB free SSD space
- **GPU**: Optional (CPU-only training will run at reduced batch sizes)

### Recommended Hardware (Production Model Training):
- **CPU**: 8+ cores (Intel Core i7/i9 12th+ gen, AMD Ryzen 7/9, or cloud vCPU)
- **RAM**: 32 GB or 64 GB DDR4/DDR5
- **GPU**: NVIDIA GPU with at least 8 GB VRAM (RTX 3070, RTX 4080, A10G, T4, or V100) with CUDA 11.8+ / 12.x support
- **Storage**: 100 GB NVMe SSD for fast DICOM and high-resolution image decoding
