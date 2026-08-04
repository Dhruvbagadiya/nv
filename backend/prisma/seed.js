import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// The previous seed created institutions, courses and applications with bare
// `create` calls, so every re-run duplicated the entire catalogue. Deriving a
// stable UUID from a natural key instead makes every write an upsert and the
// whole script idempotent — run it as often as you like.
function stableId(...parts) {
  const h = crypto.createHash('sha1').update(parts.join('|')).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '5' + h.slice(13, 16), '8' + h.slice(17, 20), h.slice(20, 32)].join('-');
}

// All 15 destinations from the header strip. Only 4 existed before, so 11 chips
// silently returned nothing. Currency lives here because tuition in one country
// is not quoted in two currencies — and hardcoding "CAD" on the card was wrong
// for every UK course.
const COUNTRIES = [
  { code: 'UK', name: 'United Kingdom', flagEmoji: '🇬🇧', currencyCode: 'GBP' },
  { code: 'GR', name: 'Germany', flagEmoji: '🇩🇪', currencyCode: 'EUR' },
  { code: 'NZ', name: 'New Zealand', flagEmoji: '🇳🇿', currencyCode: 'NZD' },
  { code: 'FR', name: 'France', flagEmoji: '🇫🇷', currencyCode: 'EUR' },
  { code: 'SP', name: 'Spain', flagEmoji: '🇪🇸', currencyCode: 'EUR' },
  { code: 'UAE', name: 'United Arab Emirates', flagEmoji: '🇦🇪', currencyCode: 'AED' },
  { code: 'MT', name: 'Malta', flagEmoji: '🇲🇹', currencyCode: 'EUR' },
  { code: 'IR', name: 'Ireland', flagEmoji: '🇮🇪', currencyCode: 'EUR' },
  { code: 'AT', name: 'Austria', flagEmoji: '🇦🇹', currencyCode: 'EUR' },
  { code: 'HU', name: 'Hungary', flagEmoji: '🇭🇺', currencyCode: 'HUF' },
  { code: 'CA', name: 'Canada', flagEmoji: '🇨🇦', currencyCode: 'CAD' },
  { code: 'AU', name: 'Australia', flagEmoji: '🇦🇺', currencyCode: 'AUD' },
  { code: 'US', name: 'United States', flagEmoji: '🇺🇸', currencyCode: 'USD' },
  { code: 'NE', name: 'Netherlands', flagEmoji: '🇳🇱', currencyCode: 'EUR' },
  { code: 'IL', name: 'Israel', flagEmoji: '🇮🇱', currencyCode: 'ILS' },
];

// Real institution names, because the filters need plausible data to be worth
// testing against. Contact names and phone numbers elsewhere in this file are
// deliberately invented — see SUPPORT_CONTACTS.
const INSTITUTIONS = [
  { name: 'University of Hertfordshire', country: 'UK', trending: true },
  { name: 'Ulster University', country: 'UK', trending: true },
  { name: 'University of Greater Manchester', country: 'UK' },
  { name: 'London Metropolitan University', country: 'UK' },
  { name: 'University of Leeds', country: 'UK' },
  { name: 'Northumbria University', country: 'UK' },
  { name: 'Oxford Brookes University', country: 'UK' },
  { name: 'De Montfort University', country: 'UK', trending: true },
  { name: 'Anglia Ruskin University', country: 'UK' },
  { name: 'Coventry University', country: 'UK', blacklisted: true },
  { name: 'Griffith College', country: 'IR', trending: true },
  { name: 'Atlantic Technological University', country: 'IR' },
  { name: 'University of Alberta', country: 'CA', trending: true },
  { name: 'International College of Manitoba', country: 'CA' },
  { name: 'RMIT University', country: 'AU', trending: true },
  { name: 'University of Canberra', country: 'AU' },
  { name: 'Eastern Institute of Technology', country: 'NZ' },
  { name: 'UCOL Pathway', country: 'NZ' },
  { name: 'IB Hochschule', country: 'GR' },
  { name: 'Lancaster University Leipzig', country: 'GR', trending: true },
  { name: 'Excelia Business School', country: 'FR' },
  { name: 'ESAM Groupe IGENSIA', country: 'FR' },
  { name: 'Tio Business School', country: 'NE' },
  { name: 'International Business School Budapest', country: 'HU' },
];

const DEGREE_LEVELS = ["Master's Degree", 'Postgraduate Certificate', "Bachelor's Degree"];

const COURSE_TEMPLATES = [
  { title: 'Master of Science - Data Analytics', level: "Master's Degree", months: '12 - 24 months' },
  { title: 'MSc Computer Science and Artificial Intelligence', level: "Master's Degree", months: '12 months' },
  { title: 'MBA (Project Management)', level: "Master's Degree", months: '18 months' },
  { title: 'Graduate Certificate - Information Technology', level: 'Postgraduate Certificate', months: '8 months' },
  { title: 'BSc (Hons) Business Information Systems', level: "Bachelor's Degree", months: '36 months' },
  { title: 'Bachelor of Business Administration', level: "Bachelor's Degree", months: '48 months' },
];

// Tier shapes taken from the Commission screen: some flat, some banded by volume,
// some by programme. This irregularity is why `tiers` is Json.
const COMMISSIONS = {
  'University of Hertfordshire': [
    { label: '1 - 5 Students', rate: '15%' },
    { label: '6+ Students', rate: '17%' },
  ],
  'Ulster University': [
    { label: '1-5 students', rate: '15%' },
    { label: '6+ students', rate: '17%' },
  ],
  'University of Greater Manchester': [{ label: 'All students', rate: '7%' }],
  'London Metropolitan University': [{ label: 'All students', rate: '16%' }],
  'University of Leeds': [{ label: 'IFY/IY1', rate: '12%' }],
  'Northumbria University': [
    { label: '1-5 students', rate: '15%' },
    { label: '6+ students', rate: '17%' },
  ],
  'Griffith College': [{ label: 'All students', rate: '13%' }],
  'RMIT University': [{ label: 'All students', rate: '14%' }],
};

const ENTRY_REQUIREMENTS = [
  {
    institution: 'Oxford Brookes University',
    level: 'PG',
    englishRequirement:
      'IELTS - 6.5 overall no less than 6.0, IELTS waiver - 64% in class 12 English (CBSE & ICSE) - 75 to 80% (state board)',
    academicRequirement: '60% in Bachelors',
    offerTimeline: '48 to 72 hours',
    credibilityInterview: true,
    financialInformation: '1000 GBP but preferred to pay 3000 GBP',
  },
  {
    institution: 'Oxford Brookes University',
    level: 'UG',
    englishRequirement:
      'IELTS - 6 overall no less than 5.5, IELTS waiver - 64% in class 12 English (CBSE & ICSE) - 75 to 80% (state board)',
    academicRequirement: '65 - 70% in class 12',
    offerTimeline:
      'After submitting the required docs, request the admissions office for an unconditional offer letter. Takes 4 to 5 working days.',
    credibilityInterview: true,
    financialInformation: '1000 GBP but preferred to pay 3000 GBP',
  },
  {
    institution: 'University of Hertfordshire',
    level: 'PG',
    englishRequirement: 'IELTS 6.5 overall, no band below 5.5 | PTE 59/59 | TOEFL overall 73',
    academicRequirement: "Bachelor's degree, second class or above",
    offerTimeline: '1 Week',
    credibilityInterview: true,
    financialInformation: 'Full payment of 1 year',
  },
  {
    institution: 'University of Hertfordshire',
    level: 'UG',
    englishRequirement: 'IELTS 5.5/5.5 | PTE 59/59 | TOEFL: Overall 73 - L 16, R 17, W 17, S 19',
    academicRequirement:
      'Foundation: 65% in Year X; 50% in Year XI; 40% in Year XII, or 3 Year Diploma: 40% | IY1: XII 45% | 3 Year Diploma 60% (must be from an AICTE approved state board)',
    offerTimeline: '1 Week',
    credibilityInterview: true,
    financialInformation: 'Full payment of 1 year',
  },
  {
    institution: 'Ulster University',
    level: 'PG',
    englishRequirement: 'UKVI: IELTS 5.0/4.5 | PTE 43/43',
    academicRequirement: "Bachelor's degree, graded 40%/pass",
    offerTimeline: '1 Week',
    credibilityInterview: true,
    financialInformation: 'Full Payment',
  },
  {
    institution: 'Northumbria University',
    level: 'UG',
    englishRequirement: 'IELTS 6.0 overall, no band below 5.5',
    academicRequirement: '60% in class 12',
    offerTimeline: '3 to 5 working days',
    credibilityInterview: false,
    financialInformation: 'Deposit of 4000 GBP',
  },
];

// Document titles are taken from the Document Bank screens so the five category
// routes each have realistic content. fileUrl is a placeholder path — the storage
// backend is a service-layer concern, and the column holds an opaque string
// precisely so swapping local disk for S3 is not a migration.
const DOCUMENTS = [
  ...[
    'Bar Code Document',
    'Saving Bank Cover Letter',
    'FD Cover Letter',
    'Loan Cover Letter',
    'Bank Statement',
    'No Objection Letter',
    'Translation Format',
    'Parent Consent Letter (Under 18 Student)',
    'UKVI Approved TB Test Centres',
    'UKVI New Bank List',
  ].map((title) => ({ category: 'VISA_DOCUMENT', title })),
  ...['Austria', 'Canada', 'France', 'Germany', 'Hungary', 'Ireland', 'New Zealand', 'UK'].map((c) => ({
    category: 'VISA_DOCUMENT',
    title: `List of documents for ${c}`,
  })),
  ...[
    'General Refund Form',
    'Anglia Ruskin University Refund Form',
    'University of Greenwich Refund Form',
    'Middlesex University Refund Form',
    'Ulster University Refund Form',
  ].map((title) => ({ category: 'REFUND_FORM', title })),
  ...[
    'Accounting and Financial Management MSc - Coventry University',
    'BA(Hons) Business Management - Leeds Beckett University',
    'Banking and Finance MSc - Queen Mary University of London',
    'Biotechnology MSc - University of Greenwich',
    'BSc Computer Science - Middlesex University London',
    'MSc Management and Marketing',
    'Master in Supply Chain Management',
    'MBA (Project Management)',
    'Diploma in IT Technical Support',
    'Master of Science in Computing',
  ].map((title) => ({ category: 'SOP', title })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ category: 'LOR', title: `LOR ${n}` })),
  // Institute Brochures is intentionally left empty: image 11 of the reference
  // set is that screen's "No Data Found" state, so it needs to stay reachable.
];

// Invented names and non-routable numbers. The reference screenshots show real
// staff and real mobile numbers; copying those into a seed file would be putting
// other people's personal data into this repository.
const SUPPORT_CONTACTS = [
  { name: 'Asha Menon', phone: '+91 90000 00001' },
  { name: 'Rohit Verma', phone: '+91 90000 00002' },
  { name: 'Neha Kapoor', phone: '+91 90000 00003' },
  { name: 'Imran Sheikh', phone: '+91 90000 00004' },
  { name: 'Divya Raman', phone: '+91 90000 00005' },
  { name: 'Sanjay Iyer', phone: '+91 90000 00006' },
];

const ANNOUNCEMENTS = [
  {
    variant: 'DANGER',
    message:
      'Please note that this list of universities is blacklisted. We do not accept any fake documents, and hence we request you to refrain from submitting any such documents for processing.',
    ctaLabel: 'Click for list',
    ctaUrl: '/admin/institutions?blacklisted=true',
    sortOrder: 0,
  },
  {
    variant: 'INFO',
    message: 'Declaration form is a Mandatory Document for Application',
    ctaLabel: 'Download Declaration Form',
    ctaUrl: '/documents/visa?search=Declaration',
    sortOrder: 1,
  },
];

const APPLICATION_STAGES = [
  'PROFILE_ASSESSMENT',
  'PROFILE_ASSESSMENT',
  'PROFILE_ASSESSMENT',
  'APPLICATION',
  'APPLICATION',
  'CONDITIONAL_OFFER',
  'UNCONDITIONAL_OFFER',
  'FEES_PAYMENT',
  'CAS_LETTER',
  'VISA_APPLICATION',
  'VISA_APPROVAL',
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

  const superAdmin = await mkUser('super@example.com', 'Super Admin', 'SUPER_ADMIN');
  await mkUser('admin@example.com', 'Admin User', 'ADMIN');
  const agent = await mkUser('agent@example.com', 'Darshan Limbani', 'AGENT');
  // Exercises the parentAgent self-relation behind the "invite sub-agent" action.
  const subAgent = await mkUser('subagent@example.com', 'Priya Nair', 'AGENT', agent.id);
  console.log('  users: 4 (super, admin, agent, sub-agent)');

  // ---- institutions ----
  const institutions = {};
  for (const inst of INSTITUTIONS) {
    const data = {
      name: inst.name,
      countryId: countries[inst.country].id,
      isBlacklisted: Boolean(inst.blacklisted),
      isTrending: Boolean(inst.trending),
      logoUrl: null, // no logo on purpose: the initials fallback needs exercising
    };
    institutions[inst.name] = await prisma.institution.upsert({
      where: { id: stableId('institution', inst.name) },
      update: data,
      create: { id: stableId('institution', inst.name), ...data },
    });
  }
  console.log(`  institutions: ${Object.keys(institutions).length}`);

  // ---- courses ----
  const courses = [];
  for (const [i, inst] of INSTITUTIONS.entries()) {
    for (const [j, tpl] of COURSE_TEMPLATES.slice(0, 3).entries()) {
      const key = `${inst.name}|${tpl.title}`;
      const n = i * 3 + j;
      const data = {
        institutionId: institutions[inst.name].id,
        title: tpl.title,
        degreeLevel: tpl.level,
        city: 'City ' + ((n % 7) + 1),
        tuitionFee: 9000 + (n % 12) * 750,
        applicationFee: n % 3 === 0 ? 0 : 100,
        durationText: tpl.months,
        tags: ['High Job Demand', n % 2 === 0 ? 'Prime' : 'Popular', ...(n % 5 === 0 ? ['Scholarships Available'] : [])],
        badges: n % 3 === 0 ? ['Instant Offer'] : ['Instant Submission'],
        intakes: ['Jan 2027', 'May 2027', 'Sep 2027'].slice(0, (n % 3) + 1),
      };
      courses.push(
        await prisma.course.upsert({
          where: { id: stableId('course', key) },
          update: data,
          create: { id: stableId('course', key), ...data },
        })
      );
    }
  }
  console.log(`  courses: ${courses.length}`);

  // ---- MOI acceptances ----
  let moi = 0;
  for (const inst of INSTITUTIONS.slice(0, 10)) {
    for (const level of DEGREE_LEVELS.slice(0, 2)) {
      const key = `${inst.name}|${level}`;
      const data = { institutionId: institutions[inst.name].id, courseType: level, years: 3 + (moi % 3) };
      await prisma.moiAcceptance.upsert({
        where: { id: stableId('moi', key) },
        update: data,
        create: { id: stableId('moi', key), ...data },
      });
      moi += 1;
    }
  }
  console.log(`  MOI acceptances: ${moi}`);

  // ---- commissions ----
  for (const [name, tiers] of Object.entries(COMMISSIONS)) {
    const data = { institutionId: institutions[name].id, tiers };
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
    {
      title: 'International College Portsmouth (ICP)',
      body: 'ICP has revised its January 2027 intake deadlines. Applications must be submitted with full documentation at least six weeks before the course start date.',
      country: 'UK',
      institution: null,
      daysAgo: 12,
      attachment: null,
    },
    {
      title: 'University of Hertfordshire',
      body: 'Updated English language waiver criteria for state board students, effective immediately. See the attached circular for the revised percentage bands.',
      country: 'UK',
      institution: 'University of Hertfordshire',
      daysAgo: 20,
      attachment: '/files/updates/hertfordshire-english-waiver.pdf',
    },
    {
      title: 'RMIT University — March 2027 intake',
      body: 'RMIT has opened the March 2027 intake for all postgraduate business programmes. Credibility interviews are now mandatory for all applicants.',
      country: 'AU',
      institution: 'RMIT University',
      daysAgo: 4,
      attachment: null,
    },
    {
      title: 'Griffith College scholarship round',
      body: 'A new merit scholarship round is open for September 2027 entry, worth up to 25% of first-year tuition.',
      country: 'IR',
      institution: 'Griffith College',
      daysAgo: 30,
      attachment: '/files/updates/griffith-scholarships.pdf',
    },
  ];
  for (const u of updates) {
    const data = {
      title: u.title,
      body: u.body,
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
    const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const data = {
      category: doc.category,
      title: doc.title,
      fileUrl: `/files/${doc.category.toLowerCase()}/${slug}.pdf`,
      sortOrder: i,
    };
    await prisma.document.upsert({
      where: { id: stableId('document', doc.category, doc.title) },
      update: data,
      create: { id: stableId('document', doc.category, doc.title), ...data },
    });
  }
  console.log(`  documents: ${DOCUMENTS.length} (Institute Brochures left empty on purpose)`);

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

  // ---- applications: one per stage so the Report tiles are all non-zero ----
  const students = [
    'Aarav Sharma', 'Isha Patel', 'Rahul Nair', 'Meera Krishnan', 'Kabir Singh',
    'Ananya Rao', 'Vivaan Gupta', 'Diya Menon', 'Arjun Reddy', 'Saanvi Joshi', 'Dev Malhotra',
  ];
  for (const [i, student] of students.entries()) {
    const stage = APPLICATION_STAGES[i];
    const course = courses[i * 2];
    const key = `${student}|${course.id}`;
    // A few deadlines in the near future so the "Upcoming Deadlines" panel has
    // something to show; the rest null.
    const deadlineAt = i % 4 === 0 ? new Date(Date.now() + (i + 3) * 86400000) : null;
    const data = {
      agentId: i % 5 === 0 ? subAgent.id : agent.id,
      studentName: student,
      passportNo: `P${String(1000000 + i * 7919).slice(0, 7)}`,
      courseId: course.id,
      intakeLabel: ['January 2027', 'March 2027', 'September 2027'][i % 3],
      stage,
      stageNote: STAGE_NOTES[stage],
      deadlineAt,
    };
    await prisma.application.upsert({
      where: { id: stableId('application', key) },
      update: data,
      create: { id: stableId('application', key), ...data },
    });
  }
  console.log(`  applications: ${students.length} (every stage represented)`);

  // ---- course inquiries across all four stages ----
  const inquiryStages = ['INQUIRY', 'INQUIRY', 'PENDING', 'PENDING', 'OFFERED', 'APPLIED'];
  for (const [i, stage] of inquiryStages.entries()) {
    const key = `inquiry-${i}`;
    const data = {
      agentId: agent.id,
      nationality: ['Indian', 'Nepali', 'Nigerian'][i % 3],
      countryId: countries[['UK', 'CA', 'AU', 'IR'][i % 4]].id,
      intake: ['Jan 2027', 'May 2027', 'Sep 2027'][i % 3],
      courseType: DEGREE_LEVELS[i % DEGREE_LEVELS.length],
      stage,
    };
    await prisma.courseInquiry.upsert({
      where: { id: stableId('inquiry', key) },
      update: data,
      create: { id: stableId('inquiry', key), ...data },
    });
  }
  console.log(`  course inquiries: ${inquiryStages.length} (all four stages)`);

  // ---- notifications: mix of read and unread so the badge count is meaningful ----
  const apps = await prisma.application.findMany({
    where: { agentId: agent.id },
    include: { course: { include: { institution: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  for (const [i, app] of apps.entries()) {
    const kind = ['NEW_APPLICATION', 'INFO_QUERY', 'DOCUMENT_QUERY'][i % 3];
    const body = {
      NEW_APPLICATION: 'New Application Started and Under Review.',
      INFO_QUERY: 'Information Related Query - Dear Team, please share the documents and student details.',
      DOCUMENT_QUERY: 'Document Related Query - Hello Team, kindly share the documents for assessment.',
    }[kind];
    const data = {
      userId: agent.id,
      applicationId: app.id,
      kind,
      title: `POEC ID: ${app.reference} - ${app.course.institution.name} - ${app.intakeLabel}`,
      body,
      // The first two stay unread so the bell shows a count.
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
  console.log('  agent@example.com     AGENT       — the main partner-facing account');
  console.log('  subagent@example.com  AGENT       — child of agent@example.com');
  console.log('  admin@example.com     ADMIN       — sees the Admin sidebar section');
  console.log(`  super@example.com     SUPER_ADMIN — can also POST /api/auth/users (${superAdmin.role})`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
