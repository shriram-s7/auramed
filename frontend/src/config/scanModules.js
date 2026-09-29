export const SCAN_MODULES = {
  breast: {
    key: 'breast',
    label: 'Breast Cancer',
    subtitle: 'AI-assisted mammogram analysis fused with clinical risk factors to support breast cancer screening decisions.',
    accent: 'pink',
    acceptedFormats: 'DICOM, JPEG, PNG',
    multiView: true,
    viewOptions: ['R MLO', 'R CC', 'L MLO', 'L CC'],
    referenceTabs: [
      {
        key: 'normal',
        label: 'Normal',
        className: 'BI-RADS 1 (Normal)',
        images: [
          { label: 'Normal fatty tissue', description: 'Predominantly fatty breast tissue with no focal asymmetry or mass.', file: 'breast_ref_12.jpg' },
          { label: 'Normal glandular pattern', description: 'Symmetric glandular tissue, no architectural distortion.', file: 'breast_ref_13.jpg' },
        ],
      },
      {
        key: 'suspicious',
        label: 'Suspicious',
        className: 'BI-RADS 4 (Suspicious)',
        images: [
          { label: 'Irregular mass', description: 'Spiculated margin mass suggestive of malignancy, BI-RADS 4.', file: 'breast_ref_04.jpg' },
          { label: 'Architectural distortion', description: 'Focal distortion without a definable mass, warrants further work-up.', file: 'breast_ref_05.jpg' },
        ],
      },
      {
        key: 'high_risk',
        label: 'High Risk',
        className: 'BI-RADS 5 (High Risk)',
        images: [
          { label: 'Dense irregular mass', description: 'High-density mass with irregular, indistinct margins, BI-RADS 5.', file: 'breast_ref_00.jpg' },
          { label: 'Clustered microcalcifications', description: 'Fine pleomorphic calcifications in a linear/segmental distribution.', file: 'breast_ref_01.jpg' },
        ],
      },
    ],
    sections: [
      {
        title: 'Patient Information',
        fields: [
          { key: 'age', label: 'Age (years)', type: 'number', min: 18, max: 100, hint: 'Valid range: 18–100 years' },
          {
            key: 'menopausal_status',
            label: 'Menopausal Status',
            type: 'select',
            options: [
              { value: 'pre_menopausal', label: 'Pre-menopausal' },
              { value: 'post_menopausal', label: 'Post-menopausal' },
              { value: 'peri_menopausal', label: 'Peri-menopausal' },
            ],
          },
          {
            key: 'family_history',
            label: 'Family History of Breast Cancer',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'first_degree', label: 'First-degree relative' },
              { value: 'second_degree', label: 'Second-degree relative' },
              { value: 'multiple_relatives', label: 'Multiple relatives' },
            ],
          },
        ],
      },
      {
        title: 'Clinical Findings',
        fields: [
          {
            key: 'palpable_lump',
            label: 'Palpable Lump',
            type: 'select',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
          {
            key: 'lump_location',
            label: 'Lump Location',
            type: 'select',
            showIf: { field: 'palpable_lump', equals: 'yes' },
            options: [
              { value: 'upper_outer', label: 'Upper Outer' },
              { value: 'upper_inner', label: 'Upper Inner' },
              { value: 'lower_outer', label: 'Lower Outer' },
              { value: 'lower_inner', label: 'Lower Inner' },
              { value: 'central', label: 'Central' },
              { value: 'axillary_tail', label: 'Axillary tail' },
            ],
          },
          {
            key: 'lump_size_cm',
            label: 'Lump Size',
            type: 'number',
            min: 0.1,
            max: 20,
            step: 0.1,
            unit: 'cm',
            showIf: { field: 'palpable_lump', equals: 'yes' },
          },
          {
            key: 'nipple_discharge',
            label: 'Nipple Discharge',
            type: 'select',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
          {
            key: 'skin_changes',
            label: 'Skin Changes',
            type: 'select',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
          {
            key: 'previous_biopsy',
            label: 'Previous Biopsy',
            type: 'select',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
        ],
      },
      {
        title: 'Imaging Details',
        fields: [
          {
            key: 'mammogram_views',
            label: 'Mammogram Views Uploaded',
            type: 'multiselect',
            options: [
              { value: 'R MLO', label: 'R MLO' },
              { value: 'R CC', label: 'R CC' },
              { value: 'L MLO', label: 'L MLO' },
              { value: 'L CC', label: 'L CC' },
            ],
          },
          {
            key: 'image_quality',
            label: 'Image Quality',
            type: 'select',
            options: [
              { value: 'good', label: 'Good' },
              { value: 'adequate', label: 'Adequate' },
              { value: 'poor', label: 'Poor' },
            ],
          },
          { key: 'notes', label: 'Notes', type: 'textarea', required: false, maxLength: 500 },
        ],
      },
    ],
  },

  cervical: {
    key: 'cervical',
    label: 'Cervical Cancer',
    subtitle: 'AI-assisted cytology analysis combined with clinical and HPV history to support cervical cancer screening.',
    accent: 'purple',
    acceptedFormats: 'JPEG, PNG, TIFF',
    multiView: false,
    referenceTabs: [
      {
        key: 'normal',
        label: 'Normal Cytology',
        className: 'NILM (Normal)',
        images: [
          { label: 'Normal squamous cells', description: 'Mature squamous epithelial cells with regular nuclei.', file: 'cervical_normal_00.jpg' },
          { label: 'Normal transformation zone', description: 'Benign endocervical and squamous cell mix, no atypia.', file: 'cervical_normal_01.jpg' },
          { label: 'Normal cytology sample', description: 'Superficial-intermediate cells, transparent cytoplasm.', file: 'cervical_normal_02.jpg' },
          { label: 'Normal cytology sample', description: 'Small pyknotic nucleus, unremarkable background.', file: 'cervical_normal_03.jpg' },
        ],
      },
      {
        key: 'hsil',
        label: 'HSIL',
        className: 'HSIL',
        images: [
          { label: 'High-grade dysplasia', description: 'Cells with high nuclear-to-cytoplasmic ratio and irregular chromatin.', file: 'cervical_hsil_00.jpg' },
          { label: 'HSIL cell cluster', description: 'Crowded hyperchromatic cells consistent with high-grade lesion.', file: 'cervical_hsil_01.jpg' },
          { label: 'HSIL dyskeratotic cells', description: 'Hyperchromatic nucleus, irregular chromatin distribution.', file: 'cervical_hsil_02.jpg' },
          { label: 'HSIL dyskeratotic cells', description: 'High N/C ratio consistent with high-grade lesion.', file: 'cervical_hsil_03.jpg' },
        ],
      },
      {
        key: 'lsil',
        label: 'LSIL',
        className: 'LSIL',
        images: [
          { label: 'Low-grade dysplasia', description: 'Koilocytic changes with mild nuclear enlargement.', file: 'cervical_lsil_00.jpg' },
          { label: 'LSIL cell cluster', description: 'Mildly atypical squamous cells, low-grade lesion pattern.', file: 'cervical_lsil_01.jpg' },
          { label: 'LSIL koilocytotic cells', description: 'Perinuclear halo, HPV cytopathic effect.', file: 'cervical_lsil_02.jpg' },
          { label: 'LSIL koilocytotic cells', description: 'Binucleation with mild nuclear enlargement.', file: 'cervical_lsil_03.jpg' },
        ],
      },
    ],
    sections: [
      {
        title: 'Patient and Screening Information',
        fields: [
          { key: 'age', label: 'Age (years)', type: 'number', min: 18, max: 100, hint: 'Valid range: 18–100 years' },
          { key: 'last_screening_date', label: 'Date of Last Screening', type: 'date' },
          {
            key: 'screening_reason',
            label: 'Reason for Screening',
            type: 'select',
            options: [
              { value: 'routine', label: 'Routine' },
              { value: 'symptomatic', label: 'Symptomatic' },
              { value: 'follow_up', label: 'Follow-up' },
              { value: 'post_treatment', label: 'Post-treatment' },
            ],
          },
        ],
      },
      {
        title: 'Sample Details',
        fields: [
          {
            key: 'sample_type',
            label: 'Sample Type',
            type: 'select',
            options: [
              { value: 'pap_smear_conventional', label: 'Pap smear Conventional' },
              { value: 'liquid_based_cytology', label: 'Liquid-based cytology' },
            ],
          },
          {
            key: 'sample_adequacy',
            label: 'Sample Adequacy',
            type: 'select',
            options: [
              { value: 'satisfactory', label: 'Satisfactory' },
              { value: 'unsatisfactory', label: 'Unsatisfactory' },
            ],
          },
          {
            key: 'transformation_zone',
            label: 'Transformation Zone',
            type: 'select',
            options: [
              { value: 'present', label: 'Present' },
              { value: 'absent', label: 'Absent' },
              { value: 'not_evaluable', label: 'Not evaluable' },
            ],
          },
          { key: '__info_adequacy', type: 'info', text: 'Adequate samples significantly improve analysis accuracy.' },
        ],
      },
      {
        title: 'Clinical History',
        fields: [
          {
            key: 'hpv_status',
            label: 'HPV Status',
            type: 'select',
            options: [
              { value: 'positive', label: 'Positive' },
              { value: 'negative', label: 'Negative' },
              { value: 'unknown', label: 'Unknown' },
            ],
          },
          {
            key: 'history_abnormal_pap',
            label: 'History of Abnormal Pap',
            type: 'select',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
          {
            key: 'smoking_status',
            label: 'Smoking Status',
            type: 'select',
            options: [
              { value: 'non_smoker', label: 'Non-smoker' },
              { value: 'ex_smoker', label: 'Ex-smoker' },
              { value: 'current_smoker', label: 'Current smoker' },
            ],
          },
          {
            key: 'immunocompromised',
            label: 'Immunocompromised',
            type: 'select',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
          {
            key: 'symptoms',
            label: 'Symptoms if any',
            type: 'multiselect',
            options: [
              { value: 'none', label: 'None' },
              { value: 'bleeding', label: 'Bleeding' },
              { value: 'discharge', label: 'Discharge' },
              { value: 'pain', label: 'Pain' },
              { value: 'other', label: 'Other' },
            ],
          },
          { key: 'notes', label: 'Relevant Notes', type: 'textarea', required: false, maxLength: 500 },
        ],
      },
    ],
  },

  pcos: {
    key: 'pcos',
    label: 'PCOS',
    subtitle: 'AI-assisted ultrasound and hormonal panel analysis fused with Rotterdam-criteria clinical scoring for PCOS screening.',
    accent: 'teal',
    acceptedFormats: 'JPEG, PNG, DICOM',
    multiView: false,
    referenceTabs: [
      {
        key: 'normal',
        label: 'Normal Ovary',
        className: 'Normal Ovary',
        images: [
          { label: 'Normal ovarian morphology', description: 'Typical volume, few peripheral follicles.', file: 'pcos_normal_00.jpg' },
          { label: 'Normal follicular pattern', description: 'Even follicle distribution, no polycystic pattern.', file: 'pcos_normal_01.jpg' },
          { label: 'Normal ovary sample', description: '1-3 dominant follicles, homogeneous stroma.', file: 'pcos_normal_02.jpg' },
          { label: 'Normal ovary sample', description: 'Normal ovarian volume within age limits.', file: 'pcos_normal_03.jpg' },
        ],
      },
      {
        key: 'pcos_ovary',
        label: 'PCOS Ovary',
        className: 'Polycystic Ovary (PCOS)',
        images: [
          { label: 'Polycystic morphology', description: '"String of pearls" peripheral follicles, increased stromal volume.', file: 'pcos_pcos_00.jpg' },
          { label: 'Enlarged ovarian volume', description: 'Ovarian volume >10mL with ≥12 follicles 2-9mm.', file: 'pcos_pcos_01.jpg' },
          { label: 'PCOS follicular pattern', description: 'Peripheral follicle arrangement, hyperechoic stroma.', file: 'pcos_pcos_02.jpg' },
          { label: 'PCOS follicular pattern', description: '12+ peripheral follicles, increased stromal echogenicity.', file: 'pcos_pcos_03.jpg' },
        ],
      },
    ],
    sections: [
      {
        title: 'Rotterdam Diagnostic Criteria (Clinical History)',
        fields: [
          {
            key: 'criterion_oligo_anovulation',
            label: 'Oligo/Anovulation present',
            type: 'checkbox',
            hint: 'Patient reports irregular or absent periods',
            required: false,
          },
          {
            key: 'criterion_hyperandrogenism',
            label: 'Hyperandrogenism present',
            type: 'checkbox',
            hint: 'Elevated androgens, hirsutism, or acne observed',
            required: false,
          },
          {
            key: 'rotterdam_info_note',
            type: 'info',
            text: 'ⓘ Polycystic ovary criterion will be assessed from the uploaded ultrasound image by the AI model.',
          },
        ],
      },
      {
        title: 'Patient and Menstrual History',
        fields: [
          { key: 'age', label: 'Age (years)', type: 'number', min: 12, max: 55, hint: 'Valid range: 12–55 years' },
          {
            key: 'menstrual_regularity',
            label: 'Menstrual Cycle Regularity',
            type: 'select',
            options: [
              { value: 'regular', label: 'Regular' },
              { value: 'irregular', label: 'Irregular' },
              { value: 'absent', label: 'Absent' },
            ],
          },
          { key: 'cycle_length_days', label: 'Cycle Length', type: 'number', min: 21, max: 90, unit: 'days' },
          {
            key: 'irregular_duration',
            label: 'Duration of Irregular Cycles',
            type: 'select',
            showIf: { field: 'menstrual_regularity', in: ['irregular', 'absent'] },
            options: [
              { value: 'less_than_3_months', label: 'Less than 3 months' },
              { value: '3_6_months', label: '3-6 months' },
              { value: '6_12_months', label: '6-12 months' },
              { value: 'more_than_1_year', label: 'More than 1 year' },
            ],
          },
          {
            key: 'clinical_symptoms',
            label: 'Clinical Symptoms',
            type: 'checkboxes',
            options: [
              { value: 'hirsutism', label: 'Hirsutism' },
              { value: 'acne', label: 'Acne' },
              { value: 'weight_gain', label: 'Weight gain' },
              { value: 'hair_thinning', label: 'Hair thinning' },
              { value: 'infertility', label: 'Infertility' },
              { value: 'none', label: 'None' },
            ],
          },
        ],
      },
      {
        title: 'Hormonal and Laboratory Parameters',
        fields: [
          { key: 'amh_ng_ml', label: 'AMH', type: 'number', min: 0.5, max: 15.0, step: 0.1, unit: 'ng/mL', hint: 'Normal: 1.0–4.0 ng/mL (reproductive age)' },
          { key: 'lh_miu_ml', label: 'LH', type: 'number', min: 1.0, max: 30.0, step: 0.1, unit: 'mIU/mL', hint: 'Normal: 1.9–12.5 mIU/mL (follicular phase)' },
          { key: 'fsh_miu_ml', label: 'FSH', type: 'number', min: 1.0, max: 20.0, step: 0.1, unit: 'mIU/mL', hint: 'Normal: 3.5–12.5 mIU/mL (follicular phase)' },
          { key: 'lh_fsh_ratio', label: 'LH/FSH Ratio', type: 'computed', hint: 'Auto-calculated once LH and FSH are entered. Ratio ≥2 is suggestive of PCOS.' },
          { key: 'total_testosterone_ng_dl', label: 'Total Testosterone', type: 'number', min: 15, max: 70, step: 1, unit: 'ng/dL', hint: 'Normal: 15–70 ng/dL' },
          { key: 'prolactin_ng_ml', label: 'Prolactin', type: 'number', min: 5, max: 25, step: 0.5, unit: 'ng/mL', hint: 'Normal: 5–25 ng/mL' },
        ],
      },
      {
        title: 'Ultrasound Measurements — Left Ovary',
        fields: [
          { key: 'left_ovary_volume_ml', label: 'Left Ovarian Volume', type: 'number', min: 1, max: 20, step: 0.1, unit: 'mL' },
          { key: 'left_follicle_count', label: 'Left Follicle Count (2-9mm)', type: 'number', min: 0, max: 30 },
        ],
      },
      {
        title: 'Ultrasound Measurements — Right Ovary',
        fields: [
          { key: 'right_ovary_volume_ml', label: 'Right Ovarian Volume', type: 'number', min: 1, max: 20, step: 0.1, unit: 'mL' },
          { key: 'right_follicle_count', label: 'Right Follicle Count (2-9mm)', type: 'number', min: 0, max: 30 },
          { key: 'other_findings', label: 'Other Findings', type: 'textarea', required: false, maxLength: 500 },
        ],
      },
    ],
  },
}

export function getReferenceRanges(moduleKey) {
  const mod = SCAN_MODULES[moduleKey] || SCAN_MODULES.breast
  const rows = []
  if (!mod || !mod.sections) return rows
  for (const section of mod.sections) {
    for (const field of section.fields) {
      if (field.type === 'number' && (field.min !== undefined || field.max !== undefined)) {
        rows.push({
          key: field.key,
          label: field.label,
          range: `${field.min ?? '—'}–${field.max ?? '—'}${field.unit ? ` ${field.unit}` : ''}`,
        })
      }
    }
  }
  return rows
}
