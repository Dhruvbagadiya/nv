// Interim source for the country and degree-level dropdowns.
//
// These lists were previously inlined in CountryStrip.jsx, which meant the header
// strip offered 15 destinations while every <select> on every screen was an empty
// dropdown — the root cause of F-09 was simply that no /api/countries endpoint
// exists to populate them.
//
// The backend filters by country *code* (moiInstitutions.service.js does
// `country: { code }`), so these codes are the right currency and the filters work
// against them today. Phase 3 replaces this file with a `useCountries()` hook over
// GET /api/countries; until then this is one list instead of several.
//
// Note the seed currently creates only UK, CA, AU and NE, so the other 11 return
// empty results. That is a data gap closed by the Phase 2 seed rewrite, and the
// DataTable empty state now says so rather than rendering a blank card.
export const COUNTRIES = [
  { code: 'UK', name: 'United Kingdom' },
  { code: 'GR', name: 'Germany' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'FR', name: 'France' },
  { code: 'SP', name: 'Spain' },
  { code: 'UAE', name: 'United Arab Emirates' },
  { code: 'MT', name: 'Malta' },
  { code: 'IR', name: 'Ireland' },
  { code: 'AT', name: 'Austria' },
  { code: 'HU', name: 'Hungary' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'US', name: 'United States' },
  { code: 'NE', name: 'Netherlands' },
  { code: 'IL', name: 'Israel' },
];

// Kept in step with DEGREE_LEVELS in backend/prisma/seed.js — Course.degreeLevel
// and MoiAcceptance.courseType are free-text columns, so these strings have to
// match exactly for a filter to hit anything.
export const DEGREE_LEVELS = [
  "Master's Degree",
  'Postgraduate Certificate',
  "Bachelor's Degree",
];

export const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
export const DEGREE_LEVEL_OPTIONS = DEGREE_LEVELS.map((d) => ({ value: d, label: d }));

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
