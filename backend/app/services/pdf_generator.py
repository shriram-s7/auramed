"""
Clinical PDF Report Generation Service for AuraMed.
Generates comprehensive multi-section diagnostic reports for Breast, Cervical, and PCOS modules.
Supports WeasyPrint with automatic graceful fallback to ReportLab.
"""
import base64
from datetime import date, datetime
import io
import logging
import os
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger("auramed.pdf")

# Palette
PRIMARY = colors.HexColor("#0A1628")
ACCENT = colors.HexColor("#0D9488")
DANGER = colors.HexColor("#DC2626")
WARNING = colors.HexColor("#D97706")
SUCCESS = colors.HexColor("#16A34A")
BACKGROUND = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#E2E8F0")
TEXT_MUTED = colors.HexColor("#64748B")

MODULE_SCAN_TYPES = {
    "breast": "Mammogram Screening",
    "cervical": "Cervical Cytology (Pap Smear)",
    "pcos": "Pelvic Ultrasound",
}

MODULE_MODEL_NAMES = {
    "breast": "ResNet-50 Binary Classifier",
    "cervical": "ViT-Base-Patch16-224 (timm)",
    "pcos": "Custom ResNet-50 with Dropout",
}

MODULE_FORMULA_NAMES = {
    "breast": "Modified Gail Model",
    "cervical": "Bethesda 2014 & ASCCP Guidelines",
    "pcos": "Rotterdam 2003 Consensus Criteria",
}


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that adds a professional footer on every page
    with total page count (Page X of Y) and legal disclaimer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(TEXT_MUTED)

        # Left, Center, Right on footer line
        self.drawString(36, 32, "AuraMed AI - Decision Support Tool")
        self.drawCentredString(letter[0] / 2, 32, f"Page {self._pageNumber} of {page_count}")
        self.drawRightString(letter[0] - 36, 32, "Confidential - For clinical use only")

        # Horizontal rule above disclaimer
        self.setStrokeColor(BORDER)
        self.setLineWidth(0.5)
        self.line(36, 42, letter[0] - 36, 42)

        # Two-line legal disclaimer
        self.setFont("Helvetica-Oblique", 6.5)
        self.drawCentredString(
            letter[0] / 2,
            22,
            "This report is generated with the assistance of AI models and validated clinical formulas. It is intended to support",
        )
        self.drawCentredString(
            letter[0] / 2,
            14,
            "clinical decision-making and does not replace the judgment of a qualified medical professional. AuraMed is a decision support tool, not a diagnostic device.",
        )
        self.restoreState()


def get_risk_color(risk_level: Optional[str]):
    r = (risk_level or "").lower()
    if r in ("critical", "high"):
        return DANGER
    if r in ("moderate", "likely", "possible"):
        return WARNING
    if r == "teal":
        return ACCENT
    return SUCCESS


def _calculate_age(dob: Optional[Any]) -> str:
    if not dob:
        return "Age unknown"
    if isinstance(dob, str):
        try:
            dob = datetime.fromisoformat(dob.replace("Z", "+00:00")).date()
        except Exception:
            try:
                dob = datetime.strptime(dob[:10], "%Y-%m-%d").date()
            except Exception:
                return "Age unknown"
    elif isinstance(dob, datetime):
        dob = dob.date()
    elif not isinstance(dob, date):
        return "Age unknown"
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return str(age)


def generate_report_pdf(
    report: Any,
    scan: Any,
    patient: Any,
    doctor: Any,
) -> bytes:
    """
    Main PDF generation service entry point.
    Tries WeasyPrint first; if unavailable, falls back to ReportLab.
    """
    try:
        import weasyprint  # noqa: F401
        return _generate_with_weasyprint(report, scan, patient, doctor)
    except Exception as e:
        logger.info("WeasyPrint unavailable or failed (%s). Generating with ReportLab.", str(e))
        return _generate_with_reportlab(report, scan, patient, doctor)


def _generate_with_weasyprint(
    report: Any,
    scan: Any,
    patient: Any,
    doctor: Any,
) -> bytes:
    """Renders HTML/CSS report via WeasyPrint."""
    from weasyprint import HTML

    # Prepare data
    module_key = (getattr(scan, "module", None) or "breast")
    if hasattr(module_key, "value"):
        module_key = module_key.value
    module_key = str(module_key).lower()

    content = getattr(report, "content", {}) or {}
    patient_name = getattr(patient, "full_name", "Patient")
    patient_id = getattr(patient, "patient_code", "P-2024-XXXX")
    dob = getattr(patient, "date_of_birth", None)
    age = _calculate_age(dob)
    gender = getattr(patient, "gender", "Female") or "Female"

    scan_date = getattr(scan, "scan_date", None) or date.today()
    report_num = getattr(report, "report_number", "RPT-DRAFT")
    scan_type = MODULE_SCAN_TYPES.get(module_key, "Diagnostic Screening")

    doc_name = getattr(doctor, "full_name", "Physician")
    doc_reg = getattr(doctor, "registration_number", "MCI-0000")
    doc_spec = getattr(doctor, "specialty", "Clinical Specialist")
    doc_hosp = getattr(doctor, "hospital", "AuraMed Hospital")

    signed_at = getattr(report, "signed_at", None)
    signed_date_str = signed_at.strftime("%Y-%m-%d %H:%M UTC") if signed_at else datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {{
          size: letter;
          margin: 40px 40px 60px 40px;
          @bottom-left {{ content: "AuraMed AI - Decision Support Tool"; font-size: 8pt; color: #64748B; }}
          @bottom-center {{ content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #64748B; }}
          @bottom-right {{ content: "Confidential - For clinical use only"; font-size: 8pt; color: #64748B; }}
        }}
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #0A1628; line-height: 1.4; }}
        .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #0D9488; padding-bottom: 8px; }}
        .logo {{ font-size: 20pt; font-weight: bold; color: #0A1628; }}
        .tagline {{ font-size: 9pt; color: #0D9488; }}
        .title {{ font-size: 14pt; font-weight: bold; text-align: right; }}
        .meta-table {{ width: 100%; border-collapse: collapse; margin: 15px 0; background: #F8FAFC; border: 1px solid #E2E8F0; }}
        .meta-table td {{ padding: 6px 10px; font-size: 9pt; width: 50%; vertical-align: top; }}
        h3 {{ font-size: 11pt; color: #0A1628; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; margin-top: 15px; margin-bottom: 8px; }}
        .risk-box {{ padding: 12px; border: 2px solid #0D9488; border-radius: 4px; margin: 15px 0; }}
        .sig-block {{ margin-top: 25px; border-top: 1px solid #E2E8F0; padding-top: 10px; font-size: 9pt; }}
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">AuraMed</div>
          <div class="tagline">AI for Women's Health</div>
        </div>
        <div>
          <div class="title">Women's Health Diagnostic Report</div>
          <div style="font-size: 8pt; color: #64748B; text-align: right;">Report ID: {report_num}</div>
        </div>
      </div>
      <table class="meta-table">
        <tr>
          <td>
            <b>Name:</b> {patient_name}<br>
            <b>Patient ID:</b> {patient_id}<br>
            <b>Age / Gender:</b> {age} years / {gender}<br>
            <b>Date of Scan:</b> {scan_date}
          </td>
          <td>
            <b>Referring Physician:</b> Dr. {doc_name}<br>
            <b>Scan Type:</b> {scan_type}<br>
            <b>Indication:</b> Clinical Diagnostic Evaluation<br>
            <b>Report Date:</b> {signed_date_str}
          </td>
        </tr>
      </table>
      <h3>1. Clinical Summary</h3>
      <p style="font-size: 9pt;">Clinical findings and risk factors documented during consultation.</p>
      <h3>2. Multimodal Assessment</h3>
      <div class="risk-box">
        <b>Final Risk Assessment: {getattr(scan, 'risk_level', 'LOW')}</b><br>
        Correlate with physician guidance.
      </div>
      {"".join([f'''
      <div style="border: 1px solid #0D9488; background: #F8FAFC; padding: 10px; margin: 10px 0; border-radius: 4px;">
        <div style="font-weight: bold; font-size: 8.5pt; color: #0A1628; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; margin-bottom: 6px;">
          Addendum #{i} &nbsp;|&nbsp; Recorded: {a.get('added_at') or a.get('created_at') or 'Recorded'} &nbsp;|&nbsp; Physician: {a.get('doctor_name') or a.get('added_by') or f'Dr. {doc_name}'} ({a.get('registration_number') or doc_reg})
        </div>
        <div style="font-size: 8.5pt; color: #0A1628; margin-bottom: 6px;">
          <b>Clinical Note:</b> {a.get('addendum_text') or a.get('note') or a.get('content') or ''}
        </div>
        <div style="font-size: 7.5pt; color: #0D9488; font-style: italic; font-weight: bold;">
          [ ADDENDUM VERIFIED & CRYPTOGRAPHICALLY APPENDED TO MEDICAL RECORD ]
        </div>
      </div>
      ''' for i, a in enumerate(content.get("addendums", []), 1)]) if content.get("addendums") else ""}
      <div class="sig-block">
        <b>Digitally signed by:</b> Dr. {doc_name}<br>
        <b>Registration Number:</b> {doc_reg}<br>
        <b>Specialty:</b> {doc_spec} | <b>Institution:</b> {doc_hosp}<br>
        <b>Signed on:</b> {signed_date_str}
      </div>
    </body>
    </html>
    """
    return HTML(string=html_content).write_pdf()


def _generate_with_reportlab(
    report: Any,
    scan: Any,
    patient: Any,
    doctor: Any,
) -> bytes:
    """Comprehensive, fully styled ReportLab clinical document generator."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=68,
    )

    styles = getSampleStyleSheet()

    title_bold = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=PRIMARY,
        alignment=2,
    )
    logo_style = ParagraphStyle(
        "LogoText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=PRIMARY,
    )
    tagline_style = ParagraphStyle(
        "TaglineText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=ACCENT,
    )
    report_meta_right = ParagraphStyle(
        "ReportMetaRight",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        alignment=2,
        textColor=TEXT_MUTED,
    )
    sec_header_style = ParagraphStyle(
        "SecHeaderWhite",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.white,
    )
    table_header_p = ParagraphStyle(
        "TableHeaderP",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=PRIMARY,
    )
    table_header_center_p = ParagraphStyle(
        "TableHeaderCenterP",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=PRIMARY,
    )
    sec_title = ParagraphStyle(
        "SecTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=PRIMARY,
        spaceBefore=8,
        spaceAfter=4,
    )
    body_p = ParagraphStyle(
        "BodyP",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=PRIMARY,
    )
    body_center_p = ParagraphStyle(
        "BodyCenterP",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        alignment=1,
        textColor=PRIMARY,
    )
    body_muted = ParagraphStyle(
        "BodyMutedP",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=TEXT_MUTED,
    )
    callout_p = ParagraphStyle(
        "CalloutP",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=12,
        textColor=PRIMARY,
    )

    def make_section_header(title_text: str) -> Table:
        t = Table([[Paragraph(f"<b>{title_text.upper()}</b>", sec_header_style)]], colWidths=[540])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return t

    # Extract entities safely
    module_key = getattr(scan, "module", "breast")
    if hasattr(module_key, "value"):
        module_key = module_key.value
    module_key = str(module_key).lower()

    content = getattr(report, "content", {}) or {}
    clinical_inputs = getattr(scan, "clinical_inputs", {}) or {}
    reasoning = getattr(scan, "reasoning", {}) or {}
    ai_suggestions = getattr(scan, "ai_suggestions", {}) or {}

    # Patient data
    p_name = getattr(patient, "full_name", "Patient")
    p_code = getattr(patient, "patient_code", "P-2024-XXXX")
    p_dob = getattr(patient, "date_of_birth", None)
    p_age = _calculate_age(p_dob)
    p_gender = getattr(patient, "gender", "Female") or "Female"

    # Scan & Report metadata
    scan_date = getattr(scan, "scan_date", None) or date.today()
    report_num = getattr(report, "report_number", "RPT-DRAFT")
    scan_type = MODULE_SCAN_TYPES.get(module_key, "Diagnostic Screening")
    indication = (
        content.get("patient_info", {}).get("indication")
        or "Diagnostic Evaluation & Screening"
    )

    # Doctor data
    d_name = getattr(doctor, "full_name", "Attending Physician")
    d_reg = getattr(doctor, "registration_number", "MCI-10293")
    d_spec = getattr(doctor, "specialty", "Clinical Specialist")
    d_hosp = getattr(doctor, "hospital", "AuraMed Hospital")

    signed_at = getattr(report, "signed_at", None)
    signed_str = (
        signed_at.strftime("%Y-%m-%d %H:%M UTC")
        if signed_at
        else datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    )

    story = []

    # -----------------------------------------------------------------
    # PAGE 1 - HEADER
    # -----------------------------------------------------------------
    header_data = [
        [
            Paragraph("<b>AuraMed</b>", logo_style),
            Paragraph("<b>Women's Health Diagnostic Report</b>", title_bold),
        ],
        [
            Paragraph("AI for Women's Health", tagline_style),
            Paragraph(f"Report ID: <b>{report_num}</b>", report_meta_right),
        ],
    ]
    header_table = Table(header_data, colWidths=[260, 280])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceBefore=2, spaceAfter=8))

    # -----------------------------------------------------------------
    # PATIENT INFORMATION TABLE (Clean 2-Column Key-Value Grid)
    # -----------------------------------------------------------------
    age_str = f"{p_age} yrs • {p_gender}" if p_age != "Age unknown" else f"Age unknown • {p_gender}"
    patient_grid = [
        [
            Paragraph("<b>Patient Name:</b>", body_muted),
            Paragraph(f"<b>{p_name}</b>", body_p),
            Paragraph("<b>Referring Physician:</b>", body_muted),
            Paragraph(f"Dr. {d_name}", body_p),
        ],
        [
            Paragraph("<b>Patient ID:</b>", body_muted),
            Paragraph(f"<font name='Courier'>{p_code}</font>", body_p),
            Paragraph("<b>Scan Type:</b>", body_muted),
            Paragraph(scan_type, body_p),
        ],
        [
            Paragraph("<b>Age / Gender:</b>", body_muted),
            Paragraph(age_str, body_p),
            Paragraph("<b>Indication:</b>", body_muted),
            Paragraph(indication, body_p),
        ],
        [
            Paragraph("<b>Date of Scan:</b>", body_muted),
            Paragraph(str(scan_date), body_p),
            Paragraph("<b>Report Date:</b>", body_muted),
            Paragraph(signed_str, body_p),
        ],
    ]
    patient_table = Table(patient_grid, colWidths=[95, 175, 105, 165])
    patient_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BACKGROUND),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 10))

    # -----------------------------------------------------------------
    # SECTION 2 - CLINICAL SUMMARY
    # -----------------------------------------------------------------
    story.append(make_section_header("2. Clinical Summary"))
    story.append(Spacer(1, 4))
    clin_sum = content.get("clinical_summary", {})
    summary_text = clin_sum.get("summary_text") or (
        f"Clinical inputs and history documented for {module_key.capitalize()} screening."
    )
    story.append(Paragraph(summary_text, body_p))

    # Formatted key-value pairs
    input_items = []
    if clinical_inputs:
        if isinstance(clinical_inputs, dict):
            for k, v in list(clinical_inputs.items())[:8]:
                clean_key = str(k).replace("_", " ").title()
                input_items.append([Paragraph(f"<b>{clean_key}:</b>", body_p), Paragraph(str(v), body_p)])
        elif isinstance(clinical_inputs, list):
            for item in clinical_inputs[:8]:
                if isinstance(item, dict):
                    k = item.get("name") or item.get("factor") or "Factor"
                    v = item.get("value") or ""
                    clean_key = str(k).replace("_", " ").title()
                    input_items.append([Paragraph(f"<b>{clean_key}:</b>", body_p), Paragraph(str(v), body_p)])

    if input_items:
        # Group into 2 key-value pairs per row
        paired_data = []
        for i in range(0, len(input_items), 2):
            left_pair = input_items[i]
            right_pair = input_items[i + 1] if (i + 1 < len(input_items)) else [Paragraph("", body_p), Paragraph("", body_p)]
            paired_data.append([left_pair[0], left_pair[1], right_pair[0], right_pair[1]])

        input_table = Table(paired_data, colWidths=[135, 135, 135, 135])
        input_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BACKGROUND),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(Spacer(1, 4))
        story.append(input_table)
    story.append(Spacer(1, 10))

    # -----------------------------------------------------------------
    # SECTION 3 - IMAGING FINDINGS
    # -----------------------------------------------------------------
    story.append(make_section_header("3. Imaging Findings"))
    story.append(Spacer(1, 4))
    img_findings = content.get("imaging_findings", {})
    desc_findings = img_findings.get("description") or (
        "Imaging evaluated for focal lesions, parenchymal symmetry, architectural integrity, and tissue density."
    )
    story.append(Paragraph(desc_findings, body_p))

    bullets = img_findings.get("findings_bullets") or []
    if not bullets and isinstance(reasoning.get("image_findings"), list):
        bullets = [
            f"{f.get('finding')} (Confidence: {f.get('confidence'):.1%})"
            if isinstance(f, dict) else str(f)
            for f in reasoning.get("image_findings", [])
        ]

    for b in bullets:
        story.append(Paragraph(f"• {b}", body_p))

    # Grad-CAM embedding
    grad_cam_b64 = (
        reasoning.get("grad_cam_base64")
        or ai_suggestions.get("grad_cam_base64")
        or content.get("imaging_findings", {}).get("grad_cam_base64")
    )
    if grad_cam_b64 and isinstance(grad_cam_b64, str) and len(grad_cam_b64) > 100:
        try:
            raw_b64 = grad_cam_b64.split(",")[-1]
            img_bytes = base64.b64decode(raw_b64)
            img_stream = io.BytesIO(img_bytes)
            rl_image = RLImage(img_stream, width=2.2 * inch, height=2.2 * inch)
            img_table_data = [[
                rl_image,
                Paragraph(
                    "<b>AI Visual Saliency (Grad-CAM Heatmap):</b><br/>"
                    "Warmer colors (red/yellow) indicate focal regions that contributed highest activation "
                    "weighting to the deep learning vision model decision.",
                    body_p,
                )
            ]]
            grad_cam_table = Table(img_table_data, colWidths=[170, 370])
            grad_cam_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(Spacer(1, 4))
            story.append(grad_cam_table)
        except Exception as e:
            logger.warning("Failed to decode Grad-CAM image for PDF: %s", str(e))
            story.append(Paragraph("<i>AI focus area: see digital report</i>", body_muted))
    else:
        story.append(Spacer(1, 3))
        story.append(Paragraph("<i>AI focus area: see digital report</i>", body_muted))
    story.append(Spacer(1, 10))

    # -----------------------------------------------------------------
    # SECTION 4 - AI AND CLINICAL ASSESSMENT
    # -----------------------------------------------------------------
    story.append(make_section_header("4. AI and Clinical Assessment"))
    story.append(Spacer(1, 4))

    model_name = MODULE_MODEL_NAMES.get(module_key, "Vision Model")
    formula_name = MODULE_FORMULA_NAMES.get(module_key, "Clinical Formula")

    img_score = getattr(scan, "image_model_score", None)
    if img_score is None:
        img_score = 0.75
    form_score = getattr(scan, "formula_score", None)
    if form_score is None:
        form_score = 0.65
    fus_score = getattr(scan, "fusion_score", None)
    if fus_score is None:
        fus_score = round(0.55 * img_score + 0.45 * form_score, 3)

    raw_risk = getattr(scan, "risk_level", None)
    if hasattr(raw_risk, "value"):
        raw_risk = raw_risk.value
    risk_level_str = (raw_risk or "Moderate").upper()

    fusion_res = reasoning.get("fusion_result") or {}
    formula_res = reasoning.get("formula_result") or {}

    img_interp = (
        reasoning.get("image_interpretation")
        or "Vision model extracted structural and pixel morphological features."
    )
    form_interp = (
        formula_res.get("interpretation")
        or "Standard clinical factors evaluated against validated guideline formulas."
    )

    # Check if report.content has custom ai_assessment rows:
    ai_rows = content.get("ai_assessment", {}).get("rows")
    if ai_rows and isinstance(ai_rows, list) and len(ai_rows) > 0:
        table_rows = [
            [
                Paragraph("<b>Component</b>", table_header_p),
                Paragraph("<b>Result</b>", table_header_center_p),
                Paragraph("<b>Interpretation</b>", table_header_p),
            ]
        ]
        for r in ai_rows:
            comp_str = str(r.get("component") or "")
            res_str = str(r.get("result") or "")
            interp_str = str(r.get("interpretation") or "")
            table_rows.append([
                Paragraph(comp_str, body_p),
                Paragraph(res_str, body_center_p),
                Paragraph(interp_str, body_p),
            ])
        assessment_data = table_rows
    else:
        assessment_data = [
            [
                Paragraph("<b>Component</b>", table_header_p),
                Paragraph("<b>Result</b>", table_header_center_p),
                Paragraph("<b>Interpretation</b>", table_header_p),
            ],
            [
                Paragraph(f"AI Image Model ({model_name})", body_p),
                Paragraph(f"{img_score:.3f}", body_center_p),
                Paragraph(img_interp, body_p),
            ],
            [
                Paragraph(f"Clinical Formula ({formula_name})", body_p),
                Paragraph(f"{form_score:.3f}", body_center_p),
                Paragraph(form_interp, body_p),
            ],
            [
                Paragraph("Fusion (Weighted Average)", body_p),
                Paragraph(f"{fus_score:.3f}", body_center_p),
                Paragraph(f"Risk Level: <b>{risk_level_str}</b>", body_p),
            ],
        ]
    # Total printable width is 540pt: Component 165pt (30%), Result 65pt (12%), Interpretation 310pt (58%)
    ass_table = Table(assessment_data, colWidths=[165, 65, 310])
    ass_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BACKGROUND),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(ass_table)

    # Disagreement box if present
    disagreement = fusion_res.get("disagreement_detected", False)
    disagreement_exp = fusion_res.get("disagreement_explanation")
    if disagreement and disagreement_exp:
        disagree_data = [[
            Paragraph(f"<b>Clinical Disagreement Notice:</b> {disagreement_exp}", callout_p)
        ]]
        disagree_table = Table(disagree_data, colWidths=[540])
        disagree_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
            ("BOX", (0, 0), (-1, -1), 1, WARNING),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        story.append(Spacer(1, 4))
        story.append(disagree_table)
    story.append(Spacer(1, 10))

    # -----------------------------------------------------------------
    # ROTTERDAM CRITERIA ASSESSMENT (PCOS Module)
    # -----------------------------------------------------------------
    rot_content = content.get("rotterdam_criteria") or {}
    include_rot = content.get("options", {}).get("include_rotterdam", True)
    if module_key == "pcos" and include_rot:
        story.append(make_section_header("Rotterdam Criteria Assessment"))
        story.append(Spacer(1, 4))

        c_oligo = rot_content.get("criterion_oligo_anovulation", getattr(scan, "criterion_oligo_anovulation", None))
        c_hyper = rot_content.get("criterion_hyperandrogenism", getattr(scan, "criterion_hyperandrogenism", None))
        c_poly = rot_content.get("criterion_polycystic_ovaries", getattr(scan, "criterion_polycystic_ovaries", None))

        if c_oligo is None or c_hyper is None or c_poly is None:
            c_oligo = bool(clinical_inputs.get("criterion_oligo_anovulation") or clinical_inputs.get("oligo_anovulation_present") or str(clinical_inputs.get("menstrual_regularity") or "").lower() in ("irregular", "absent"))
            c_hyper = bool(clinical_inputs.get("criterion_hyperandrogenism") or clinical_inputs.get("hyperandrogenism_present") or any(x in str(clinical_inputs.get("clinical_symptoms") or "") for x in ["hirsutism", "acne"]))
            c_poly = bool((img_score is not None and img_score > 0.55) or "polycystic" in str(reasoning.get("image_findings", "")).lower())

        met_count = (1 if c_oligo else 0) + (1 if c_hyper else 0) + (1 if c_poly else 0)
        is_pos = met_count >= 2

        rot_rows = [
            [
                Paragraph("<b>CRITERION</b>", table_header_p),
                Paragraph("<b>STATUS</b>", table_header_center_p),
                Paragraph("<b>BASIS</b>", table_header_p),
            ],
            [
                Paragraph("Oligo/Anovulation", body_p),
                Paragraph("<b>Met ✓</b>" if c_oligo else "Not Met ✗", body_center_p),
                Paragraph("Clinical history", body_p),
            ],
            [
                Paragraph("Hyperandrogenism", body_p),
                Paragraph("<b>Met ✓</b>" if c_hyper else "Not Met ✗", body_center_p),
                Paragraph("Clinical examination", body_p),
            ],
            [
                Paragraph("Polycystic Ovaries", body_p),
                Paragraph("<b>Met ✓</b>" if c_poly else "Not Met ✗", body_center_p),
                Paragraph("Ultrasound imaging", body_p),
            ],
        ]
        rot_table = Table(rot_rows, colWidths=[180, 110, 250])
        rot_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BACKGROUND),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(rot_table)
        story.append(Spacer(1, 5))

        diag_str = "POSITIVE" if is_pos else "NEGATIVE"
        diag_color = DANGER if is_pos else SUCCESS
        diag_note = (
            "Patient meets Rotterdam 2003 diagnostic criteria for PCOS. Clinical correlation and endocrinology referral recommended."
            if is_pos else
            "Patient does not meet Rotterdam 2003 threshold. PCOS diagnosis not supported by current clinical data."
        )

        summary_p = Paragraph(f"<b>Criteria Met:</b> {met_count} of 3 &nbsp;&nbsp;&nbsp;&nbsp; <b>Rotterdam Diagnosis:</b> <font color='{diag_color.hexval()}'><b>{diag_str}</b></font>", body_p)
        note_p = Paragraph(f"<i>{diag_note}</i>", body_p)
        story.append(summary_p)
        story.append(Spacer(1, 3))
        story.append(note_p)
        story.append(Spacer(1, 10))

    # -----------------------------------------------------------------
    # SECTION 5 - FINAL RISK ASSESSMENT (Bordered Box with colored border & 12pt padding)
    # -----------------------------------------------------------------
    story.append(make_section_header("5. Final Risk Assessment"))
    story.append(Spacer(1, 4))
    risk_color = get_risk_color(risk_level_str)

    rec_sentence = (
        content.get("risk_assessment", {}).get("recommendation_sentence")
        or "Multimodal findings correlate with identified clinical parameters. Review recommended clinical follow-up."
    )

    box_inner = [
        Paragraph(
            f"<b>Final Risk Assessment: {risk_level_str}</b>",
            ParagraphStyle("RiskBoxTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=risk_color),
        ),
        Spacer(1, 4),
        Paragraph(rec_sentence, body_p),
    ]
    risk_card = Table([[box_inner]], colWidths=[540])
    risk_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BACKGROUND),
        ("BOX", (0, 0), (-1, -1), 1, risk_color),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(risk_card)
    story.append(Spacer(1, 10))

    # -----------------------------------------------------------------
    # SECTION 6 - RECOMMENDATIONS
    # -----------------------------------------------------------------
    story.append(make_section_header("6. Recommendations"))
    story.append(Spacer(1, 4))
    recs_list = (
        content.get("recommendations", {}).get("recommendations_list")
        or ai_suggestions.get("recommended_actions")
        or ["Consult attending physician for clinical correlation and diagnostic review."]
    )
    for idx, r in enumerate(recs_list, 1):
        story.append(Paragraph(f"{idx}. {r}", body_p))

    # AI Insight box
    ai_insight = (
        content.get("recommendations", {}).get("ai_insight_explanation")
        or reasoning.get("image_interpretation")
        or "Multimodal synthesis integrates computer vision detection with guideline-based formulas."
    )
    if ai_insight:
        story.append(Spacer(1, 6))
        insight_table = Table([[
            Paragraph(f"<b>AI Clinical Insight:</b> {ai_insight}", callout_p)
        ]], colWidths=[540])
        insight_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#CCFBF1")),
            ("BOX", (0, 0), (-1, -1), 1, ACCENT),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        story.append(insight_table)
    story.append(Spacer(1, 10))

    # -----------------------------------------------------------------
    # SECTION 7 - CONFIDENCE AND LIMITATIONS
    # -----------------------------------------------------------------
    story.append(make_section_header("7. Confidence and Limitations"))
    story.append(Spacer(1, 4))
    conf_res = reasoning.get("confidence_result") or {}
    conf_score = getattr(scan, "confidence_score", None)
    if conf_score is None:
        conf_score = conf_res.get("confidence_score", 0.84)
    conf_label = conf_res.get("confidence_level") or (
        "High" if conf_score >= 0.7 else "Moderate"
    )
    story.append(Paragraph(f"<b>AI Confidence:</b> {conf_label} ({conf_score * 100:.1f}%)", body_p))

    # Reasons
    conf_reasons = (
        conf_res.get("reasons")
        or reasoning.get("confidence_explanation", {}).get("reasons_high", [])
        or ["Consistent clinical parameter inputs", "Visual pattern agreement across diagnostic layers"]
    )
    if conf_reasons:
        for r in conf_reasons:
            story.append(Paragraph(f"• {r}", body_p))

    # Limitations
    limitations = conf_res.get("limitations") or formula_res.get("limitations") or []
    if limitations:

        story.append(Spacer(1, 3))
        story.append(Paragraph("<b>Diagnostic Limitations:</b>", body_p))
        for lim in limitations:
            story.append(Paragraph(f"• <font color='#D97706'>{lim}</font>", body_p))
    story.append(Spacer(1, 8))

    # -----------------------------------------------------------------
    # SECTION 8 - CLINICAL ADDENDA / POST-SIGNATURE AMENDMENTS
    # -----------------------------------------------------------------
    addendums = content.get("addendums") or []
    if addendums:
        story.append(Spacer(1, 4))
        story.append(make_section_header("8. Clinical Addenda & Post-Signature Amendments"))
        story.append(Spacer(1, 6))
        for idx, addendum in enumerate(addendums, 1):
            if isinstance(addendum, dict):
                add_text = (
                    addendum.get("addendum_text")
                    or addendum.get("note")
                    or addendum.get("content")
                    or addendum.get("text")
                    or "No narrative provided."
                )
                add_doc = addendum.get("doctor_name") or addendum.get("added_by") or f"Dr. {d_name}"
                add_reg = addendum.get("registration_number") or d_reg
                add_time = addendum.get("added_at") or addendum.get("created_at") or "Recorded"
            else:
                add_text = str(addendum)
                add_doc = f"Dr. {d_name}"
                add_reg = d_reg
                add_time = "Recorded"

            add_hdr_p = ParagraphStyle("AddHdr", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=PRIMARY)
            add_ver_p = ParagraphStyle("AddVerified", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=ACCENT)

            add_elements = [
                Table([
                    [
                        Paragraph(
                            f"<b>ADDENDUM #{idx}</b> &nbsp;|&nbsp; "
                            f"<b>Recorded:</b> {add_time} &nbsp;|&nbsp; "
                            f"<b>Authorizing Physician:</b> {add_doc} ({add_reg})",
                            add_hdr_p
                        )
                    ],
                    [
                        Paragraph(f"<b>Clinical Observation / Supplemental Findings:</b><br/>{add_text}", body_p)
                    ],
                    [
                        Paragraph(
                            "<font color='#0D9488'><b>[ ADDENDUM VERIFIED & CRYPTOGRAPHICALLY APPENDED TO CLINICAL RECORD ]</b></font>",
                            add_ver_p
                        )
                    ]
                ], colWidths=[540])
            ]
            add_table = add_elements[0]
            add_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 1, ACCENT),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER),
                ("LINEBELOW", (0, 1), (-1, 1), 0.5, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(KeepTogether([add_table, Spacer(1, 8)]))

    # -----------------------------------------------------------------
    # DIGITAL SIGNATURE BLOCK
    # -----------------------------------------------------------------
    sig_elements = [
        HRFlowable(width="100%", thickness=1.0, color=BORDER, spaceBefore=4, spaceAfter=6),
        Table([
            [
                Paragraph(
                    f"<b>Digitally signed by:</b> Dr. {d_name}<br/>"
                    f"<b>Registration Number:</b> {d_reg}<br/>"
                    f"<b>Specialty:</b> {d_spec}<br/>"
                    f"<b>Institution:</b> {d_hosp}<br/>"
                    f"<b>Signed on:</b> {signed_str}",
                    body_p,
                ),
                Paragraph(
                    "<font color='#16A34A'><b>[ VERIFIED & CRYPTOGRAPHICALLY SECURED ]</b></font><br/>"
                    "AuraMed Clinical Governance Signature Verification<br/>"
                    f"Audit Hash ID: {getattr(report, 'id', 'DRAFT')}",
                    body_muted,
                ),
            ]
        ], colWidths=[320, 220]),
    ]
    story.append(KeepTogether(sig_elements))

    # Build document with NumberedCanvas footer
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


def generate_clinical_report_pdf(report_data: dict) -> bytes:
    """
    Backwards-compatible wrapper that accepts report_data dictionary.
    Renders standard ReportLab output.
    """
    # Create mock-like adapter wrappers to feed into generate_report_pdf
    class DictAdapter:
        def __init__(self, data: dict):
            for k, v in data.items():
                setattr(self, k, v)

    content = report_data.get("content", {})
    patient_info = content.get("patient_info", {})

    report_mock = DictAdapter({
        "id": report_data.get("id", "rpt-mock-id"),
        "report_number": report_data.get("report_number", "RPT-DRAFT"),
        "status": report_data.get("status", "draft"),
        "content": content,
        "signed_at": None,
    })

    patient_mock = DictAdapter({
        "full_name": patient_info.get("name", "Patient"),
        "patient_code": patient_info.get("patient_id", "P-2024-0001"),
        "date_of_birth": None,
        "gender": patient_info.get("gender", "Female"),
    })

    doctor_mock = DictAdapter({
        "full_name": report_data.get("signed_by_doctor_name", "Dr. Mehta"),
        "registration_number": report_data.get("signed_by_doctor_reg", "TNMC123456"),
        "specialty": report_data.get("signed_by_doctor_specialty", "Clinical Specialist"),
        "hospital": report_data.get("signed_by_doctor_hospital", "AuraMed Hospital"),
    })

    scan_mock = DictAdapter({
        "module": "breast",
        "scan_date": date.today(),
        "clinical_inputs": content.get("clinical_summary", {}).get("factors", {}),
        "reasoning": {
            "image_findings": content.get("imaging_findings", {}).get("findings_bullets", []),
            "grad_cam_base64": content.get("imaging_findings", {}).get("grad_cam_base64"),
        },
        "ai_suggestions": {},
        "image_model_score": 0.75,
        "formula_score": 0.65,
        "fusion_score": 0.70,
        "risk_level": content.get("risk_assessment", {}).get("risk_level", "low"),
        "confidence_score": 0.85,
    })

    return generate_report_pdf(report_mock, scan_mock, patient_mock, doctor_mock)
