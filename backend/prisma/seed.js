import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const COUNTRIES = [
  { name: 'United Kingdom', code: 'UK' },
  { name: 'Canada', code: 'CA' },
  { name: 'Australia', code: 'AU' },
  { name: 'Netherlands', code: 'NE' },
];

const DEGREE_LEVELS = ["Master's Degree", "Postgraduate Certificate", "Bachelor's Degree"];
const TITLES = [
  'Master of Science - Data Analytics',
  'Graduate Certificate - Information Technology',
  'College Diploma - Early Childhood Education',
  'Bachelor of Business Administration',
];

async function main() {
  const countries = await Promise.all(
    COUNTRIES.map((c) => prisma.country.upsert({ where: { code: c.code }, update: {}, create: c }))
  );

  const agent = await prisma.user.upsert({
    where: { email: 'agent@example.com' },
    update: {},
    create: {
      name: 'Agent Name',
      email: 'agent@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'AGENT',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'ADMIN',
    },
  });

  const courses = [];
  for (let i = 0; i < 12; i++) {
    const country = countries[i % countries.length];
    const institution = await prisma.institution.create({
      data: { name: `Institution ${String.fromCharCode(65 + i)}`, countryId: country.id },
    });
    const course = await prisma.course.create({
      data: {
        institutionId: institution.id,
        title: TITLES[i % TITLES.length],
        degreeLevel: DEGREE_LEVELS[i % DEGREE_LEVELS.length],
        city: 'Sample City',
        tuitionFee: 12000 + i * 500,
        applicationFee: 100,
        durationText: '12 - 24 months',
        tags: ['High Job Demand', i % 2 === 0 ? 'Prime' : 'Popular'],
        status: i % 3 === 0 ? ['Instant Offer'] : ['Instant Submission'],
        intakes: ['Jan 2027', 'May 2027', 'Sep 2027'],
      },
    });
    courses.push(course);

    if (i < 4) {
      await prisma.moiAcceptance.create({
        data: { institutionId: institution.id, courseType: DEGREE_LEVELS[i % DEGREE_LEVELS.length], years: 5 },
      });
    }
  }

  await prisma.application.create({
    data: {
      agentId: agent.id,
      studentName: 'Sample Student',
      passportNo: 'P0000001',
      courseId: courses[0].id,
      primaryStatus: 'Application Request',
      secondaryStatus: 'Profile Under Review',
    },
  });

  await prisma.courseInquiry.create({
    data: { agentId: agent.id, nationality: 'Indian', intake: 'Jan 2027', courseType: "Master's Degree" },
  });

  console.log('Seed complete.');
  console.log('Agent login: agent@example.com / password123');
  console.log('Admin login: admin@example.com / password123 (has access to /admin/institutions and /admin/courses)');
}

main().finally(() => prisma.$disconnect());
