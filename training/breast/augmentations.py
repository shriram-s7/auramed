import numpy as np
from PIL import Image
from torchvision import transforms


class TorchvisionTransformWrapper:
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


def get_train_transforms(img_size=(224, 224), **kwargs):
    """
    Medical imaging training augmentation pipeline:
    - Resize(256, 256) followed by RandomCrop(224, 224)
    - Horizontal and vertical flips
    - Random rotation up to 15 degrees
    - ColorJitter for tissue density and exposure variations
    - RandomAffine for translation and scale shifts
    - Normalization with ImageNet statistics
    - RandomErasing for occlusion robustness
    """
    crop_size = img_size if isinstance(img_size, tuple) else (224, 224)
    resize_h = int(crop_size[0] * (256 / 224))
    resize_w = int(crop_size[1] * (256 / 224))
    raw_compose = transforms.Compose([
        transforms.Resize((resize_h, resize_w)),
        transforms.RandomCrop(crop_size),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.3),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(
            brightness=0.2,
            contrast=0.3,
            saturation=0.1,
            hue=0.05,
        ),
        transforms.RandomAffine(
            degrees=0,
            translate=(0.1, 0.1),
            scale=(0.9, 1.1),
        ),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
        transforms.RandomErasing(p=0.2, scale=(0.02, 0.15)),
    ])
    return TorchvisionTransformWrapper(raw_compose)


def get_val_transforms(img_size=(224, 224), **kwargs):
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
    return TorchvisionTransformWrapper(raw_compose)


# Aliases for cross-compatibility
get_breast_train_transforms = get_train_transforms
get_breast_val_transforms = get_val_transforms



