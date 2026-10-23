"""One clinician-authored content contract for screen, release and PDF."""
from datetime import datetime, timezone
from xml.sax.saxutils import escape
import io


def review_of(scan):
    return (scan.doctor_modifications or {}).get('clinical_review') or {}


def report_content(scan, doctor):
    review = review_of(scan)
    patient = scan.patient
    info = {'name': patient.full_name, 'patient_id': patient.patient_code,
            'gender': patient.gender, 'date_of_scan': str(scan.scan_date or ''),
            'referring_physician': doctor.full_name, 'scan_type': scan.module.value.title() + ' assessment',
            'report_date': datetime.now(timezone.utc).date().isoformat()}
    summary = {'summary_text': review.get('assessment', ''), 'factors': []}
    findings = {'description': review.get('findings', ''), 'findings_bullets': [], 'image_labels': []}
    plan = {'recommendations_list': [review['plan']] if review.get('plan') else [], 'ai_insight_explanation': ''}
    return {'workflow_version': 1, 'review': review, 'patient_info': info, 'patient_information': info,
            'clinical_summary': summary, 'imaging_findings': findings,
            'ai_assessment': {'rows': []}, 'ai_and_clinical_assessment': {'rows': []},
            'risk_assessment': {'risk_level': 'unassigned', 'label': 'Clinician assessment',
                                'recommendation_sentence': review.get('plan', '')},
            'recommendations': plan, 'sections': {}, 'addendums': [],
            'options': {'include_images': False, 'include_ai_details': False, 'include_reference_ranges': False,
                        'include_disclaimers': True, 'include_rotterdam': False}}


def text_sections(report):
    content = report.content or {}
    # Historical reports must be reviewed using the new workflow before release.
    if content.get('workflow_version') != 1:
        return {'assessment': 'Historical report: clinician review required.', 'findings': '', 'plan': ''}
    summary = content.get('clinical_summary') or {}
    findings = content.get('imaging_findings') or {}
    recs = content.get('recommendations') or {}
    return {'assessment': summary.get('summary_text', '') if isinstance(summary, dict) else str(summary),
            'findings': findings.get('description', '') if isinstance(findings, dict) else str(findings),
            'plan': '\n'.join(recs.get('recommendations_list', [])) if isinstance(recs, dict) else str(recs)}


def clinical_pdf(report, scan, patient, doctor):
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    out = io.BytesIO()
    styles = getSampleStyleSheet()
    styles['Title'].textColor = colors.HexColor('#115e59')
    story = []
    def para(text, style='BodyText'):
        story.append(Paragraph(escape(str(text or 'Not recorded')).replace('\n', '<br/>'), styles[style]))
        story.append(Spacer(1, 10))
    para('AuraMed | Clinician report', 'Title')
    para(report.report_number)
    para(f'{patient.full_name} | {patient.patient_code} | Visit: {scan.scan_date or "Not recorded"}')
    para('Finalized' if report.signed_at else 'DRAFT - not finalized')
    values = text_sections(report)
    for title, key in [('Recorded findings', 'findings'), ('Doctor assessment', 'assessment'), ('Next steps', 'plan')]:
        para(title, 'Heading2'); para(values[key])
    for item in (report.content or {}).get('addendums', []):
        para('Addendum', 'Heading2')
        para(item.get('note') or item.get('addendum_text'))
        para(f'{item.get("doctor_name", "")} | {item.get("created_at", "")}')
    if report.signed_at:
        signer = report.signed_by_doctor or doctor
        para(f'Clinician sign-off: {signer.full_name} | Registration: {signer.registration_number}')
        para(f'Signed at {report.signed_at.isoformat()} UTC')
    para('This report records the clinician assessment and plan. Research model outputs are not a diagnosis.')
    SimpleDocTemplate(out, title=report.report_number, rightMargin=48, leftMargin=48).build(story)
    return out.getvalue()
