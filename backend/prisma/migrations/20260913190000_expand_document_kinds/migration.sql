-- Widen ApplicationDocumentKind from 8 values to 54.
--
-- Eight covered a passport and a transcript and left everything else as OTHER --
-- and OTHER is where the column stops being able to answer "which applications
-- are missing a TB test?", which is the whole reason it is an enum rather than
-- free text.
--
-- Written as a type REPLACEMENT rather than a series of `ALTER TYPE ... ADD
-- VALUE`. ADD VALUE cannot be used in the same transaction that later reads the
-- new value, and Prisma runs each migration in one transaction -- so the additive
-- form works until something in the same file touches the column, and then fails
-- in a way that is hard to read. Replacing the type is one atomic step.
--
-- The original eight names are preserved exactly, so the USING cast below finds
-- a home for every existing row. Adding a value is safe; renaming one would
-- silently drop rows in the cast, which is why this list only ever grows.

ALTER TYPE "ApplicationDocumentKind" RENAME TO "ApplicationDocumentKind_old";

CREATE TYPE "ApplicationDocumentKind" AS ENUM (
  'PASSPORT',
  'PASSPORT_PHOTO',
  'NATIONAL_ID',
  'BIRTH_CERTIFICATE',
  'PREVIOUS_VISA',
  'VISA_REFUSAL',
  'TENTH_CERTIFICATE',
  'TWELFTH_CERTIFICATE',
  'BACHELORS_DEGREE',
  'BACHELORS_TRANSCRIPT',
  'MASTERS_DEGREE',
  'MASTERS_TRANSCRIPT',
  'DIPLOMA_CERTIFICATE',
  'ACADEMIC_TRANSCRIPT',
  'BACKLOG_CERTIFICATE',
  'MEDIUM_OF_INSTRUCTION',
  'GAP_JUSTIFICATION',
  'ENGLISH_TEST',
  'IELTS',
  'PTE',
  'TOEFL',
  'DUOLINGO',
  'STATEMENT_OF_PURPOSE',
  'LETTER_OF_RECOMMENDATION',
  'CV_RESUME',
  'PORTFOLIO',
  'RESEARCH_PROPOSAL',
  'EXPERIENCE_LETTER',
  'PAYSLIP',
  'INTERNSHIP_CERTIFICATE',
  'FINANCIAL',
  'BANK_STATEMENT',
  'BANK_BALANCE_CERTIFICATE',
  'LOAN_SANCTION_LETTER',
  'SPONSORSHIP_AFFIDAVIT',
  'INCOME_TAX_RETURN',
  'FIXED_DEPOSIT',
  'PROPERTY_VALUATION',
  'SCHOLARSHIP_LETTER',
  'FEE_RECEIPT',
  'OFFER_LETTER',
  'CAS_LETTER',
  'CONFIRMATION_OF_ENROLMENT',
  'DECLARATION_FORM',
  'TB_TEST',
  'MEDICAL_REPORT',
  'POLICE_CLEARANCE',
  'ATAS_CERTIFICATE',
  'ACCOMMODATION_PROOF',
  'TRAVEL_INSURANCE',
  'BIOMETRIC_APPOINTMENT',
  'MARRIAGE_CERTIFICATE',
  'NAME_CHANGE_AFFIDAVIT',
  'OTHER'
);

-- The column default has to go before the type changes and come back after:
-- Postgres will not cast a DEFAULT expression of the old type.
ALTER TABLE "ApplicationDocument" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "ApplicationDocument"
  ALTER COLUMN "kind" TYPE "ApplicationDocumentKind"
  USING "kind"::text::"ApplicationDocumentKind";
ALTER TABLE "ApplicationDocument" ALTER COLUMN "kind" SET DEFAULT 'OTHER';

DROP TYPE "ApplicationDocumentKind_old";
