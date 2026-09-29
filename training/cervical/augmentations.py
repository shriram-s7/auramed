"""
Data Augmentations for Cervical Cytology Imaging (SIPaKMeD).
Tailored for cellular morphology invariance:
arbitrary cellular rotation, Pap staining variability (color jitter),
slight scale/zoom, and ImageNet normalization.
"""
import numpy as np
from PIL import Image
from torchvision import transforms


class TorchvisionCytologyWrapper:
    """
    Wrapper around torchvision.transforms.Compose allowing both standard
    torchvision usage: transform(pil_img) -> Tensor
    and Albumentations-style keyword usage: transform(image=numpy_arr) -> {"image": Tensor}
    """
    def __init__(self, compose_tf):
        self.compose_tf = compose_tf

    def __call__(self, img=None, image=None, **kwargs):
        inp = img if img is not None else image
        if isinstance(inp, np.ndarray):
            inp = Image.fromarray(inp)
        out = self.compose_tf(inp)
        if image is not None and img is None:
            return {"image": out}
        return out


def get_cervical_train_transforms(img_size=(224, 224), **kwargs):
    """
    Cytology training augmentation pipeline:
    - Cellular rotation and flips (cells have no natural anatomical orientation)
    - Color jitter for laboratory Pap stain variations (hematoxylin/eosin/orange G)
    - Random affine (subtle shifts, scaling)
    - ImageNet normalization
    """
    target_size = img_size if isinstance(img_size, tuple) else (224, 224)
    raw_compose = transforms.Compose([
        transforms.Resize(target_size),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=45),
        transforms.ColorJitter(
            brightness=0.2,
            contrast=0.2,
            saturation=0.25,
            hue=0.1,
        ),
        transforms.RandomAffine(
            degrees=0,
            translate=(0.08, 0.08),
            scale=(0.9, 1.15),
        ),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])
    return TorchvisionCytologyWrapper(raw_compose)


def get_cervical_val_transforms(img_size=(224, 224), **kwargs):
    """
    Deterministic validation and testing transform:
    Resize(224, 224) and ImageNet normalization.
    """
    target_size = img_size if isinstance(img_size, tuple) else (224, 224)
    raw_compose = transforms.Compose([
        transforms.Resize(target_size),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])
    return TorchvisionCytologyWrapper(raw_compose)


# Aliases for training script parity
get_train_transforms = get_cervical_train_transforms
get_val_transforms = get_cervical_val_transforms
