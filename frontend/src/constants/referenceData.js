// Enum display labels. These stay hardcoded on purpose — they are a property of
// the code's own enums, not data, so fetching them would be indirection for its
// own sake.
//
// The COUNTRIES and DEGREE_LEVELS lists that used to live here are gone: they were
// a stand-in for the missing GET /api/countries, and screens now read live data
// through hooks/useReferenceData.js. Keeping a duplicate list around is how the
// header strip and the filters drifted apart in the first place.

// Application.stage replaced the free-text primaryStatus. Declared in the order
// the Report screen shows its 8 tiles, so that screen can iterate this directly
// instead of restating the sequence.
export const APPLICATION_STAGES = [
  { value: 'PROFILE_ASSESSMENT', label: 'Profile Assessment' },
  { value: 'APPLICATION', label: 'Applications' },
  { value: 'CONDITIONAL_OFFER', label: 'Conditional Offers' },
  { value: 'UNCONDITIONAL_OFFER', label: 'Unconditional Offers' },
  { value: 'FEES_PAYMENT', label: 'Fees Payment' },
  { value: 'CAS_LETTER', label: 'CAS Letters' },
  { value: 'VISA_APPLICATION', label: 'Visa Application' },
  { value: 'VISA_APPROVAL', label: 'Visa Approval' },
];

export const COURSE_INQUIRY_STAGES = [
  { value: 'INQUIRY', label: 'Course Inquiry' },
  { value: 'PENDING', label: 'Pending Course' },
  { value: 'OFFERED', label: 'Offered Course' },
  { value: 'APPLIED', label: 'Applied Course' },
];

const labelLookup = (list) => Object.fromEntries(list.map((s) => [s.value, s.label]));
const APPLICATION_STAGE_LABELS = labelLookup(APPLICATION_STAGES);
const COURSE_INQUIRY_STAGE_LABELS = labelLookup(COURSE_INQUIRY_STAGES);

// Falls back to the raw enum value rather than rendering blank, so a stage added
// to the backend before the frontend still shows something intelligible.
export const applicationStageLabel = (stage) => APPLICATION_STAGE_LABELS[stage] ?? stage ?? '—';
export const courseInquiryStageLabel = (stage) => COURSE_INQUIRY_STAGE_LABELS[stage] ?? stage ?? '—';
