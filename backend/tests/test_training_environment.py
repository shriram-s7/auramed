"""
Automated Integration and Unit Tests for AuraMed Training Environment.
Tests shared clinical metrics, threshold calibration, export serialization,
visualization generators, domain architectures, and backend ModelLoader compatibility.
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
import numpy as np
import torch
import torch.nn as nn

# Add training and backend root to path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
TRAINING_DIR = os.path.join(PROJECT_ROOT, "training")
if TRAINING_DIR not in sys.path:
    sys.path.insert(0, TRAINING_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.ml.models.breast_model import load_breast_model
from app.ml.models.cervical_model import load_cervical_model
from app.ml.models.pcos_model import load_pcos_model

from shared.metrics import compute_clinical_metrics, find_optimal_threshold, print_clinical_report
from shared.export import export_model
from shared.visualize import (
    plot_calibration_curve,
    plot_confusion_matrix,
    plot_pr_curve,
    plot_roc_curve,
    plot_training_history,
)

from breast.train import BreastCancerModel
from breast.augmentations import get_breast_train_transforms, get_breast_val_transforms
from cervical.augmentations import get_cervical_train_transforms, get_cervical_val_transforms
from pcos.train import PCOSVisionModel
from pcos.augmentations import get_pcos_train_transforms, get_pcos_val_transforms


class TestTrainingEnvironment(unittest.TestCase):
    """Test suite validating all training modules and clinical metrics."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_clinical_metrics_computation(self):
        """Validates that compute_clinical_metrics accurately calculates all clinical values."""
        y_true = np.array([0, 0, 0, 0, 1, 1, 1, 1, 1, 1])
        y_pred = np.array([0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95])

        metrics = compute_clinical_metrics(y_true, y_pred, threshold=0.5)

        self.assertIn("auc_roc", metrics)
        self.assertIn("auc_pr", metrics)
        self.assertIn("sensitivity", metrics)
        self.assertIn("specificity", metrics)
        self.assertIn("ppv", metrics)
        self.assertIn("npv", metrics)
        self.assertIn("f1_score", metrics)
        self.assertIn("accuracy", metrics)
        self.assertIn("confusion_matrix", metrics)
        self.assertIn("threshold_analysis", metrics)

        # Perfect separation in this test case
        self.assertEqual(metrics["auc_roc"], 1.0)
        self.assertEqual(metrics["sensitivity"], 1.0)
        self.assertEqual(metrics["specificity"], 1.0)
        self.assertEqual(metrics["accuracy"], 1.0)
        self.assertEqual(len(metrics["threshold_analysis"]), 5)

    def test_find_optimal_threshold_prioritizing_sensitivity(self):
        """Validates threshold tuning ensuring >=90% sensitivity."""
        y_true = np.array([0, 0, 0, 0, 1, 1, 1, 1, 1, 1])
        y_pred = np.array([0.1, 0.2, 0.35, 0.45, 0.48, 0.65, 0.75, 0.82, 0.88, 0.92])

        optimal_th = find_optimal_threshold(y_true, y_pred, min_sensitivity=0.90)
        metrics = compute_clinical_metrics(y_true, y_pred, threshold=optimal_th)

        self.assertGreaterEqual(metrics["sensitivity"], 0.90)

    def test_print_clinical_report(self):
        """Verifies report formatting executes without error."""
        y_true = np.array([0, 0, 1, 1])
        y_pred = np.array([0.1, 0.2, 0.8, 0.9])
        metrics = compute_clinical_metrics(y_true, y_pred, threshold=0.5)
        # Should execute cleanly without raising
        print_clinical_report(metrics, model_name="Test Model", dataset_name="Synthetic Set")

    def test_model_export_and_metadata_serialization(self):
        """Validates that export_model correctly writes .pth and metadata .json."""
        dummy_model = nn.Sequential(nn.Linear(10, 2))
        dummy_metrics = {
            "auc_roc": 0.95,
            "sensitivity": 0.93,
            "specificity": 0.91,
            "threshold_used": 0.45,
            "confusion_matrix": [[50, 5], [4, 55]],
        }
        dummy_config = {
            "architecture": "TestLinearNet",
            "dataset": "TestDataset",
            "lr": 0.001,
            "optimal_threshold": 0.45,
        }

        result = export_model(
            dummy_model,
            "test_export_model",
            dummy_metrics,
            dummy_config,
            output_dir=self.temp_dir,
        )

        checkpoint_path = result["checkpoint_path"]
        metadata_path = result["metadata_path"]

        self.assertTrue(os.path.exists(checkpoint_path))
        self.assertTrue(os.path.exists(metadata_path))

        # Verify checkpoint dictionary content
        loaded_ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        self.assertIn("model_state_dict", loaded_ckpt)
        self.assertIn("metrics", loaded_ckpt)
        self.assertIn("config", loaded_ckpt)
        self.assertEqual(loaded_ckpt["optimal_threshold"], 0.45)

        # Verify JSON content
        with open(metadata_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        self.assertEqual(meta["model_name"], "test_export_model")
        self.assertEqual(meta["optimal_threshold"], 0.45)

    def test_visualization_generators(self):
        """Verifies ROC, PR, Confusion Matrix, and Calibration curve plots save properly."""
        y_true = np.array([0, 0, 0, 1, 1, 1])
        y_pred = np.array([0.1, 0.2, 0.3, 0.7, 0.8, 0.9])

        roc_path = os.path.join(self.temp_dir, "roc.png")
        pr_path = os.path.join(self.temp_dir, "pr.png")
        cm_path = os.path.join(self.temp_dir, "cm.png")
        cal_path = os.path.join(self.temp_dir, "cal.png")
        hist_path = os.path.join(self.temp_dir, "hist.png")

        plot_roc_curve(y_true, y_pred, 1.0, "Test Model", save_path=roc_path)
        plot_pr_curve(y_true, y_pred, 1.0, "Test Model", save_path=pr_path)
        plot_confusion_matrix([[3, 0], [0, 3]], ["Neg", "Pos"], "Test Model", save_path=cm_path)
        plot_calibration_curve(y_true, y_pred, "Test Model", n_bins=3, save_path=cal_path)
        plot_training_history(
            {"train_loss": [0.5, 0.3], "val_loss": [0.6, 0.4], "train_acc": [0.7, 0.9], "val_auc": [0.65, 0.88]},
            "Test Model",
            save_path=hist_path,
        )

        self.assertTrue(os.path.exists(roc_path))
        self.assertTrue(os.path.exists(pr_path))
        self.assertTrue(os.path.exists(cm_path))
        self.assertTrue(os.path.exists(cal_path))
        self.assertTrue(os.path.exists(hist_path))

    def test_breast_and_pcos_architectures_and_transforms(self):
        """Tests vision model forward passes and Albumentations pipelines."""
        # Transforms
        dummy_img = np.random.randint(0, 256, (256, 256, 3), dtype=np.uint8)
        b_train_tr = get_breast_train_transforms((224, 224))
        b_val_tr = get_breast_val_transforms((224, 224))
        out_tr = b_train_tr(image=dummy_img)["image"]
        out_val = b_val_tr(image=dummy_img)["image"]
        self.assertEqual(out_tr.shape, (3, 224, 224))
        self.assertEqual(out_val.shape, (3, 224, 224))

        # Breast Model forward pass
        breast_model = BreastCancerModel(pretrained=False)
        dummy_tensor = torch.randn(2, 3, 224, 224)
        breast_out = breast_model(dummy_tensor)
        self.assertEqual(breast_out.shape, (2, 1))

        # PCOS Model forward pass
        pcos_model = PCOSVisionModel(pretrained=False)
        pcos_out = pcos_model(dummy_tensor)
        self.assertEqual(pcos_out.shape, (2, 2))

    def test_backend_model_loaders_with_exported_training_weights(self):
        """Verifies that weights exported in training/weights/ can be loaded cleanly by backend ModelLoader."""
        weights_dir = os.path.join(TRAINING_DIR, "weights")
        breast_pth = os.path.join(weights_dir, "breast_model.pth")
        cervical_pth = os.path.join(weights_dir, "cervical_model.pth")
        pcos_pth = os.path.join(weights_dir, "pcos_model.pth")

        self.assertTrue(os.path.exists(breast_pth), f"Missing {breast_pth}")
        self.assertTrue(os.path.exists(cervical_pth), f"Missing {cervical_pth}")
        self.assertTrue(os.path.exists(pcos_pth), f"Missing {pcos_pth}")

        # Load into backend models
        breast_loaded = load_breast_model(breast_pth)
        cervical_loaded = load_cervical_model(cervical_pth)
        pcos_loaded = load_pcos_model(pcos_pth)

        self.assertIsNotNone(breast_loaded)
        self.assertIsNotNone(cervical_loaded)
        self.assertIsNotNone(pcos_loaded)

        dummy_input = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            b_pred = breast_loaded(dummy_input)
            c_pred = cervical_loaded(dummy_input)
            p_pred = pcos_loaded(dummy_input)

        self.assertEqual(b_pred.shape, (1, 1))
        self.assertEqual(c_pred.shape, (1, 5))
        self.assertEqual(p_pred.shape, (1, 2))


if __name__ == "__main__":
    unittest.main()
