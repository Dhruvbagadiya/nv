import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/institutions/institutions.service.js');
const { createInstitutionBody } = await import('../../src/modules/institutions/institutions.schemas.js');

beforeEach(() => {
  resetPrismaMock();
  prismaMock.institution.findUnique.mockResolvedValue(null);
  prismaMock.institution.create.mockResolvedValue({ id: 'i1' });
});

const COUNTRY = '11111111-1111-4111-8111-111111111111';
const base = (over = {}) => ({ name: 'Test University', countryId: COUNTRY, ...over });

const COMMISSION = {
  tiers: [{ label: '1-5 students', rate: '15%' }],
  commissionType: 'percentage',
  rateFrom: 10,
  rateTo: 15,
  tuitionBasis: 'net',
};
const REQUIREMENT = (level) => ({
  level,
  englishRequirement: 'IELTS 6.0',
  academicRequirement: '60% in 12th',
  offerTimeline: '48 to 72 hours',
  credibilityInterview: false,
  financialInformation: '28 days of funds',
});

/**
 * An institution and the three things it is useless without.
 *
 * Commission, entry requirements and MOI acceptances each had their own screen,
 * so adding a university meant four visits — and the last three are easy to
 * forget, which is how an institution ends up in the catalogue looking complete
 * with no commission and no requirements behind it. Nothing anywhere said they
 * were missing.
 */

describe('createInstitutionBody — the nested blocks', () => {
  it('accepts an institution on its own, exactly as before', () => {
    expect(createInstitutionBody.safeParse(base()).success).toBe(true);
  });

  it('accepts all three together', () => {
    const r = createInstitutionBody.safeParse(base({
      commission: COMMISSION,
      entryRequirements: [REQUIREMENT('UG'), REQUIREMENT('PG')],
      moiAcceptances: [{ courseType: "Bachelor's", years: 3 }],
    }));
    expect(r.success).toBe(true);
  });

  // The unique constraint is (institutionId, level) and there are two levels, so
  // a repeat is necessarily a duplicate — and it would fail at the database with
  // a message about a constraint the admin cannot see.
  it('refuses two requirements at the same level', () => {
    const r = createInstitutionBody.safeParse(base({
      entryRequirements: [REQUIREMENT('UG'), REQUIREMENT('UG')],
    }));
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/one entry requirement per level/);
  });

  it('refuses two MOI rows for the same course type', () => {
    const r = createInstitutionBody.safeParse(base({
      moiAcceptances: [
        { courseType: "Bachelor's", years: 3 },
        { courseType: "Bachelor's", years: 4 },
      ],
    }));
    expect(r.success).toBe(false);
  });

  // The rate checks are imported from the commission module rather than
  // restated, so this proves the import is live — a second copy of the rule is
  // the copy nobody edits.
  it('applies the commission range checks to the nested block', () => {
    const r = createInstitutionBody.safeParse(base({
      commission: { ...COMMISSION, rateFrom: 15, rateTo: 5 },
    }));
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/Rate from must not be greater/);
  });

  it('still requires at least one tier when a commission is given', () => {
    const r = createInstitutionBody.safeParse(base({ commission: { ...COMMISSION, tiers: [] } }));
    expect(r.success).toBe(false);
  });

  // Not `institutionId`: it does not exist until the insert runs, and accepting
  // one here would let a caller attach a commission to a different institution.
  it('rejects an institutionId inside a nested block', () => {
    const r = createInstitutionBody.safeParse(base({
      commission: { ...COMMISSION, institutionId: COUNTRY },
    }));
    expect(r.success).toBe(false);
  });
});

describe('createInstitution — one write, not four', () => {
  it('nests all three into the create, so nothing can half-land', async () => {
    await service.createInstitution(base({
      commission: COMMISSION,
      entryRequirements: [REQUIREMENT('UG')],
      moiAcceptances: [{ courseType: "Bachelor's", years: 3 }],
    }));

    const { data } = prismaMock.institution.create.mock.calls[0][0];
    expect(data.commission.create).toEqual(COMMISSION);
    expect(data.entryRequirements.create).toHaveLength(1);
    expect(data.moiAcceptances.create).toHaveLength(1);
    // A nested create is one statement. Three sequential writes would let the
    // institution exist with its commission having failed.
    expect(prismaMock.institution.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.universityCommission.create).not.toHaveBeenCalled();
  });

  it('writes nothing extra when the sections are left alone', async () => {
    await service.createInstitution(base());

    const { data } = prismaMock.institution.create.mock.calls[0][0];
    expect(data.commission).toBeUndefined();
    expect(data.entryRequirements).toBeUndefined();
    expect(data.moiAcceptances).toBeUndefined();
  });

  // An empty array is what a form sends for a section the admin opened and then
  // left blank. `{ create: [] }` is a valid write that does nothing, and the row
  // it produces should be identical to one from a form that omitted the key.
  it('treats an empty array as not supplied', async () => {
    await service.createInstitution(base({ entryRequirements: [], moiAcceptances: [] }));

    const { data } = prismaMock.institution.create.mock.calls[0][0];
    expect(data.entryRequirements).toBeUndefined();
    expect(data.moiAcceptances).toBeUndefined();
  });

  it('keeps the nested blocks out of the institution row itself', async () => {
    await service.createInstitution(base({ commission: COMMISSION }));

    const { data } = prismaMock.institution.create.mock.calls[0][0];
    // Spreading `data` unfiltered would hand Prisma a scalar named `commission`
    // alongside the relation write, which is a validation error with no `.code`
    // — a guaranteed 500 on a request that is entirely valid.
    expect(data.name).toBe('Test University');
    expect(Object.keys(data)).not.toContain('moiAcceptances');
  });
});
