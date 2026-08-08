import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Derives a stable UUID from natural key parts so every re-run is idempotent.
function stableId(...parts) {
  const h = crypto.createHash('sha1').update(parts.join('|')).digest('hex');
  return [h.slice(0,8), h.slice(8,12), '5'+h.slice(13,16), '8'+h.slice(17,20), h.slice(20,32)].join('-');
}

// URL-safe slug: lowercase, collapse non-alphanumeric runs to hyphens, trim edges.
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// All 15 destinations from the header strip.
const COUNTRIES = [
  { code: 'UK',  name: 'United Kingdom',       flagEmoji: '🇬🇧', currencyCode: 'GBP' },
  { code: 'GR',  name: 'Germany',              flagEmoji: '🇩🇪', currencyCode: 'EUR' },
  { code: 'NZ',  name: 'New Zealand',          flagEmoji: '🇳🇿', currencyCode: 'NZD' },
  { code: 'FR',  name: 'France',               flagEmoji: '🇫🇷', currencyCode: 'EUR' },
  { code: 'SP',  name: 'Spain',                flagEmoji: '🇪🇸', currencyCode: 'EUR' },
  { code: 'UAE', name: 'United Arab Emirates', flagEmoji: '🇦🇪', currencyCode: 'AED' },
  { code: 'MT',  name: 'Malta',                flagEmoji: '🇲🇹', currencyCode: 'EUR' },
  { code: 'IR',  name: 'Ireland',              flagEmoji: '🇮🇪', currencyCode: 'EUR' },
  { code: 'AT',  name: 'Austria',              flagEmoji: '🇦🇹', currencyCode: 'EUR' },
  { code: 'HU',  name: 'Hungary',              flagEmoji: '🇭🇺', currencyCode: 'HUF' },
  { code: 'CA',  name: 'Canada',               flagEmoji: '🇨🇦', currencyCode: 'CAD' },
  { code: 'AU',  name: 'Australia',            flagEmoji: '🇦🇺', currencyCode: 'AUD' },
  { code: 'US',  name: 'United States',        flagEmoji: '🇺🇸', currencyCode: 'USD' },
  { code: 'NE',  name: 'Netherlands',          flagEmoji: '🇳🇱', currencyCode: 'EUR' },
  { code: 'IL',  name: 'Israel',               flagEmoji: '🇮🇱', currencyCode: 'ILS' },
];

// Institutions: name, country code, city, province, trending, blacklisted.
const INSTITUTIONS = [
  { name: 'University of Hertfordshire',       country: 'UK', city: 'Hatfield',          province: 'England',  trending: true },
  { name: 'Ulster University',                 country: 'UK', city: 'Belfast',            province: 'Northern Ireland', trending: true },
  { name: 'University of Greater Manchester',  country: 'UK', city: 'Manchester',         province: 'England' },
  { name: 'London Metropolitan University',    country: 'UK', city: 'London',             province: 'England' },
  { name: 'University of Leeds',               country: 'UK', city: 'Leeds',              province: 'England' },
  { name: 'Northumbria University',            country: 'UK', city: 'Newcastle upon Tyne',province: 'England' },
  { name: 'Oxford Brookes University',         country: 'UK', city: 'Oxford',             province: 'England' },
  { name: 'De Montfort University',            country: 'UK', city: 'Leicester',          province: 'England', trending: true },
  { name: 'Anglia Ruskin University',          country: 'UK', city: 'Cambridge',          province: 'England' },
  { name: 'Coventry University',               country: 'UK', city: 'Coventry',           province: 'England', blacklisted: true },
  { name: 'Griffith College',                  country: 'IR', city: 'Dublin',             province: 'Leinster', trending: true },
  { name: 'Atlantic Technological University', country: 'IR', city: 'Galway',             province: 'Connacht' },
  { name: 'University of Alberta',             country: 'CA', city: 'Edmonton',           province: 'Alberta',  trending: true },
  { name: 'International College of Manitoba', country: 'CA', city: 'Winnipeg',           province: 'Manitoba' },
  { name: 'RMIT University',                   country: 'AU', city: 'Melbourne',          province: 'Victoria', trending: true },
  { name: 'University of Canberra',            country: 'AU', city: 'Canberra',           province: 'ACT' },
  { name: 'Eastern Institute of Technology',   country: 'NZ', city: 'Napier',             province: "Hawke's Bay" },
  { name: 'UCOL Pathway',                      country: 'NZ', city: 'Palmerston North',   province: 'Manawatu-Whanganui' },
  { name: 'IB Hochschule',                     country: 'GR', city: 'Berlin',             province: 'Berlin' },
  { name: 'Lancaster University Leipzig',      country: 'GR', city: 'Leipzig',            province: 'Saxony',   trending: true },
  { name: 'Excelia Business School',           country: 'FR', city: 'La Rochelle',        province: 'Nouvelle-Aquitaine' },
  { name: 'ESAM Groupe IGENSIA',               country: 'FR', city: 'Paris',              province: 'Île-de-France' },
  { name: 'Tio Business School',               country: 'NE', city: 'Amsterdam',          province: 'North Holland' },
  { name: 'International Business School Budapest', country: 'HU', city: 'Budapest',      province: 'Central Hungary' },
];

// Course templates: each drives 1 course per institution.
// programLevel uses the Prisma enum key; minLength/maxLength are months.
const COURSE_TEMPLATES = [
  {
    title: 'Master of Science - Data Analytics',
    shortName: 'Data Analytics',
    programLevel: 'MASTERS_DEGREE',
    minLength: 12, maxLength: 24,
    tags: ['top_programs', 'popular_programs', 'high_job_availability', 'prime', 'fast_loa'],
    badges: ['Instant Offer'],
  },
  {
    title: 'MSc Computer Science and Artificial Intelligence',
    shortName: 'Computer Science and AI',
    programLevel: 'MASTERS_DEGREE',
    minLength: 12, maxLength: 12,
    tags: ['popular_programs', 'high_job_availability', 'prime', 'instant_offer', 'fast_loa'],
    badges: ['Instant Offer'],
  },
  {
    title: 'Graduate Certificate - Information Technology',
    shortName: 'Information Technology',
    programLevel: 'POST_GRADUATE_CERTIFICATE',
    minLength: 8, maxLength: 8,
    tags: ['popular_programs', 'high_job_availability', 'fast_loa', 'instant_submission'],
    badges: ['Instant Submission'],
  },
  {
    title: 'College Diploma - Early Childhood Education',
    shortName: 'Early Childhood Education',
    programLevel: 'DIPLOMA',
    minLength: 24, maxLength: 24,
    tags: ['popular_programs', 'high_job_availability', 'fast_loa', 'instant_submission', 'scholarships_available'],
    badges: ['Instant Submission'],
  },
  {
    title: 'Bachelor of Computer Science - General',
    shortName: 'Computer Science',
    programLevel: 'THREE_YEAR_BACHELORS',
    minLength: 36, maxLength: 36,
    tags: ['popular_programs', 'high_job_availability', 'prime', 'fast_loa', 'instant_offer', 'instant_submission', 'scholarships_available'],
    badges: ['Instant Offer', 'Instant Submission'],
  },
  {
    title: 'MBA (Project Management)',
    shortName: 'MBA Project Management',
    programLevel: 'MASTERS_DEGREE',
    minLength: 18, maxLength: 18,
    tags: ['top_programs', 'popular_programs', 'prime', 'incentive', 'fast_loa', 'loan_available'],
    badges: ['Instant Offer'],
  },
];

// Three intake slots per course — realistic future dates.
// Dates are strings; Prisma coerces them to DateTime.
const INTAKE_SETS = [
  [
    { startDate: '2027-01-01', openDate: '2026-06-01', submissionDeadline: '2026-10-15' },
    { startDate: '2027-05-01', openDate: '2026-10-01', submissionDeadline: '2027-02-15' },
    { startDate: '2027-09-01', openDate: null,          submissionDeadline: '2027-06-15' },
  ],
  [
    { startDate: '2027-01-01', openDate: '2026-07-01', submissionDeadline: '2026-11-01' },
    { startDate: '2027-09-01', openDate: null,          submissionDeadline: '2027-07-01' },
    { startDate: '2028-01-01', openDate: null,          submissionDeadline: '2027-11-01' },
  ],
  [
    { startDate: '2026-09-01', openDate: '2026-03-01', submissionDeadline: '2026-07-01' },
    { startDate: '2027-01-01', openDate: '2026-07-01', submissionDeadline: '2026-11-01' },
    { startDate: '2027-09-01', openDate: null,          submissionDeadline: '2027-07-01' },
  ],
];

// Structured commission data per institution.
// tiers = legacy display array; typed fields = new program API fields.
const COMMISSIONS = {
  'University of Hertfordshire': {
    tiers: [{ label: '1 - 5 Students', rate: '15%' }, { label: '6+ Students', rate: '17%' }],
    commissionType: 'percentage', rateFrom: 10.5, rateTo: 15, isTierAdjusted: true,
    maxNumberOfInstallments: 2, tuitionBasis: 'net',
  },
  'Ulster University': {
    tiers: [{ label: '1-5 students', rate: '15%' }, { label: '6+ students', rate: '17%' }],
    commissionType: 'percentage', rateFrom: 10.5, rateTo: 17, isTierAdjusted: true,
    maxNumberOfInstallments: 2, tuitionBasis: 'net',
  },
  'University of Greater Manchester': {
    tiers: [{ label: 'All students', rate: '7%' }],
    commissionType: 'percentage', rateTo: 7, isTierAdjusted: false, tuitionBasis: 'net',
  },
  'London Metropolitan University': {
    tiers: [{ label: 'All students', rate: '16%' }],
    commissionType: 'percentage', rateTo: 16, isTierAdjusted: false, tuitionBasis: 'net',
  },
  'University of Leeds': {
    tiers: [{ label: 'IFY/IY1', rate: '12%' }],
    commissionType: 'percentage', rateTo: 12, isTierAdjusted: false, tuitionBasis: 'net',
  },
  'Northumbria University': {
    tiers: [{ label: '1-5 students', rate: '15%' }, { label: '6+ students', rate: '17%' }],
    commissionType: 'percentage', rateFrom: 10.5, rateTo: 17, isTierAdjusted: true,
    maxNumberOfInstallments: 2, tuitionBasis: 'net',
  },
  'Griffith College': {
    tiers: [{ label: 'All students', rate: '13%' }],
    commissionType: 'percentage', rateTo: 13, isTierAdjusted: false, tuitionBasis: 'net',
  },
  'RMIT University': {
    tiers: [{ label: 'All students', rate: '14%' }],
    commissionType: 'fixed_amount', amountTo: 2000, isTierAdjusted: true,
    maxNumberOfInstallments: 2,
  },
};

const ENTRY_REQUIREMENTS = [
  {
    institution: 'Oxford Brookes University', level: 'PG',
    englishRequirement: 'IELTS - 6.5 overall no less than 6.0, IELTS waiver - 64% in class 12 English (CBSE & ICSE) - 75 to 80% (state board)',
    academicRequirement: '60% in Bachelors', offerTimeline: '48 to 72 hours',
    credibilityInterview: true, financialInformation: '1000 GBP but preferred to pay 3000 GBP',
  },
  {
    institution: 'Oxford Brookes University', level: 'UG',
    englishRequirement: 'IELTS - 6 overall no less than 5.5, IELTS waiver - 64% in class 12 English (CBSE & ICSE) - 75 to 80% (state board)',
    academicRequirement: '65 - 70% in class 12',
    offerTimeline: 'After submitting the required docs, request the admissions office for an unconditional offer letter. Takes 4 to 5 working days.',
    credibilityInterview: true, financialInformation: '1000 GBP but preferred to pay 3000 GBP',
  },
  {
    institution: 'University of Hertfordshire', level: 'PG',
    englishRequirement: 'IELTS 6.5 overall, no band below 5.5 | PTE 59/59 | TOEFL overall 73',
    academicRequirement: "Bachelor's degree, second class or above", offerTimeline: '1 Week',
    credibilityInterview: true, financialInformation: 'Full payment of 1 year',
  },
  {
    institution: 'University of Hertfordshire', level: 'UG',
    englishRequirement: 'IELTS 5.5/5.5 | PTE 59/59 | TOEFL: Overall 73 - L 16, R 17, W 17, S 19',
    academicRequirement: 'Foundation: 65% in Year X; 50% in Year XI; 40% in Year XII',
    offerTimeline: '1 Week', credibilityInterview: true, financialInformation: 'Full payment of 1 year',
  },
  {
    institution: 'Ulster University', level: 'PG',
    englishRequirement: 'UKVI: IELTS 5.0/4.5 | PTE 43/43',
    academicRequirement: "Bachelor's degree, graded 40%/pass", offerTimeline: '1 Week',
    credibilityInterview: true, financialInformation: 'Full Payment',
  },
  {
    institution: 'Northumbria University', level: 'UG',
    englishRequirement: 'IELTS 6.0 overall, no band below 5.5',
    academicRequirement: '60% in class 12', offerTimeline: '3 to 5 working days',
    credibilityInterview: false, financialInformation: 'Deposit of 4000 GBP',
  },
];

const DOCUMENTS = [
  ...['Bar Code Document','Saving Bank Cover Letter','FD Cover Letter','Loan Cover Letter',
      'Bank Statement','No Objection Letter','Translation Format','Parent Consent Letter (Under 18 Student)',
      'UKVI Approved TB Test Centres','UKVI New Bank List',
      ...['Austria','Canada','France','Germany','Hungary','Ireland','New Zealand','UK']
        .map(c => `List of documents for ${c}`)].map(t => ({ category: 'VISA_DOCUMENT', title: t })),
  ...['General Refund Form','Anglia Ruskin University Refund Form','University of Greenwich Refund Form',
      'Middlesex University Refund Form','Ulster University Refund Form']
        .map(t => ({ category: 'REFUND_FORM', title: t })),
  ...['Accounting and Financial Management MSc - Coventry University',
      'BA(Hons) Business Management - Leeds Beckett University','Banking and Finance MSc - Queen Mary University of London',
      'Biotechnology MSc - University of Greenwich','BSc Computer Science - Middlesex University London',
      'MSc Management and Marketing','Master in Supply Chain Management','MBA (Project Management)',
      'Diploma in IT Technical Support','Master of Science in Computing']
        .map(t => ({ category: 'SOP', title: t })),
  ...[1,2,3,4,5,6].map(n => ({ category: 'LOR', title: `LOR ${n}` })),
];

const SUPPORT_CONTACTS = [
  { name: 'Asha Menon',   phone: '+91 90000 00001' },
  { name: 'Rohit Verma',  phone: '+91 90000 00002' },
  { name: 'Neha Kapoor',  phone: '+91 90000 00003' },
  { name: 'Imran Sheikh', phone: '+91 90000 00004' },
  { name: 'Divya Raman',  phone: '+91 90000 00005' },
  { name: 'Sanjay Iyer',  phone: '+91 90000 00006' },
];

const ANNOUNCEMENTS = [
  {
    variant: 'DANGER',
    message: 'Please note that this list of universities is blacklisted. We do not accept any fake documents, and hence we request you to refrain from submitting any such documents for processing.',
    ctaLabel: 'Click for list', ctaUrl: '/admin/institutions?blacklisted=true', sortOrder: 0,
  },
  {
    variant: 'INFO',
    message: 'Declaration form is a Mandatory Document for Application',
    ctaLabel: 'Download Declaration Form', ctaUrl: '/documents/visa?search=Declaration', sortOrder: 1,
  },
];

const APPLICATION_STAGES = [
  'PROFILE_ASSESSMENT','PROFILE_ASSESSMENT','PROFILE_ASSESSMENT','APPLICATION','APPLICATION',
  'CONDITIONAL_OFFER','UNCONDITIONAL_OFFER','FEES_PAYMENT','CAS_LETTER','VISA_APPLICATION','VISA_APPROVAL',
];
const STAGE_NOTES = {
  PROFILE_ASSESSMENT: 'Profile Under Review',
  APPLICATION: 'New Application Started and Under Review',
  CONDITIONAL_OFFER: 'Conditional offer issued',
  UNCONDITIONAL_OFFER: 'Unconditional offer issued',
  FEES_PAYMENT: 'Awaiting tuition deposit',
  CAS_LETTER: 'CAS requested from the institution',
  VISA_APPLICATION: 'Visa application submitted',
  VISA_APPROVAL: 'Visa approved',
};

async function main() {
  console.log('Seeding…');

  // ---- countries ----
  const countries = {};
  for (const [i, c] of COUNTRIES.entries()) {
    const data = { ...c, sortOrder: i };
    countries[c.code] = await prisma.country.upsert({
      where: { code: c.code },
      update: data,
      create: { id: stableId('country', c.code), ...data },
    });
  }
  console.log(`  countries: ${Object.keys(countries).length}`);

  // ---- users ----
  const passwordHash = await bcrypt.hash('password123', 12);
  const mkUser = (email, name, role, parentAgentId = null) =>
    prisma.user.upsert({
      where: { email },
      update: { name, role, parentAgentId },
      create: { id: stableId('user', email), email, name, passwordHash, role, parentAgentId },
    });
  const superAdmin = await mkUser('super@example.com',    'Super Admin',    'SUPER_ADMIN');
  await mkUser('admin@example.com',    'Admin User',     'ADMIN');
  const agent    = await mkUser('agent@example.com',    'Darshan Limbani', 'AGENT');
  const subAgent = await mkUser('subagent@example.com', 'Priya Nair',      'AGENT', agent.id);
  console.log('  users: 4');

  // ---- institutions — now includes slug, city, province ----
  const institutions = {};
  for (const inst of INSTITUTIONS) {
    const slug = slugify(inst.name);
    const data = {
      name: inst.name,
      slug,
      countryId: countries[inst.country].id,
      city: inst.city ?? null,
      province: inst.province ?? null,
      isBlacklisted: Boolean(inst.blacklisted),
      isTrending: Boolean(inst.trending),
      logoUrl: null,
    };
    institutions[inst.name] = await prisma.institution.upsert({
      where: { id: stableId('institution', inst.name) },
      update: data,
      create: { id: stableId('institution', inst.name), ...data },
    });
  }
  console.log(`  institutions: ${Object.keys(institutions).length}`);

  // ---- courses + CourseIntake ----
  // Each institution gets one course per template (capped at 3 to keep seed fast).
  const courses = [];
  for (const [i, inst] of INSTITUTIONS.entries()) {
    for (const [j, tpl] of COURSE_TEMPLATES.slice(0, 3).entries()) {
      const key = `${inst.name}|${tpl.title}`;
      const courseId = stableId('course', key);
      const n = i * 3 + j;
      const tuitionFee = 9000 + (n % 12) * 750;
      const commissionRate = 0.14; // 14% for commissionAmount derivation
      const commissionAmount = Math.round(tuitionFee * commissionRate);

      // Build a unique slug: template slug + institution index to avoid collisions
      const baseSlug = slugify(tpl.title);
      const courseSlug = i === 0 ? baseSlug : `${baseSlug}-${i}`;

      const data = {
        institutionId: institutions[inst.name].id,
        title: tpl.title,
        shortName: tpl.shortName,
        slug: courseSlug,
        programLevel: tpl.programLevel,
        minLength: tpl.minLength,
        maxLength: tpl.maxLength,
        languageOfInstruction: 'eng',
        tuitionFee,
        applicationFee: n % 3 === 0 ? 0 : 100,
        commissionAmount,
        abAppCreationEnabled: true,
        successScoreIntent: 'positive',
        successScoreLabel: 'High',
        tags: [...tpl.tags, ...(n % 5 === 0 ? ['scholarships_available'] : [])],
        badges: tpl.badges,
      };

      await prisma.course.upsert({
        where: { id: courseId },
        update: data,
        create: { id: courseId, ...data },
      });

      // Delete existing intakes so we can recreate them cleanly on re-seed.
      await prisma.courseIntake.deleteMany({ where: { courseId } });

      const intakeSet = INTAKE_SETS[j % INTAKE_SETS.length];
      for (const intake of intakeSet) {
        await prisma.courseIntake.create({
          data: {
            courseId,
            startDate: new Date(intake.startDate),
            openDate: intake.openDate ? new Date(intake.openDate) : null,
            submissionDeadline: intake.submissionDeadline ? new Date(intake.submissionDeadline) : null,
            overallScore: null,
            scoreDetails: [],
          },
        });
      }

      courses.push({ id: courseId, ...data });
    }
  }
  console.log(`  courses: ${courses.length} (each with ${INTAKE_SETS[0].length} intakes)`);

  // ---- MOI acceptances ----
  const DEGREE_LEVELS_LEGACY = ["Master's Degree", 'Postgraduate Certificate'];
  let moi = 0;
  for (const inst of INSTITUTIONS.slice(0, 10)) {
    for (const level of DEGREE_LEVELS_LEGACY) {
      const key = `${inst.name}|${level}`;
      const data = { institutionId: institutions[inst.name].id, courseType: level, years: 3 + (moi % 3) };
      await prisma.moiAcceptance.upsert({
        where: { id: stableId('moi', key) },
        update: data,
        create: { id: stableId('moi', key), ...data },
      });
      moi++;
    }
  }
  console.log(`  MOI acceptances: ${moi}`);

  // ---- commissions — now includes typed fields ----
  for (const [name, c] of Object.entries(COMMISSIONS)) {
    const { tiers, commissionType, rateFrom, rateTo, amountFrom, amountTo,
            isTierAdjusted, maxNumberOfInstallments, tuitionBasis } = c;
    const data = {
      institutionId: institutions[name].id,
      tiers,
      commissionType: commissionType ?? null,
      rateFrom: rateFrom ?? null,
      rateTo: rateTo ?? null,
      amountFrom: amountFrom ?? null,
      amountTo: amountTo ?? null,
      isTierAdjusted: Boolean(isTierAdjusted),
      maxNumberOfInstallments: maxNumberOfInstallments ?? null,
      tuitionBasis: tuitionBasis ?? null,
    };
    await prisma.universityCommission.upsert({
      where: { institutionId: institutions[name].id },
      update: data,
      create: { id: stableId('commission', name), ...data },
    });
  }
  console.log(`  commissions: ${Object.keys(COMMISSIONS).length}`);

  // ---- entry requirements ----
  for (const req of ENTRY_REQUIREMENTS) {
    const { institution, ...rest } = req;
    const data = { institutionId: institutions[institution].id, ...rest };
    await prisma.entryRequirement.upsert({
      where: { institutionId_level: { institutionId: data.institutionId, level: data.level } },
      update: data,
      create: { id: stableId('entryreq', institution, req.level), ...data },
    });
  }
  console.log(`  entry requirements: ${ENTRY_REQUIREMENTS.length}`);

  // ---- important updates ----
  const updates = [
    { title: 'International College Portsmouth (ICP)',
      body: 'ICP has revised its January 2027 intake deadlines. Applications must be submitted with full documentation at least six weeks before the course start date.',
      country: 'UK', institution: null, daysAgo: 12, attachment: null },
    { title: 'University of Hertfordshire',
      body: 'Updated English language waiver criteria for state board students, effective immediately. See the attached circular for the revised percentage bands.',
      country: 'UK', institution: 'University of Hertfordshire', daysAgo: 20,
      attachment: '/files/updates/hertfordshire-english-waiver.pdf' },
    { title: 'RMIT University — March 2027 intake',
      body: 'RMIT has opened the March 2027 intake for all postgraduate business programmes. Credibility interviews are now mandatory for all applicants.',
      country: 'AU', institution: 'RMIT University', daysAgo: 4, attachment: null },
    { title: 'Griffith College scholarship round',
      body: 'A new merit scholarship round is open for September 2027 entry, worth up to 25% of first-year tuition.',
      country: 'IR', institution: 'Griffith College', daysAgo: 30,
      attachment: '/files/updates/griffith-scholarships.pdf' },
  ];
  for (const u of updates) {
    const data = {
      title: u.title, body: u.body,
      publishDate: new Date(Date.now() - u.daysAgo * 86400000),
      countryId: u.country ? countries[u.country].id : null,
      institutionId: u.institution ? institutions[u.institution].id : null,
      attachmentUrl: u.attachment,
    };
    await prisma.importantUpdate.upsert({
      where: { id: stableId('update', u.title) },
      update: data,
      create: { id: stableId('update', u.title), ...data },
    });
  }
  console.log(`  important updates: ${updates.length}`);

  // ---- documents ----
  for (const [i, doc] of DOCUMENTS.entries()) {
    const slug = slugify(doc.title);
    const data = {
      category: doc.category, title: doc.title,
      fileUrl: `/files/${doc.category.toLowerCase()}/${slug}.pdf`,
      sortOrder: i,
    };
    await prisma.document.upsert({
      where: { id: stableId('document', doc.category, doc.title) },
      update: data,
      create: { id: stableId('document', doc.category, doc.title), ...data },
    });
  }
  console.log(`  documents: ${DOCUMENTS.length}`);

  // ---- support contacts ----
  for (const [i, c] of SUPPORT_CONTACTS.entries()) {
    const data = { ...c, sortOrder: i };
    await prisma.supportContact.upsert({
      where: { id: stableId('support', c.name) },
      update: data,
      create: { id: stableId('support', c.name), ...data },
    });
  }
  console.log(`  support contacts: ${SUPPORT_CONTACTS.length}`);

  // ---- announcements ----
  for (const a of ANNOUNCEMENTS) {
    await prisma.announcement.upsert({
      where: { id: stableId('announcement', a.message.slice(0, 40)) },
      update: a,
      create: { id: stableId('announcement', a.message.slice(0, 40)), ...a },
    });
  }
  console.log(`  announcements: ${ANNOUNCEMENTS.length}`);

  // ---- useful information ----
  const useful = [
    { title: 'UKVI financial requirement', body: 'Maintenance funds must be held for 28 consecutive days, ending no more than 31 days before the visa application.', linkUrl: null },
    { title: 'Credibility interview preparation', body: 'Students should be able to explain their course choice, funding, and post-study plans in their own words.', linkUrl: null },
  ];
  for (const [i, u] of useful.entries()) {
    const data = { ...u, sortOrder: i };
    await prisma.usefulInformation.upsert({
      where: { id: stableId('useful', u.title) },
      update: data,
      create: { id: stableId('useful', u.title), ...data },
    });
  }
  console.log(`  useful information: ${useful.length}`);

  // ---- applications: one per stage so Report tiles are all non-zero ----
  const students = [
    'Aarav Sharma','Isha Patel','Rahul Nair','Meera Krishnan','Kabir Singh',
    'Ananya Rao','Vivaan Gupta','Diya Menon','Arjun Reddy','Saanvi Joshi','Dev Malhotra',
  ];
  const courseRecords = await prisma.course.findMany({ take: students.length * 2, orderBy: { createdAt: 'asc' } });
  for (const [i, student] of students.entries()) {
    const stage = APPLICATION_STAGES[i];
    const course = courseRecords[i * 2] ?? courseRecords[0];
    const key = `${student}|${course.id}`;
    const deadlineAt = i % 4 === 0 ? new Date(Date.now() + (i + 3) * 86400000) : null;
    const data = {
      agentId: i % 5 === 0 ? subAgent.id : agent.id,
      studentName: student,
      passportNo: `P${String(1000000 + i * 7919).slice(0, 7)}`,
      courseId: course.id,
      intakeLabel: ['January 2027','March 2027','September 2027'][i % 3],
      stage, stageNote: STAGE_NOTES[stage], deadlineAt,
    };
    await prisma.application.upsert({
      where: { id: stableId('application', key) },
      update: data,
      create: { id: stableId('application', key), ...data },
    });
  }
  console.log(`  applications: ${students.length}`);

  // ---- course inquiries across all four stages ----
  const inquiryStages = ['INQUIRY','INQUIRY','PENDING','PENDING','OFFERED','APPLIED'];
  for (const [i, stage] of inquiryStages.entries()) {
    const data = {
      agentId: agent.id,
      nationality: ['Indian','Nepali','Nigerian'][i % 3],
      countryId: countries[['UK','CA','AU','IR'][i % 4]].id,
      intake: ['Jan 2027','May 2027','Sep 2027'][i % 3],
      courseType: ['MASTERS_DEGREE','POST_GRADUATE_CERTIFICATE','DIPLOMA'][i % 3],
      stage,
    };
    await prisma.courseInquiry.upsert({
      where: { id: stableId('inquiry', `inquiry-${i}`) },
      update: data,
      create: { id: stableId('inquiry', `inquiry-${i}`), ...data },
    });
  }
  console.log(`  course inquiries: ${inquiryStages.length}`);

  // ---- notifications ----
  const apps = await prisma.application.findMany({
    where: { agentId: agent.id },
    include: { course: { include: { institution: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  for (const [i, app] of apps.entries()) {
    const kind = ['NEW_APPLICATION','INFO_QUERY','DOCUMENT_QUERY'][i % 3];
    const body = {
      NEW_APPLICATION: 'New Application Started and Under Review.',
      INFO_QUERY: 'Information Related Query - Dear Team, please share the documents and student details.',
      DOCUMENT_QUERY: 'Document Related Query - Hello Team, kindly share the documents for assessment.',
    }[kind];
    const data = {
      userId: agent.id, applicationId: app.id, kind,
      title: `POEC ID: ${app.reference} - ${app.course.institution.name} - ${app.intakeLabel}`,
      body,
      readAt: i < 2 ? null : new Date(Date.now() - i * 3600000),
    };
    await prisma.notification.upsert({
      where: { id: stableId('notification', app.id, kind) },
      update: data,
      create: { id: stableId('notification', app.id, kind), ...data },
    });
  }
  console.log(`  notifications: ${apps.length} (2 unread)`);

  console.log('\nSeed complete. Logins (all password123):');
  console.log('  agent@example.com     AGENT');
  console.log('  subagent@example.com  AGENT  (child of agent@example.com)');
  console.log('  admin@example.com     ADMIN');
  console.log(`  super@example.com     SUPER_ADMIN (${superAdmin.role})`);
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
