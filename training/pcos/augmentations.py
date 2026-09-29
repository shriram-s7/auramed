"""
Pelvic Ultrasound Image Augmentations for PCOS Screening.
Tailored for ultrasound acoustic artifacts, transducer orientation shifts,
gain/contrast adjustments, speckle noise, and acoustic shadowing.
Provides dual invocation support for both Torchvision and Albumentations formats.
"""
from typing import Any, Dict, Optional, Tuple, Union

import numpy as np
import torch
from PIL import Image
from torchvision import transforms


class TorchvisionUltrasoundWrapper:
    """
    Wraps Torchvision Compose transform pipeline to support both:
      1. torchvision calling: transform(pil_img) -> Tensor
      2. albumentations calling: transform(image=np_arr) -> {"image": Tensor}
    """
    def __init__(self, compose_transform: transforms.Compose):
        self.transform = compose_transform

    def __call__(self, img: Optional[Union[Image.Image, np.ndarray, torch.Tensor]] = None, **kwargs) -> Any:
        # Check kwargs for albumentations calling convention: transform(image=arr)
        if "image" in kwargs:
            input_val = kwargs["image"]
            if isinstance(input_val, np.ndarray):
                pil_img = Image.fromarray(input_val).convert("RGB")
            elif isinstance(input_val, Image.Image):
                pil_img = input_val.convert("RGB")
            else:
                pil_img = transforms.ToPILImage()(input_val)
            tensor_res = self.transform(pil_img)
            return {"image": tensor_res}

        if img is None:
            raise ValueError("No image passed to transform")

        if isinstance(img, np.ndarray):
            pil_img = Image.fromarray(img).convert("RGB")
        elif isinstance(img, Image.Image):
            pil_img = img.convert("RGB")
        elif isinstance(img, torch.Tensor):
            pil_img = transforms.ToPILImage()(img)
        else:
            raise TypeError(f"Unsupported image type for transform: {type(img)}")

        return self.transform(pil_img)


def get_pcos_train_transforms(
    img_size: Tuple[int, int] = (224, 224),
    mean: Tuple[float, float, float] = (0.485, 0.456, 0.406),
    std: Tuple[float, float, float] = (0.229, 0.224, 0.225),
) -> TorchvisionUltrasoundWrapper:
    """
    Ultrasound-specific training transforms:
      - Resize to 256x256 -> RandomCrop to 224x224
      - RandomHorizontalFlip(p=0.5) (bilateral ovarian mirroring)
      - RandomVerticalFlip(p=0.3)
      - RandomRotation(degrees=20)
      - ColorJitter(brightness=0.3, contrast=0.4) (ultrasound machine gain & dynamic range variation)
      - GaussianBlur(kernel_size=3, p=0.3) (ultrasound speckle and acoustic noise)
      - RandomAffine(degrees=0, translate=(0.1, 0.1)) (probe repositioning)
      - ToTensor() -> Normalize(ImageNet) -> RandomErasing(p=0.15)
    """
    tv_compose = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomCrop(img_size),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.3),
        transforms.RandomRotation(degrees=20),
        transforms.ColorJitter(brightness=0.3, contrast=0.4),
        transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0))], p=0.3),
        transforms.RandomAffine(degrees=0, translate=(0.1, 0.1)),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.15), value="random"),
    ])
    return TorchvisionUltrasoundWrapper(tv_compose)


def get_pcos_val_transforms(
    img_size: Tuple[int, int] = (224, 224),
    mean: Tuple[float, float, float] = (0.485, 0.456, 0.406),
    std: Tuple[float, float, float] = (0.229, 0.224, 0.225),
) -> TorchvisionUltrasoundWrapper:
    """
    Deterministic validation and inference transforms for pelvic ultrasound images.
    """
    tv_compose = transforms.Compose([
        transforms.Resize(img_size),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
    ])
    return TorchvisionUltrasoundWrapper(tv_compose)
