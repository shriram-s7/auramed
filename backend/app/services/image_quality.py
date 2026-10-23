"""Technical upload checks only; these do not establish clinical image adequacy."""
import numpy as np
from PIL import Image


def technical_quality(image):
    if min(image.size) < 100:
        return {"status": "repeat_recommended", "reason": "Image is too small (minimum 100 pixels per side)."}
    gray = np.asarray(image.convert('L').resize((256, 256)), dtype=np.float32)
    if gray.mean() < 20 or gray.mean() > 235:
        return {"status": "repeat_recommended", "reason": "Image has extreme brightness or darkness."}
    laplace = gray[1:-1, :-2] + gray[1:-1, 2:] + gray[:-2, 1:-1] + gray[2:, 1:-1] - 4 * gray[1:-1, 1:-1]
    if gray.std() < 3 or float(laplace.var()) < 2:
        return {"status": "repeat_recommended", "reason": "Very low detail or possible blur. Review the original image before re-uploading."}
    return {"status": "passed", "reason": "Basic technical checks passed; clinical adequacy still requires clinician review."}
