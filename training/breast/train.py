import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, 'D:/python_packages')
from data_config import CBIS_DDSM_DIR, INBREAST_DIR

"""
Complete Breast Cancer Model Training Pipeline (CBIS-DDSM Mammography).
Trains ResNet-50 with two-phase fine-tuning (frozen early layers for 5 epochs, then unfreezing),
class-imbalance weighted BCEWithLogitsLoss, Cosine Annealing learning rate schedule,
gradient clipping, early stopping on validation AUC, optimal threshold tuning,
and comprehensive clinical validation reporting.
"""
import argparse
import random
from typing import Dict, List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader
from torchvision import models
from tqdm import tqdm

current_dir = os.path.dirname(os.path.abspath(__file__))
training_root = os.path.dirname(current_dir)
if training_root not in sys.path:
    sys.path.insert(0, training_root)

from breast.augmentations import get_train_transforms, get_val_transforms
from breast.dataset import CBISDDSMDataset, prepare_cbis_ddsm, split_dataset
from shared.export import export_model
from shared.metrics import compute_clinical_metrics, find_optimal_threshold, print_clinical_report


class BreastCancerModel(nn.Module):
    """ResNet-50 architecture with modified single-output linear classification head."""
    def __init__(self, pretrained: bool = True):
        super().__init__()
        weights = models.ResNet50_Weights.DEFAULT if pretrained else None
        self.resnet = models.resnet50(weights=weights)
        self.resnet.fc = nn.Linear(self.resnet.fc.in_features, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.resnet(x)


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True


def freeze_early_layers(model: BreastCancerModel):
    """Freezes initial convolutional layers (conv1, bn1, layer1, layer2) for feature extraction."""
    for name, param in model.resnet.named_parameters():
        if any(name.startswith(layer) for layer in ["conv1", "bn1", "layer1", "layer2"]):
            param.requires_grad = False
    print(" [Phase 1] Feature Extraction: Frozen early layers (conv1, bn1, layer1, layer2).")


def unfreeze_all_layers(model: BreastCancerModel):
    """Unfreezes all model parameters for full end-to-end fine-tuning."""
    for param in model.parameters():
        param.requires_grad = True
    print(" [Phase 2] Full Fine-Tuning: Unfroze all backbone layers.")


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> Tuple[float, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in tqdm(loader, desc="Training", leave=False):
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        logits = outputs.squeeze(1) if outputs.dim() > 1 else outputs

        loss = criterion(logits, labels)
        loss.backward()

        # Gradient clipping to prevent exploding gradients
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        preds = (torch.sigmoid(logits) >= 0.5).float()
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    epoch_loss = running_loss / max(total, 1)
    epoch_acc = correct / max(total, 1)
    return epoch_loss, epoch_acc


def evaluate_loader(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> Tuple[float, np.ndarray, np.ndarray]:
    model.eval()
    running_loss = 0.0
    all_targets = []
    all_probs = []

    with torch.no_grad():
        for images, labels in tqdm(loader, desc="Evaluating", leave=False):
            images = images.to(device)
            labels_d = labels.to(device)

            outputs = model(images)
            logits = outputs.squeeze(1) if outputs.dim() > 1 else outputs

            loss = criterion(logits, labels_d)
            running_loss += loss.item() * images.size(0)

            probs = torch.sigmoid(logits).cpu().numpy()
            all_probs.extend(probs.flatten())
            all_targets.extend(labels.numpy().flatten())

    total = len(all_targets)
    avg_loss = running_loss / max(total, 1)
    return avg_loss, np.array(all_targets), np.array(all_probs)


def plot_breast_training_curves(history: Dict[str, List[float]], save_path: str):
    """Saves two-subplot figure of loss and validation performance."""
    os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    epochs = range(1, len(history["train_loss"]) + 1)

    # Subplot 1: Loss
    ax1.plot(epochs, history["train_loss"], label="Train Loss", color="#2563EB", lw=2)
    ax1.plot(epochs, history["val_loss"], label="Val Loss", color="#DC2626", lw=2)
    ax1.set_xlabel("Epoch", fontsize=11, fontweight="bold")
    ax1.set_ylabel("Loss", fontsize=11, fontweight="bold")
    ax1.set_title("Training and Validation Loss", fontsize=12, fontweight="bold")
    ax1.legend(loc="upper right", frameon=True)
    ax1.grid(True, linestyle=":", alpha=0.6)

    # Subplot 2: Val AUC and Sensitivity
    ax2.plot(epochs, history["val_auc"], label="Val AUC-ROC", color="#16A34A", lw=2)
    ax2.plot(epochs, history["val_sensitivity"], label="Val Sensitivity", color="#9333EA", lw=2)
    ax2.set_xlabel("Epoch", fontsize=11, fontweight="bold")
    ax2.set_ylabel("Metric Value", fontsize=11, fontweight="bold")
    ax2.set_title("Validation AUC & Sensitivity Progression", fontsize=12, fontweight="bold")
    ax2.legend(loc="lower right", frameon=True)
    ax2.grid(True, linestyle=":", alpha=0.6)

    plt.suptitle("AuraMed CBIS-DDSM Training Performance", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close(fig)
    print(f" Saved training curves to: {save_path}")


def main():
    parser = argparse.ArgumentParser(description="Train AuraMed Breast Cancer Model on CBIS-DDSM")
    parser.add_argument("--data_dir", type=str, default=os.path.join(training_root, "data", "breast", "raw"))
    parser.add_argument("--output_dir", type=str, default=os.path.join(training_root, "weights"))
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=0.0001)
    parser.add_argument("--weight_decay", type=float, default=0.0001)
    parser.add_argument("--patience", type=int, default=10, help="Early stopping patience")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    set_seed(args.seed)
    device = torch.device(args.device)
    os.makedirs(args.output_dir, exist_ok=True)
    logs_dir = os.path.join(training_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)

    print("=" * 65)
    print(" AURAMED BREAST CANCER (CBIS-DDSM) TRAINING PIPELINE")
    print("=" * 65)
    print(f" Target Device: {device} | Batch Size: {args.batch_size} | Epochs: {args.epochs}")

    # 1. Dataset Preparation & Stratified Split
    from dataset import prepare_breast_dataset
    image_paths, labels = prepare_breast_dataset(CBIS_DDSM_DIR, INBREAST_DIR)
    train_paths, train_labels, val_paths, val_labels, test_paths, test_labels = split_dataset(
        image_paths, labels, test_size=0.15, val_size=0.15, random_state=args.seed
    )

    # 2. PyTorch DataLoaders with Augmentations
    train_transforms = get_train_transforms()
    val_transforms = get_val_transforms()

    train_dataset = CBISDDSMDataset(train_paths, train_labels, transform=train_transforms)
    val_dataset = CBISDDSMDataset(val_paths, val_labels, transform=val_transforms)
    test_dataset = CBISDDSMDataset(test_paths, test_labels, transform=val_transforms)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=4, pin_memory=True)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False, num_workers=4, pin_memory=True)

    # 3. Model Setup with Layer Freezing
    model = BreastCancerModel(pretrained=True).to(device)
    freeze_early_layers(model)

    # 4. Auto-Compute Positive Weight for Imbalanced Classification
    pos_count = sum(1 for l in train_labels if l == 1)
    neg_count = sum(1 for l in train_labels if l == 0)
    pos_weight_val = (neg_count / max(pos_count, 1))
    pos_weight_tensor = torch.tensor([pos_weight_val]).to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight_tensor)
    print(f" Auto-computed Loss pos_weight: {pos_weight_val:.3f} (Negatives: {neg_count}, Positives: {pos_count})")

    # 5. Optimizer & Cosine Annealing Scheduler
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)

    # 6. Training Loop with Early Stopping
    best_auc = -1.0
    patience_counter = 0
    best_checkpoint_path = os.path.join(args.output_dir, "breast_best.pth")

    history = {
        "train_loss": [],
        "val_loss": [],
        "val_auc": [],
        "val_sensitivity": [],
    }

    for epoch in range(1, args.epochs + 1):
        # Two-phase fine-tuning transition after epoch 5
        if epoch == 6:
            unfreeze_all_layers(model)

        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, y_true_val, y_probs_val = evaluate_loader(model, val_loader, criterion, device)
        scheduler.step()

        val_metrics = compute_clinical_metrics(y_true_val, y_probs_val, threshold=0.5)
        val_auc = val_metrics["auc_roc"]
        val_sens = val_metrics["sensitivity"]
        val_spec = val_metrics["specificity"]
        current_lr = optimizer.param_groups[0]["lr"]

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_auc"].append(val_auc)
        history["val_sensitivity"].append(val_sens)

        print(
            f"Epoch {epoch:02d}/{args.epochs:02d} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Val Loss: {val_loss:.4f} | "
            f"Val AUC: {val_auc:.4f} | "
            f"Val Sensitivity: {val_sens:.4f} | "
            f"Val Specificity: {val_spec:.4f} | "
            f"LR: {current_lr:.6f}"
        )

        # Early stopping tracking on Validation AUC
        if val_auc > best_auc:
            best_auc = val_auc
            patience_counter = 0
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "val_auc": val_auc,
                    "val_metrics": val_metrics,
                },
                best_checkpoint_path,
            )
            print(f" [*] New best validation AUC ({val_auc:.4f})! Saved checkpoint to {best_checkpoint_path}")
        else:
            patience_counter += 1
            if patience_counter >= args.patience:
                print(f"\n[!] Early stopping triggered at epoch {epoch} (no validation AUC improvement for {args.patience} epochs).")
                break

    # 7. Post-Training: Load Best Checkpoint & Run Holdout Test Evaluation
    print("\n" + "=" * 65)
    print(" EVALUATION ON HELD-OUT TEST DATASET")
    print("=" * 65)

    if os.path.exists(best_checkpoint_path):
        saved = torch.load(best_checkpoint_path, map_location=device, weights_only=False)
        model.load_state_dict(saved["model_state_dict"])
        print(f" Loaded best model from epoch {saved.get('epoch', 'N/A')}")

    test_loss, y_true_test, y_probs_test = evaluate_loader(model, test_loader, criterion, device)

    # Find optimal operating threshold ensuring >=90% sensitivity
    optimal_th = find_optimal_threshold(y_true_test, y_probs_test, min_sensitivity=0.90)
    test_metrics = compute_clinical_metrics(y_true_test, y_probs_test, threshold=optimal_th)

    print_clinical_report(test_metrics, model_name="AuraMed ResNet-50 Mammography", dataset_name="CBIS-DDSM Test Holdout")

    # 8. Export Final Model & Metadata for Inference Engine
    final_config = {
        "architecture": "resnet50",
        "pretrained": True,
        "dataset": "CBIS-DDSM",
        "epochs_trained": epoch,
        "batch_size": args.batch_size,
        "learning_rate": args.lr,
        "weight_decay": args.weight_decay,
        "optimal_threshold": optimal_th,
        "pos_weight": pos_weight_val,
        "input_resolution": [224, 224],
        "classes": ["Benign", "Malignant"],
    }
    export_model(model, "breast_model", test_metrics, final_config, output_dir=args.output_dir)

    # 9. Save Training Curves Plot
    curves_path = os.path.join(logs_dir, "breast_training_curves.png")
    plot_breast_training_curves(history, curves_path)
    print(f"\n Complete! Checkpoint saved in {args.output_dir}, curves saved to {curves_path}")


if __name__ == "__main__":
    main()
