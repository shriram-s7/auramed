"""Versioned, deterministic review routing; not a diagnostic or calibrated model."""
import math

VERSION = 'care-triage-1.0'


def probability(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) and 0 <= value <= 1 else None


def triage_scan(scan):
    image = probability(scan.image_model_score)
    clinical = probability(scan.formula_score)
    fused = probability(scan.fusion_score)
    confidence = probability(scan.confidence_score)
    risk = getattr(scan.risk_level, 'value', scan.risk_level) or 'unknown'
    reasoning = scan.reasoning or {}
    gap = abs(image - clinical) if image is not None and clinical is not None else None
    disagreement = bool(reasoning.get('disagreement_detected') or
                        (scan.ai_suggestions or {}).get('disagreement_detected') or
                        (gap is not None and gap > .30))
    reasons = []
    if scan.image_quality == 'poor':
        reasons.append('Technical image quality failed; repeat capture needs clinician review.')
    if image is None or clinical is None or fused is None:
        reasons.append('A model or clinical score is missing or invalid; do not infer a low-risk result.')
    if disagreement:
        reasons.append('Image and clinical inputs disagree; inspect both sources.')
    if confidence is None:
        reasons.append('Confidence evidence is unavailable.')
    elif confidence < .65:
        reasons.append('Heuristic confidence is below the review threshold (0.65).')
    if scan.image_quality not in ('good', 'adequate', 'excellent') and scan.image_quality != 'poor':
        reasons.append('Image quality is unconfirmed or limited.')
    category = 'review' if reasons else 'routine'
    # Elevated flags remain visible even when uncertainty routes a case to review.
    elevated = risk in ('high', 'critical')
    if elevated:
        reasons.append('Existing research risk flag is elevated; clinician prioritisation is required.')
        if category != 'review':
            category = 'priority'
    if not reasons:
        reasons.append('No routing exception detected. Routine review does not mean disease is excluded.')
    override = (scan.doctor_modifications or {}).get('care_triage') or {}
    effective = override.get('queue') if override.get('queue') in ('review', 'priority', 'routine') else category
    return {'queue': effective, 'suggested_queue': category, 'reason': reasons[0], 'reasons': reasons,
            'elevated_flag': elevated, 'version': VERSION, 'override': override or None,
            'scores': {'image': image, 'clinical': clinical, 'fusion': fused,
                       'confidence': confidence, 'disagreement_gap': round(gap, 4) if gap is not None else None},
            'sort_key': (0 if effective == 'priority' and override else 1 if effective == 'review' else 2 if effective == 'priority' else 3,
                         0 if scan.image_quality == 'poor' or disagreement else 1,
                         -(fused if fused is not None else 0), confidence if confidence is not None else -1)}
