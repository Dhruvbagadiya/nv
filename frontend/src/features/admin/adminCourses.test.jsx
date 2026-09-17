import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
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

/**
 * Adding a course.
 *
 * Reported as "intakes are not saving and showing". They save — the service
 * tests pin that. What failed is that two different things wear the name, and
 * the list counted only one of them: `intakeMonths` is the recurring pattern the
 * month chips write and the field the form leads with, while the dated
 * `programIntakes` underneath are labelled optional and most providers publish
 * none. Selecting six months rendered "0" under a heading that says Intakes,
 * which reads as the save having silently failed.
 */
describe('AdminCourses — adding a course', () => {
  afterEach(cleanup);

  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue([COUNTRY]);
    institutionsApi.fetchInstitutions.mockResolvedValue([INSTITUTION]);
    coursesApi.fetchCourses.mockResolvedValue({
      data: [listRow(0)],
      meta: { counts: { total: 1 }, page: 1, pageSize: 12, totalPages: 1, maxPage: 1 },
    });
    coursesApi.createCourse.mockResolvedValue({ data: listRow(0) });
  });

  const openAdd = async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Add course')).toBeTruthy());
    fireEvent.click(screen.getByText('Add course'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  };

  it('names the recurring months in the list, not just a count of dated ones', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('MSc Data Science')).toBeTruthy());

    // listRow has intakeMonths [9] and no dated intakes. The column used to
    // render "0" for exactly this row.
    expect(screen.getByText('Sep')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  // The commonest way to get "Invalid request body": the picker starts empty on
  // every Add, and the API wants a uuid.
  it('says which field is missing rather than posting an empty institution', async () => {
    await openAdd();

    fireEvent.change(screen.getByLabelText('Course title *'), { target: { value: 'Diploma in Hospitality' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

    await waitFor(() => expect(screen.getByText(/Pick an institution/)).toBeTruthy());
    expect(coursesApi.createCourse).not.toHaveBeenCalled();
  });

  /**
   * The level defaulted to MASTERS_DEGREE, so an admin adding a diploma who
   * never touched the field filed it as a Master's — a wrong answer that saves
   * cleanly, shows no error, and puts the course under the wrong filter for
   * every agent who searches after that.
   */
  it('starts with no program level chosen, and refuses to guess one', async () => {
    await openAdd();

    expect(screen.getByLabelText('Program level *').value).toBe('');

    fireEvent.change(screen.getByLabelText('Course title *'), { target: { value: 'Diploma in Hospitality' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

    // The institution check fires first; what matters is that the level is not
    // silently carrying a value nobody picked.
    await waitFor(() => expect(screen.getByText(/Pick an institution|Choose a program level/)).toBeTruthy());
    expect(coursesApi.createCourse).not.toHaveBeenCalled();
  });

  it('offers the three diploma tiers that were only ever in course titles', async () => {
    await openAdd();

    // A searchable picker now, not a <select>: twenty options in a native
    // dropdown is a scroll, and the word is what an admin knows.
    fireEvent.change(screen.getByLabelText('Program level *'), { target: { value: 'diploma' } });

    // Scoped to the open list: the table behind the modal renders level labels
    // of its own.
    const list = await screen.findByRole('listbox');
    expect(await within(list).findByText('Higher Diploma')).toBeTruthy();
    expect(within(list).getByText('Undergraduate Diploma')).toBeTruthy();
    // One word finds the whole family, which is the point of searching it.
    expect(within(list).getByText('Advanced Diploma')).toBeTruthy();
  });

  // "PG" appears in no label — the letters are in "Postgraduate" but not
  // together — so a substring search on the label alone finds nothing.
  it('finds a level by the abbreviation someone would actually type', async () => {
    await openAdd();

    fireEvent.change(screen.getByLabelText('Program level *'), { target: { value: 'pg' } });

    const list = await screen.findByRole('listbox');
    expect(await within(list).findByText('Postgraduate Diploma')).toBeTruthy();
    expect(within(list).getByText("Master's Degree")).toBeTruthy();
  });

  // Number('1,500') is NaN, which the API reports as "Expected number, received
  // nan" — accurate, and no help at all to whoever typed it.
  it('catches a tuition fee typed with a thousands separator', async () => {
    await openAdd();

    fireEvent.change(screen.getByLabelText('Course title *'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/Tuition fee/i), { target: { value: '1,500' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

    await waitFor(() => expect(screen.getByText(/Pick an institution|plain number/)).toBeTruthy());
    expect(coursesApi.createCourse).not.toHaveBeenCalled();
  });
});
