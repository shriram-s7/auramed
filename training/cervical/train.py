import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, 'D:/python_packages')
from data_config import SIPAKMED_DIR, HERLEV_DIR, MENDELEY_CERVICAL_DIR

"""
Complete Cervical Cancer Model Training Pipeline (SIPaKMeD Cytology).
Fine-tunes a Vision Transformer (ViT-Base-Patch16-224) across 5 Bethesda-aligned clinical cytology classes:
0: Dyskeratotic (HSIL)
1: Koilocytotic (LSIL)
2: Metaplastic (ASC-US)
3: Parabasal (ASC-H)
4: Normal (NILM)

Features:
- Layer-wise learning rate decay across 12 transformer blocks
- Label smoothing cross-entropy loss (0.1)
- Mixup data augmentation (alpha = 0.2)
- Warmup + Cosine Annealing learning rate schedule
- Early stopping on validation accuracy
- High-risk HSIL clinical sensitivity evaluation
"""
import argparse
import random
from typing import Dict, List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import timm
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import LambdaLR
from torch.utils.data import DataLoader
from tqdm import tqdm

current_dir = os.path.dirname(os.path.abspath(__file__))
training_root = os.path.dirname(current_dir)
if training_root not in sys.path:
    sys.path.insert(0, training_root)

from cervical.augmentations import get_cervical_train_transforms, get_cervical_val_transforms
from cervical.dataset import CLASS_NAMES, SIPaKMeDDataset, prepare_sipakmed, split_dataset
from shared.export import export_model
from shared.metrics import (
    compute_multiclass_metrics,
    evaluate_bethesda_clinical_mapping,
)


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True


def build_vit_parameter_groups(model: nn.Module, base_lr: float, weight_decay: float = 0.0001) -> List[Dict]:
    """
    Creates parameter groups with layer-wise learning rate decay (LLRD) for ViT-Base:
      - Blocks 0-3 + patch_embed + pos_embed: lr * 0.1
      - Blocks 4-7:                           lr * 0.3
      - Blocks 8-11 + norm:                   lr * 0.6
      - Classifier head:                      lr * 1.0
    """
    group_early = []
    group_mid = []
    group_late = []
    group_head = []

    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue

        if "head" in name or "fc" in name:
            group_head.append(param)
        elif any(f"blocks.{i}." in name for i in range(8, 12)) or "norm." in name:
            group_late.append(param)
        elif any(f"blocks.{i}." in name for i in range(4, 8)):
            group_mid.append(param)
        else:
            # Blocks 0-3, patch_embed, pos_embed, cls_token
            group_early.append(param)

    print(" [ViT Layer-Wise LR Decay Groups]")
    print(f"   Early layers (0-3 + embeds): {len(group_early)} tensors @ {base_lr * 0.1:.7f}")
    print(f"   Mid layers (4-7):            {len(group_mid)} tensors @ {base_lr * 0.3:.7f}")
    print(f"   Late layers (8-11 + norm):   {len(group_late)} tensors @ {base_lr * 0.6:.7f}")
    print(f"   Classifier head:             {len(group_head)} tensors @ {base_lr * 1.0:.7f}")

    return [
        {"params": group_early, "lr": base_lr * 0.1, "weight_decay": weight_decay},
        {"params": group_mid, "lr": base_lr * 0.3, "weight_decay": weight_decay},
        {"params": group_late, "lr": base_lr * 0.6, "weight_decay": weight_decay},
        {"params": group_head, "lr": base_lr * 1.0, "weight_decay": weight_decay},
    ]


def get_warmup_cosine_scheduler(
    optimizer: torch.optim.Optimizer,
    warmup_epochs: int,
    total_epochs: int,
    min_lr_ratio: float = 0.01,
) -> LambdaLR:
    """
    Linear warmup for `warmup_epochs`, followed by cosine decay down to min_lr_ratio * base_lr.
    """
    def lr_lambda(current_epoch: int) -> float:
        if current_epoch < warmup_epochs:
            return float(current_epoch + 1) / float(max(1, warmup_epochs))
        progress = float(current_epoch - warmup_epochs) / float(max(1, total_epochs - warmup_epochs))
        return min_lr_ratio + 0.5 * (1.0 - min_lr_ratio) * (1.0 + np.cos(np.pi * progress))

    return LambdaLR(optimizer, lr_lambda=lr_lambda)


def train_one_epoch_mixup(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
    mixup_alpha: float = 0.2,
) -> Tuple[float, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in tqdm(loader, desc="Training ViT", leave=False):
        images = images.to(device)
        labels = labels.to(device)
        batch_size = images.size(0)

        # Mixup Augmentation
        do_mixup = (random.random() < 0.5) and (mixup_alpha > 0) and (batch_size > 1)
        if do_mixup:
            lam = np.random.beta(mixup_alpha, mixup_alpha)
            perm = torch.randperm(batch_size).to(device)
            mixed_images = lam * images + (1.0 - lam) * images[perm]

            optimizer.zero_grad()
            outputs = model(mixed_images)
            loss = lam * criterion(outputs, labels) + (1.0 - lam) * criterion(outputs, labels[perm])
        else:
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        running_loss += loss.item() * batch_size
        _, preds = outputs.max(1)
        correct += preds.eq(labels).sum().item()
        total += batch_size

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
        for images, labels in tqdm(loader, desc="Evaluating ViT", leave=False):
            images = images.to(device)
            labels_d = labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels_d)
            running_loss += loss.item() * images.size(0)

            probs = torch.softmax(outputs, dim=1).cpu().numpy()
            all_probs.append(probs)
            all_targets.extend(labels.numpy().flatten())

    total = len(all_targets)
    avg_loss = running_loss / max(total, 1)
    probs_concat = np.concatenate(all_probs, axis=0) if all_probs else np.zeros((0, 5))
    return avg_loss, np.array(all_targets), probs_concat


def plot_cervical_training_curves(history: Dict[str, List[float]], save_path: str):
    """Saves loss and accuracy/F1 progression curves."""
    os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    epochs = range(1, len(history["train_loss"]) + 1)

    # Subplot 1: Loss
    ax1.plot(epochs, history["train_loss"], label="Train Loss", color="#2563EB", lw=2)
    ax1.plot(epochs, history["val_loss"], label="Val Loss", color="#DC2626", lw=2)
    ax1.set_xlabel("Epoch", fontsize=11, fontweight="bold")
    ax1.set_ylabel("Loss", fontsize=11, fontweight="bold")
    ax1.set_title("Training & Validation Loss", fontsize=12, fontweight="bold")
    ax1.legend(loc="upper right", frameon=True)
    ax1.grid(True, linestyle=":", alpha=0.6)

    # Subplot 2: Multi-Class Accuracy & Macro F1
    ax2.plot(epochs, history["val_acc"], label="Val Accuracy", color="#16A34A", lw=2)
    ax2.plot(epochs, history["val_macro_f1"], label="Val Macro F1", color="#9333EA", lw=2)
    ax2.set_xlabel("Epoch", fontsize=11, fontweight="bold")
    ax2.set_ylabel("Score", fontsize=11, fontweight="bold")
    ax2.set_title("Validation Accuracy & Macro F1", fontsize=12, fontweight="bold")
    ax2.legend(loc="lower right", frameon=True)
    ax2.grid(True, linestyle=":", alpha=0.6)

    plt.suptitle("AuraMed SIPaKMeD Cytology ViT Performance", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close(fig)
    print(f" Saved training curves to: {save_path}")


def main():
    parser = argparse.ArgumentParser(description="Train AuraMed Cervical Cytology ViT on SIPaKMeD")
    parser.add_argument("--data_dir", type=str, default=os.path.join(training_root, "data", "cervical", "raw"))
    parser.add_argument("--output_dir", type=str, default=os.path.join(training_root, "weights"))
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.00005)
    parser.add_argument("--weight_decay", type=float, default=0.0001)
    parser.add_argument("--warmup_epochs", type=int, default=5)
    parser.add_argument("--label_smoothing", type=float, default=0.1)
    parser.add_argument("--mixup_alpha", type=float, default=0.2)
    parser.add_argument("--patience", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    set_seed(args.seed)
    device = torch.device(args.device)
    os.makedirs(args.output_dir, exist_ok=True)
    logs_dir = os.path.join(training_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)

    print("=" * 65)
    print(" AURAMED CERVICAL CYTOLOGY (SIPaKMeD) ViT TRAINING PIPELINE")
    print("=" * 65)
    print(f" Architecture: vit_base_patch16_224 | Device: {device} | Batch: {args.batch_size} | Epochs: {args.epochs}")

    # 1. Dataset Preparation & Stratified Split
    from dataset import prepare_cervical_dataset
    image_paths, labels = prepare_cervical_dataset(SIPAKMED_DIR, HERLEV_DIR, MENDELEY_CERVICAL_DIR)
    train_paths, train_labels, val_paths, val_labels, test_paths, test_labels = split_dataset(
        image_paths, labels, test_size=0.15, val_size=0.15, random_state=args.seed
    )

    train_dataset = SIPaKMeDDataset(train_paths, train_labels, transform=get_cervical_train_transforms())
    val_dataset = SIPaKMeDDataset(val_paths, val_labels, transform=get_cervical_val_transforms())
    test_dataset = SIPaKMeDDataset(test_paths, test_labels, transform=get_cervical_val_transforms())

    num_workers = 4 if args.device == "cuda" else 0
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=num_workers, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=num_workers, pin_memory=True)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False, num_workers=num_workers, pin_memory=True)

    # 2. Vision Transformer Model Setup
    model = timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=5).to(device)

    # 3. Layer-Wise Learning Rate Decay Optimizer
    param_groups = build_vit_parameter_groups(model, base_lr=args.lr, weight_decay=args.weight_decay)
    optimizer = AdamW(param_groups)

    # 4. Warmup + Cosine Annealing Scheduler
    scheduler = get_warmup_cosine_scheduler(optimizer, warmup_epochs=args.warmup_epochs, total_epochs=args.epochs)

    # 5. Label Smoothing Cross-Entropy Loss
    criterion = nn.CrossEntropyLoss(label_smoothing=args.label_smoothing)

    # 6. Training Loop with Per-Class Metrics & Early Stopping
    best_acc = -1.0
    patience_counter = 0
    best_checkpoint_path = os.path.join(args.output_dir, "cervical_best.pth")

    history = {
        "train_loss": [],
        "val_loss": [],
        "val_acc": [],
        "val_macro_f1": [],
    }

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_one_epoch_mixup(
            model, train_loader, criterion, optimizer, device, mixup_alpha=args.mixup_alpha
        )
        val_loss, y_true_val, y_probs_val = evaluate_loader(model, val_loader, criterion, device)
        scheduler.step()

        metrics_val = compute_multiclass_metrics(y_true_val, y_probs_val, class_names=CLASS_NAMES)
        val_acc = metrics_val["accuracy"]
        val_f1 = metrics_val["macro_f1"]
        per_class_sens = metrics_val["per_class_sensitivity"]

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_macro_f1"].append(val_f1)

        d = per_class_sens.get("Dyskeratotic", 0.0)
        k = per_class_sens.get("Koilocytotic", 0.0)
        m = per_class_sens.get("Metaplastic", 0.0)
        p = per_class_sens.get("Parabasal", 0.0)
        n = per_class_sens.get("Normal", 0.0)

        print(
            f"Epoch {epoch:02d}/{args.epochs:02d} | "
            f"Loss: {train_loss:.4f} | "
            f"Val Accuracy: {val_acc:.4f} | "
            f"Per-class Sens: Dys:{d:.3f} Koi:{k:.3f} Met:{m:.3f} Par:{p:.3f} Nor:{n:.3f}"
        )

        if val_acc > best_acc:
            best_acc = val_acc
            patience_counter = 0
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "val_acc": val_acc,
                    "val_metrics": metrics_val,
                },
                best_checkpoint_path,
            )
            print(f" [*] New best validation accuracy ({val_acc:.4f})! Saved checkpoint to {best_checkpoint_path}")
        else:
            patience_counter += 1
            if patience_counter >= args.patience:
                print(f"\n[!] Early stopping triggered at epoch {epoch} (no validation accuracy improvement for {args.patience} epochs).")
                break

    # 7. Post-Training: Load Best Checkpoint & Run Holdout Test Evaluation
    print("\n" + "=" * 65)
    print(" EVALUATION ON HELD-OUT TEST DATASET")
    print("=" * 65)

    if os.path.exists(best_checkpoint_path):
        saved = torch.load(best_checkpoint_path, map_location=device, weights_only=False)
        model.load_state_dict(saved["model_state_dict"])
        print(f" Loaded best ViT model from epoch {saved.get('epoch', 'N/A')}")

    test_loss, y_true_test, y_probs_test = evaluate_loader(model, test_loader, criterion, device)
    test_metrics = compute_multiclass_metrics(y_true_test, y_probs_test, class_names=CLASS_NAMES)

    # 8. Clinical Bethesda Safety Mapping & HSIL Sensitivity
    bethesda_metrics = evaluate_bethesda_clinical_mapping(y_true_test, y_probs_test, class_names=CLASS_NAMES)
    test_metrics["bethesda"] = bethesda_metrics

    # 9. Export Final Model Checkpoint & Metadata
    final_config = {
        "architecture": "vit_base_patch16_224",
        "pretrained": True,
        "dataset": "SIPaKMeD",
        "epochs_trained": epoch,
        "batch_size": args.batch_size,
        "learning_rate": args.lr,
        "weight_decay": args.weight_decay,
        "label_smoothing": args.label_smoothing,
        "mixup_alpha": args.mixup_alpha,
        "input_resolution": [224, 224],
        "classes": CLASS_NAMES,
    }
    export_model(model, "cervical_model", test_metrics, final_config, output_dir=args.output_dir)

    # 10. Save Training Curves
    curves_path = os.path.join(logs_dir, "cervical_training_curves.png")
    plot_cervical_training_curves(history, curves_path)
    print(f"\n Complete! Checkpoint saved in {args.output_dir}, curves saved to {curves_path}")


if __name__ == "__main__":
    main()
