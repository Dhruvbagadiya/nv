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

// The ProgramLevel enum the backend accepts. Was copy-pasted into CourseFinder
// and AdminCourses, and the two had already drifted: admin could save a course as
// OTHER, but the partner course finder's filter omitted that value, so those
// courses were unreachable through the Level filter.
export const PROGRAM_LEVELS = [
  { value: 'MASTERS_DEGREE', label: "Master's Degree" },
  { value: 'POST_GRADUATE_CERTIFICATE', label: 'Postgraduate Certificate' },
  { value: 'BACHELORS_DEGREE', label: "Bachelor's Degree" },
  { value: 'THREE_YEAR_BACHELORS', label: "3-Year Bachelor's" },
  { value: 'FOUR_YEAR_BACHELORS', label: "4-Year Bachelor's" },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'FOUNDATION', label: 'Foundation' },
  { value: 'OTHER', label: 'Other' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// CourseInquiry.intake is free text, so the only thing keeping the form and the
// history filter able to match each other is both generating their options from
// here. They previously did not: the form let you type anything while the filter
// offered three fixed labels, so a filter hit was mostly luck.
//
// The window reaches back as well as forward because inquiries outlive their
// intake — an intake that has already started must stay filterable.
export function intakeOptions(from = new Date(), monthsBack = 6, monthsForward = 24) {
  const out = [];
  const start = new Date(from.getFullYear(), from.getMonth() - monthsBack, 1);
  for (let i = 0; i <= monthsBack + monthsForward; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    out.push({ value: label, label });
  }
  return out;
}

// Nationality is free text in the API. This covers the applicant base a study
// abroad portal actually sees; anything missing can still be typed, because the
// nationality field allows a custom value.
export const NATIONALITIES = [
  'Indian', 'Pakistani', 'Bangladeshi', 'Sri Lankan', 'Nepali', 'Bhutanese', 'Maldivian',
  'Afghan', 'Chinese', 'Japanese', 'Korean', 'Vietnamese', 'Filipino', 'Indonesian',
  'Malaysian', 'Singaporean', 'Thai', 'Myanmar', 'Cambodian', 'Laotian', 'Mongolian',
  'Kazakh', 'Uzbek', 'Turkmen', 'Kyrgyz', 'Tajik',
  'Nigerian', 'Ghanaian', 'Kenyan', 'Ugandan', 'Tanzanian', 'Rwandan', 'Ethiopian',
  'Zimbabwean', 'Zambian', 'South African', 'Cameroonian', 'Ivorian', 'Senegalese',
  'Moroccan', 'Algerian', 'Tunisian', 'Egyptian', 'Sudanese', 'Somali', 'Mauritian',
  'Emirati', 'Saudi', 'Qatari', 'Kuwaiti', 'Bahraini', 'Omani', 'Jordanian', 'Lebanese',
  'Syrian', 'Iraqi', 'Iranian', 'Palestinian', 'Yemeni', 'Turkish', 'Israeli',
  'British', 'Irish', 'French', 'German', 'Italian', 'Spanish', 'Portuguese', 'Dutch',
  'Belgian', 'Swiss', 'Austrian', 'Polish', 'Czech', 'Slovak', 'Hungarian', 'Romanian',
  'Bulgarian', 'Greek', 'Croatian', 'Serbian', 'Albanian', 'Ukrainian', 'Russian',
  'Lithuanian', 'Latvian', 'Estonian', 'Swedish', 'Norwegian', 'Danish', 'Finnish',
  'American', 'Canadian', 'Mexican', 'Brazilian', 'Colombian', 'Argentine', 'Chilean',
  'Peruvian', 'Venezuelan', 'Ecuadorian', 'Jamaican', 'Trinidadian', 'Guyanese',
  'Australian', 'New Zealander', 'Fijian',
].map((n) => ({ value: n, label: n }));

const labelLookup = (list) => Object.fromEntries(list.map((s) => [s.value, s.label]));
const APPLICATION_STAGE_LABELS = labelLookup(APPLICATION_STAGES);
const COURSE_INQUIRY_STAGE_LABELS = labelLookup(COURSE_INQUIRY_STAGES);

// Falls back to the raw enum value rather than rendering blank, so a stage added
// to the backend before the frontend still shows something intelligible.
export const applicationStageLabel = (stage) => APPLICATION_STAGE_LABELS[stage] ?? stage ?? '—';
export const courseInquiryStageLabel = (stage) => COURSE_INQUIRY_STAGE_LABELS[stage] ?? stage ?? '—';
