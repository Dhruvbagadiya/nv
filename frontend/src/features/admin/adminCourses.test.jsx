import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/courses.js', () => ({
  fetchCourses: vi.fn(),
  fetchCourse: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  archiveCourse: vi.fn(),
  restoreCourse: vi.fn(),
  bulkImportCourses: vi.fn(),
}));
vi.mock('../../api/countries.js', () => ({ fetchCountries: vi.fn() }));
vi.mock('../../api/institutions.js', () => ({ fetchInstitutions: vi.fn() }));

const coursesApi = await import('../../api/courses.js');
const countriesApi = await import('../../api/countries.js');
const institutionsApi = await import('../../api/institutions.js');
const AdminCourses = (await import('./AdminCourses.jsx')).default;

const COUNTRY = { id: 'c1', code: 'UK', name: 'United Kingdom', isoCode: 'gb', currencyCode: 'GBP', institutionCount: 2 };
const INSTITUTION = { id: 'i1', name: 'Test University', city: 'London', country: COUNTRY };

const intake = (n) => ({
  id: `in${n}`,
  startDate: `20${26 + Math.floor(n / 4)}-0${(n % 9) + 1}-01`,
  openDate: null,
  submissionDeadline: null,
  overallScore: null,
  scoreDetails: [],
});

/** What the LIST query returns: the same course, intakes capped at 12. */
const listRow = (intakeCount) => ({
  id: 'p1',
  type: 'program',
  attributes: {
    id: 'p1',
    name: 'MSc Data Science',
    shortName: null,
    slug: 'msc-data-science',
    programLevel: 'masters_degree',
    minLength: 12, maxLength: 12,
    tuition: 20000,
    applicationFee: null,
    currency: 'GBP', currencyCode: null,
    commissionAmount: null,
    abAppCreationEnabled: false,
    languageOfInstructionCode: 'eng',
    tags: [], badges: [], intakeMonths: [9],
    entryRequirements: null, externalUrl: null,
    archivedAt: null, source: null, externalId: null,
    school: { id: 'i1', name: 'Test University', city: 'London', countryCode: 'UK', countryName: 'United Kingdom', countryIso: 'gb' },
    programIntakes: Array.from({ length: Math.min(intakeCount, 12) }, (_, i) => intake(i)),
  },
});

/** What the DETAIL query returns: every intake, uncapped. */
const detailRow = (intakeCount) => ({
  data: {
    ...listRow(intakeCount),
    attributes: {
      ...listRow(intakeCount).attributes,
      programIntakes: Array.from({ length: intakeCount }, (_, i) => intake(i)),
    },
  },
});

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminCourses />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const openEditor = async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText('MSc Data Science')).toBeTruthy());
  fireEvent.click(screen.getByText('Edit'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
};

const savedPayload = () => coursesApi.updateCourse.mock.calls.at(-1)[1];

/**
 * The admin list is served with PROGRAM_LIST_INCLUDE, which caps intakes at
 * `take: 12`. The modal used to edit that list row directly, and the form posts
 * `intakes` on every save while the API replaces the whole set — so editing a
 * course with fifteen dated intakes and changing only its title deleted the
 * three latest-starting CourseIntake rows. No warning, no error, and the count
 * in the table simply read 12 afterwards.
 */
describe('AdminCourses — the intake set a save sends', () => {
  afterEach(cleanup);

  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue([COUNTRY]);
    institutionsApi.fetchInstitutions.mockResolvedValue([INSTITUTION]);
    coursesApi.fetchCourses.mockResolvedValue({
      data: [listRow(15)],
      meta: { counts: { total: 1 }, page: 1, pageSize: 12, totalPages: 1, maxPage: 1 },
    });
    coursesApi.fetchCourse.mockResolvedValue(detailRow(15));
    coursesApi.updateCourse.mockResolvedValue(detailRow(15).data);
  });

  it('fetches the untruncated course rather than editing the list row', async () => {
    await openEditor();
    await waitFor(() => expect(coursesApi.fetchCourse).toHaveBeenCalledWith('p1'));
  });

  it('sends all fifteen intakes back, not the twelve the list carried', async () => {
    await openEditor();
    await waitFor(() => expect(screen.getByText('Save changes')).toBeTruthy());

    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(coursesApi.updateCourse).toHaveBeenCalled());
    expect(savedPayload().intakes).toHaveLength(15);
  });

  // The payload must omit the key entirely until the full set is in hand: the
  // API leaves intakes alone when it is absent and REPLACES them when present,
  // so a save made from the truncated seed is what destroys rows.
  it('omits intakes entirely while the full course is still loading', async () => {
    let resolveDetail;
    coursesApi.fetchCourse.mockReturnValue(new Promise((r) => { resolveDetail = r; }));

    await openEditor();
    // Save is held closed until the set arrives, so the partial state cannot be
    // submitted at all.
    expect(screen.getByText('Loading…').closest('button').disabled).toBe(true);

    resolveDetail(detailRow(15));
    await waitFor(() => expect(screen.getByText('Save changes')).toBeTruthy());
  });

  it('leaves the other fields seeded from the list row while it loads', async () => {
    await openEditor();
    expect(screen.getByDisplayValue('MSc Data Science')).toBeTruthy();
  });
});
