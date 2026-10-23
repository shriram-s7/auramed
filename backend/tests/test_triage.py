import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.triage import triage_scan


class TriageTests(unittest.TestCase):
    def case(self, **changes):
        return SimpleNamespace(**{**dict(image_model_score=.2, formula_score=.25, fusion_score=.23,
            confidence_score=.8, image_quality='good', risk_level='low', reasoning={},
            ai_suggestions={}, doctor_modifications={}), **changes})

    def test_routine_is_not_negative_diagnosis(self):
        result = triage_scan(self.case())
        self.assertEqual(result['queue'], 'routine')
        self.assertIn('does not mean', result['reason'])

    def test_missing_nan_and_invalid_scores_abstain(self):
        for value in (None, float('nan'), float('inf'), -1, 90, True):
            result = triage_scan(self.case(image_model_score=value))
            self.assertEqual(result['queue'], 'review')
            self.assertIsNone(result['scores']['image'])

    def test_low_confidence_quality_and_disagreement(self):
        for changes in ({'confidence_score': .3}, {'image_quality': 'poor'},
                        {'image_model_score': .85}, {'reasoning': {'disagreement_detected': True}}):
            self.assertEqual(triage_scan(self.case(**changes))['queue'], 'review')

    def test_elevated_flag_survives_uncertainty(self):
        result = triage_scan(self.case(risk_level='high', image_quality='poor'))
        self.assertEqual(result['queue'], 'review')
        self.assertTrue(result['elevated_flag'])

    def test_clinician_priority_preserves_original_reasons(self):
        result = triage_scan(self.case(image_quality='poor', doctor_modifications={
            'care_triage': {'queue': 'priority', 'note': 'Reviewed by clinician'}}))
        self.assertEqual(result['queue'], 'priority')
        self.assertEqual(result['suggested_queue'], 'review')
        self.assertIn('quality', result['reason'])

    def test_deterministic(self):
        self.assertEqual(triage_scan(self.case()), triage_scan(self.case()))


if __name__ == '__main__':
    unittest.main()
