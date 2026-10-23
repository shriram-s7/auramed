import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ml.models import breast_model, cervical_model, pcos_model

class ModelLoadingSafetyTests(unittest.TestCase):
    def variants(self):
        return [(breast_model, 'BreastCancerModel', breast_model.load_breast_model),
                (pcos_model, 'PCOSVisionModel', pcos_model.load_pcos_model),
                (cervical_model, 'timm.create_model', cervical_model.load_cervical_model)]

    def test_missing_weights_never_produce_predictions(self):
        for module, constructor, load in self.variants():
            with self.subTest(module=module.__name__), patch(module.__name__ + '.' + constructor), patch.object(module.os.path, 'isfile', return_value=False):
                with self.assertRaises(FileNotFoundError):
                    load('missing.pth')

    def test_invalid_weights_fail_closed(self):
        for module, constructor, load in self.variants():
            model = Mock()
            model.load_state_dict.side_effect = RuntimeError('Mismatched trained head')
            with self.subTest(module=module.__name__), patch(module.__name__ + '.' + constructor, return_value=model), patch.object(module.os.path, 'isfile', return_value=True), patch.object(module.torch, 'load', return_value={}):
                with self.assertRaises(RuntimeError):
                    load('bad.pth')
                model.eval.assert_not_called()

if __name__ == '__main__':
    unittest.main()
