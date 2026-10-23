"""Evaluate deployed preprocessing/checkpoints against an explicit, frozen manifest.

CSV: image_path,label,patient_id,split,source_kind. Paths are relative to the CSV.
This never trains, tunes thresholds, modifies weights, or publishes results.
"""
import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def validate_manifest(path, clinical=False):
    path = Path(path).resolve()
    with path.open(newline='', encoding='utf-8-sig') as stream:
        reader = csv.DictReader(stream)
        required = {'image_path', 'label', 'patient_id', 'split', 'source_kind'}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError('Manifest requires image_path,label,patient_id,split,source_kind')
        rows = list(reader)
    if not rows:
        raise ValueError('Manifest is empty')
    patient_splits, image_splits = {}, {}
    for row in rows:
        if not row['patient_id'].strip() or row['split'] not in ('train', 'validation', 'test'):
            raise ValueError('Every image needs a patient ID and train/validation/test split')
        if row['source_kind'] not in ('synthetic', 'real'):
            raise ValueError('source_kind must be synthetic or real')
        image = (path.parent / row['image_path']).resolve()
        if not image.is_file():
            raise ValueError('Manifest image is missing')
        if clinical and (row['source_kind'] != 'real' or 'synthetic' in str(image).lower()):
            raise ValueError('Synthetic data cannot be used for held-out clinical evaluation')
        digest = sha256(image)
        for registry, key in ((patient_splits, row['patient_id']), (image_splits, digest)):
            previous = registry.setdefault(key, row['split'])
            if previous != row['split']:
                raise ValueError('Patient or identical image crosses dataset splits')
        row['resolved_path'] = image
    if clinical and {r['split'] for r in rows} != {'train', 'validation', 'test'}:
        raise ValueError('Provide all three split manifests together to check leakage')
    if not any(r['split'] == 'test' for r in rows):
        raise ValueError('Manifest has no test split')
    return rows


def evaluate(args):
    import numpy as np
    import torch
    from PIL import Image
    from sklearn.metrics import confusion_matrix, accuracy_score, f1_score, roc_auc_score
    from app.ml.models.breast_model import load_breast_model, breast_transforms
    from app.ml.models.pcos_model import load_pcos_model, pcos_transforms
    from app.ml.models.cervical_model import load_cervical_model, cervical_transforms, CLASS_NAMES
    rows = validate_manifest(args.manifest, args.purpose == 'heldout')
    test = [r for r in rows if r['split'] == 'test']
    classes = CLASS_NAMES if args.module == 'cervical' else ['negative', 'positive']
    labels = [int(r['label']) for r in test]
    if any(label < 0 or label >= len(classes) for label in labels):
        raise ValueError('Labels do not match the deployed class ordering')
    if len(set(labels)) != len(classes):
        raise ValueError('Every class must be represented in the test set')
    torch.manual_seed(42)
    torch.set_num_threads(2)
    loader, transform = {'breast': (load_breast_model, breast_transforms),
                         'pcos': (load_pcos_model, pcos_transforms),
                         'cervical': (load_cervical_model, cervical_transforms)}[args.module]
    model = loader(str(args.weights))
    probabilities = []
    with torch.inference_mode():
        for row in test:
            with Image.open(row['resolved_path']) as image:
                output = model(transform(image.convert('RGB')).unsqueeze(0))[0]
            if args.module == 'breast':
                positive = float(torch.sigmoid(output).item())
                probabilities.append([1 - positive, positive])
            else:
                probabilities.append(torch.softmax(output, dim=0).tolist())
    probs = np.asarray(probabilities)
    y = np.asarray(labels)
    predicted = probs.argmax(axis=1) if len(classes) > 2 else (probs[:, 1] >= args.threshold).astype(int)
    matrix = confusion_matrix(y, predicted, labels=list(range(len(classes))))
    metrics = {'accuracy': float(accuracy_score(y, predicted)),
               'macro_f1': float(f1_score(y, predicted, average='macro', zero_division=0)),
               'confusion_matrix': matrix.tolist(),
               'brier_multiclass': float(np.mean(np.sum((probs - np.eye(len(classes))[y]) ** 2, axis=1)))}
    if len(classes) == 2:
        tn, fp, fn, tp = matrix.ravel()
        metrics.update(sensitivity=float(tp / (tp + fn)), specificity=float(tn / (tn + fp)),
                       roc_auc=float(roc_auc_score(y, probs[:, 1])),
                       brier_binary=float(np.mean((probs[:, 1] - y) ** 2)))
    bins = []
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == y
    for index in range(10):
        mask = (confidence >= index / 10) & ((confidence < (index + 1) / 10) if index < 9 else confidence <= 1)
        bins.append({'lower': index / 10, 'count': int(mask.sum()),
                     'mean_confidence': float(confidence[mask].mean()) if mask.any() else None,
                     'accuracy': float(correct[mask].mean()) if mask.any() else None})
    report = {'purpose': args.purpose, 'clinical_validation': False,
              'limitations': 'Smoke data may overlap training. Held-out checks rely on manifest provenance; independent clinical validation is still required.',
              'module': args.module, 'classes': classes, 'test_images': len(test),
              'test_patients': len({r['patient_id'] for r in test}),
              'source_kinds': sorted({r['source_kind'] for r in test}),
              'weight_sha256': sha256(args.weights), 'manifest_sha256': sha256(args.manifest),
              'threshold': args.threshold if len(classes) == 2 else 'argmax',
              'created_at': datetime.now(timezone.utc).isoformat(), 'metrics': metrics,
              'top_class_calibration_bins': bins}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'module': args.module, 'purpose': args.purpose, 'test_images': len(test),
                      'clinical_validation': False, 'output': str(args.output)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--module', required=True, choices=['breast', 'cervical', 'pcos'])
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--weights', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--purpose', required=True, choices=['smoke', 'heldout'])
    parser.add_argument('--threshold', type=float, default=.5, help='Predeclare; never select on test results')
    arguments = parser.parse_args()
    if not 0 < arguments.threshold < 1:
        parser.error('threshold must be between zero and one')
    evaluate(arguments)
