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
// All seventeen values of the database's ProgramLevel enum, in the order a
// prospectus reads: undergraduate, postgraduate, doctoral, then the sub-degree
// and preparatory awards.
//
// This was nine, while the database had seventeen and 4,907 live courses sat on
// one of the eight missing ones. Those courses could not be filtered in either
// catalogue, and opening one in the admin editor gave a <select> whose value
// matched no <option> -- so a doctorate could be saved back as a master's.
// The browser cannot import the Prisma enum, so parity is asserted by
// programLevels.test.js, which reads schema.prisma directly.
export const PROGRAM_LEVELS = [
  { value: 'BACHELORS_DEGREE', label: "Bachelor's Degree" },
  { value: 'THREE_YEAR_BACHELORS', label: "3-Year Bachelor's" },
  { value: 'FOUR_YEAR_BACHELORS', label: "4-Year Bachelor's" },
  { value: 'TOPUP_DEGREE', label: 'Top-up Degree' },
  { value: 'INTEGRATED_MASTERS', label: "Integrated Master's" },
  { value: 'MASTERS_DEGREE', label: "Master's Degree" },
  { value: 'POST_GRADUATE_CERTIFICATE', label: 'Postgraduate Certificate' },
  { value: 'POST_GRADUATE_DIPLOMA', label: 'Postgraduate Diploma' },
  { value: 'DOCTORAL_PHD', label: 'Doctorate / PhD' },
  { value: 'ADVANCED_DIPLOMA', label: 'Advanced Diploma' },
  { value: 'HIGHER_DIPLOMA', label: 'Higher Diploma' },
  { value: 'UNDERGRADUATE_DIPLOMA', label: 'Undergraduate Diploma' },
  { value: 'UNDERGRADUATE_CERTIFICATE', label: 'Undergraduate Certificate' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'FOUNDATION', label: 'Foundation' },
  { value: 'ENGLISH', label: 'English Language' },
  { value: 'SECONDARY_SCHOOL', label: 'Secondary School' },
  { value: 'NON_CREDENTIAL', label: 'Non-credential' },
  { value: 'OTHER', label: 'Other' },
];

/** Human label for a level, falling back to the raw value rather than blank. */
export const programLevelLabel = (value) =>
  PROGRAM_LEVELS.find((l) => l.value === value)?.label ?? value ?? '—';

/**
 * Levels matching a typed term — label, enum name, or a family word.
 *
 * Twenty options in a native <select> is a scroll, and the thing a person knows
 * is the word: "diploma", "bachelor", "PG". The same problem the document-type
 * list had, and the same answer.
 *
 * `group` is what makes searching one word useful. Typing "diploma" matches six
 * levels, and without a second line they are six near-identical rows — the
 * family tells them apart while you are still typing.
 */
const LEVEL_GROUP = {
  BACHELORS_DEGREE: 'Undergraduate',
  THREE_YEAR_BACHELORS: 'Undergraduate',
  FOUR_YEAR_BACHELORS: 'Undergraduate',
  TOPUP_DEGREE: 'Undergraduate',
  UNDERGRADUATE_DIPLOMA: 'Undergraduate',
  UNDERGRADUATE_CERTIFICATE: 'Undergraduate',
  INTEGRATED_MASTERS: 'Postgraduate',
  MASTERS_DEGREE: 'Postgraduate',
  POST_GRADUATE_CERTIFICATE: 'Postgraduate',
  POST_GRADUATE_DIPLOMA: 'Postgraduate',
  DOCTORAL_PHD: 'Postgraduate',
  ADVANCED_DIPLOMA: 'Diploma & certificate',
  HIGHER_DIPLOMA: 'Diploma & certificate',
  DIPLOMA: 'Diploma & certificate',
  CERTIFICATE: 'Diploma & certificate',
  FOUNDATION: 'Pathway',
  ENGLISH: 'Pathway',
  SECONDARY_SCHOOL: 'Pathway',
  NON_CREDENTIAL: 'Other',
  OTHER: 'Other',
};

/**
 * Abbreviations people actually type, which no substring of the label matches.
 * "PG" finds nothing in "Postgraduate Diploma" — the letters are there but not
 * together — and "UG" appears in no label at all.
 */
const LEVEL_ALIASES = {
  BACHELORS_DEGREE: 'ug undergrad bachelors ba bsc',
  THREE_YEAR_BACHELORS: 'ug undergrad',
  FOUR_YEAR_BACHELORS: 'ug undergrad',
  TOPUP_DEGREE: 'ug undergrad topup',
  UNDERGRADUATE_DIPLOMA: 'ug undergrad',
  UNDERGRADUATE_CERTIFICATE: 'ug undergrad',
  INTEGRATED_MASTERS: 'pg postgrad',
  MASTERS_DEGREE: 'pg postgrad masters ma msc mba',
  POST_GRADUATE_CERTIFICATE: 'pg postgrad pgc',
  POST_GRADUATE_DIPLOMA: 'pg postgrad pgd',
  DOCTORAL_PHD: 'pg postgrad phd doctorate',
  HIGHER_DIPLOMA: 'hnd',
  ENGLISH: 'ielts language elicos',
  SECONDARY_SCHOOL: 'high school',
};

export const PROGRAM_LEVEL_GROUP = LEVEL_GROUP;

export function searchProgramLevels(term) {
  const q = (term ?? '').trim().toLowerCase();
  const withGroup = PROGRAM_LEVELS.map((l) => ({ ...l, group: LEVEL_GROUP[l.value] ?? 'Other' }));
  if (!q) return withGroup;
  return withGroup.filter(
    (l) =>
      l.label.toLowerCase().includes(q) ||
      l.group.toLowerCase().includes(q) ||
      l.value.toLowerCase().replace(/_/g, ' ').includes(q) ||
      (LEVEL_ALIASES[l.value] ?? '').includes(q)
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// CourseInquiry.intake is free text, so the only thing keeping the form and the
// history filter able to match each other is both generating their labels from
// here. They previously did not: the form let you type anything while the filter
// offered three fixed labels, so a filter hit was mostly luck.
//
// The two lists are NOT the same window, though, which is the point of the pair
// of functions below.
export function intakeOptions(from = new Date(), monthsBack = 0, monthsForward = 24) {
  const out = [];
  const start = new Date(from.getFullYear(), from.getMonth() - monthsBack, 1);
  for (let i = 0; i <= monthsBack + monthsForward; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    out.push({ value: label, label });
  }
  return out;
}

// What the FORM offers: the current month forward. You cannot apply for an intake
// that has already gone, so offering one is just a way to file an inquiry nobody
// can act on. The current month is included because an intake starting this month
// may still be taking applications.
export const intakeChoices = (from = new Date()) => intakeOptions(from, 0, 24);

// What the history FILTER offers: the same labels, but reaching back as well,
// because inquiries outlive their intake. An intake that has already started must
// stay searchable or the rows recording it become unfilterable.
export const intakeFilters = (from = new Date()) => intakeOptions(from, 12, 24);

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
