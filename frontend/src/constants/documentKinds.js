/**
 * Every document an international student application is commonly asked for.
 *
 * The picker started with eight, which covered a passport and a transcript and
 * left everything else as "Other" — and "Other" is where a list stops being able
 * to answer "which of my applications is missing a TB test?". That question is
 * the whole reason the column is an enum rather than free text, so the enum has
 * to be big enough to hold the real answer.
 *
 * Grouped because fifty options in one flat list is not a picker, it is a wall.
 * The group travels with each option so it stays visible while searching, when
 * the headings themselves are filtered away — "Transcript" matches four things
 * and the group is what tells them apart.
 *
 * The first eight values are the originals and MUST keep their names: rows in
 * production already carry them.
 */
export const DOCUMENT_KIND_GROUPS = [
  ['Identity and travel', [
    ['PASSPORT', 'Passport'],
    ['PASSPORT_PHOTO', 'Passport-size photograph'],
    ['NATIONAL_ID', 'National ID'],
    ['BIRTH_CERTIFICATE', 'Birth certificate'],
    ['PREVIOUS_VISA', 'Previous visa'],
    ['VISA_REFUSAL', 'Visa refusal letter'],
  ]],

  ['Academic', [
    ['TENTH_CERTIFICATE', '10th / secondary certificate'],
    ['TWELFTH_CERTIFICATE', '12th / higher secondary certificate'],
    ['BACHELORS_DEGREE', 'Bachelor’s degree certificate'],
    ['BACHELORS_TRANSCRIPT', 'Bachelor’s transcript'],
    ['MASTERS_DEGREE', 'Master’s degree certificate'],
    ['MASTERS_TRANSCRIPT', 'Master’s transcript'],
    ['DIPLOMA_CERTIFICATE', 'Diploma certificate'],
    ['ACADEMIC_TRANSCRIPT', 'Academic transcript'],
    ['BACKLOG_CERTIFICATE', 'Backlog certificate'],
    ['MEDIUM_OF_INSTRUCTION', 'Medium of instruction (MOI) letter'],
    ['GAP_JUSTIFICATION', 'Gap justification'],
  ]],

  ['English proficiency', [
    ['ENGLISH_TEST', 'English test result'],
    ['IELTS', 'IELTS'],
    ['PTE', 'PTE'],
    ['TOEFL', 'TOEFL'],
    ['DUOLINGO', 'Duolingo'],
  ]],

  ['Application', [
    ['STATEMENT_OF_PURPOSE', 'Statement of purpose'],
    ['LETTER_OF_RECOMMENDATION', 'Letter of recommendation'],
    ['CV_RESUME', 'CV / résumé'],
    ['PORTFOLIO', 'Portfolio'],
    ['RESEARCH_PROPOSAL', 'Research proposal'],
  ]],

  ['Work experience', [
    ['EXPERIENCE_LETTER', 'Experience letter'],
    ['PAYSLIP', 'Payslips'],
    ['INTERNSHIP_CERTIFICATE', 'Internship certificate'],
  ]],

  ['Financial', [
    ['FINANCIAL', 'Financial document'],
    ['BANK_STATEMENT', 'Bank statement'],
    ['BANK_BALANCE_CERTIFICATE', 'Bank balance certificate'],
    ['LOAN_SANCTION_LETTER', 'Loan sanction letter'],
    ['SPONSORSHIP_AFFIDAVIT', 'Sponsorship affidavit'],
    ['INCOME_TAX_RETURN', 'Income tax return'],
    ['FIXED_DEPOSIT', 'Fixed deposit receipt'],
    ['PROPERTY_VALUATION', 'Property valuation'],
    ['SCHOLARSHIP_LETTER', 'Scholarship letter'],
    ['FEE_RECEIPT', 'Tuition fee receipt'],
  ]],

  ['Offer and visa', [
    ['OFFER_LETTER', 'Offer letter'],
    ['CAS_LETTER', 'CAS letter'],
    ['CONFIRMATION_OF_ENROLMENT', 'Confirmation of enrolment'],
    ['DECLARATION_FORM', 'Declaration form'],
    ['TB_TEST', 'TB test certificate'],
    ['MEDICAL_REPORT', 'Medical report'],
    ['POLICE_CLEARANCE', 'Police clearance certificate'],
    ['ATAS_CERTIFICATE', 'ATAS certificate'],
    ['ACCOMMODATION_PROOF', 'Accommodation proof'],
    ['TRAVEL_INSURANCE', 'Travel insurance'],
    ['BIOMETRIC_APPOINTMENT', 'Biometric appointment'],
  ]],

  ['Other', [
    ['MARRIAGE_CERTIFICATE', 'Marriage certificate'],
    ['NAME_CHANGE_AFFIDAVIT', 'Name change affidavit'],
    ['OTHER', 'Other'],
  ]],
];

/** Flat, in group order, which is also the order the picker shows them in. */
export const DOCUMENT_KINDS = DOCUMENT_KIND_GROUPS.flatMap(([group, kinds]) =>
  kinds.map(([value, label]) => ({ value, label, group }))
);

export const DOCUMENT_KIND_LABEL = Object.fromEntries(
  DOCUMENT_KINDS.map((k) => [k.value, k.label])
);

/**
 * Search across the label AND the group, so "financial" finds the bank
 * statement and "bank" finds it too. Also matches the enum name, because an
 * admin reading a database export knows it as CAS_LETTER.
 */
export function searchDocumentKinds(term) {
  const q = term.trim().toLowerCase();
  if (!q) return DOCUMENT_KINDS;
  return DOCUMENT_KINDS.filter(
    (k) =>
      k.label.toLowerCase().includes(q) ||
      k.group.toLowerCase().includes(q) ||
      k.value.toLowerCase().replace(/_/g, ' ').includes(q)
  );
}
