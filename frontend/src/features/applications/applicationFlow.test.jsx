import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The application flow was the one path with no working route through the UI at
// all: the course <select> held a single disabled placeholder and a TODO, so
// courseId could never be set and the form could never be submitted. These tests
// pin the repaired flow.

vi.mock('../../api/courses.js', () => ({
  fetchCourses: vi.fn(),
  fetchCourse: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  archiveCourse: vi.fn(),
  restoreCourse: vi.fn(),
}));
vi.mock('../../api/applications.js', () => ({
  fetchApplications: vi.fn(),
  createApplication: vi.fn(),
}));
vi.mock('../../api/countries.js', () => ({ fetchCountries: vi.fn() }));
vi.mock('../../api/institutions.js', () => ({
  fetchInstitutions: vi.fn(),
  createInstitution: vi.fn(),
  setBlacklist: vi.fn(),
}));

const coursesApi = await import('../../api/courses.js');
const applicationsApi = await import('../../api/applications.js');
const countriesApi = await import('../../api/countries.js');
const institutionsApi = await import('../../api/institutions.js');

const NewApplication = (await import('./NewApplication.jsx')).default;
const ApplicationHistory = (await import('./ApplicationHistory.jsx')).default;
const CourseCard = (await import('../courseFinder/CourseCard.jsx')).default;

const COUNTRY = { id: 'c1', code: 'UK', name: 'United Kingdom', flagEmoji: '🇬🇧', currencyCode: 'GBP', institutionCount: 3 };
const INSTITUTION = { id: 'i1', name: 'University of Hertfordshire', country: COUNTRY };
const COURSE = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'program',
  attributes: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'MBA (Project Management)',
    shortName: 'MBA',
    slug: 'mba-project-management',
    programLevel: 'masters_degree',
    minLength: 18,
    maxLength: 18,
    languageOfInstructionCode: 'eng',
    tuition: 10500,
    applicationFee: 0,
    commissionAmount: 1500,
    currency: 'GBP',
    abAppCreationEnabled: true,
    successScore: null,
    tags: ['Prime'],
    school: {
      id: 'i1',
      name: 'University of Hertfordshire',
      slug: 'university-of-hertfordshire',
      city: 'Hatfield',
      province: 'England',
      countryCode: 'UK',
      logoThumbnailUrl: null,
    },
    programIntakes: [
      { id: 1, startDate: '2027-01-01', openDate: '2026-06-01', submissionDeadline: '2026-12-01', overallScore: null, scoreDetails: [] },
      { id: 2, startDate: '2027-05-01', openDate: null, submissionDeadline: null, overallScore: null, scoreDetails: [] },
    ],
  },
};


// What /api/applications embeds: the raw Prisma course row, unlike /api/courses
// which returns the shaped program resource.
const RAW_COURSE = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'MBA (Project Management)',
  institution: {
    id: 'i1',
    name: 'University of Hertfordshire',
    country: { code: 'UK', name: 'United Kingdom', flagEmoji: '🇬🇧', currencyCode: 'GBP' },
  },
};

// Plain harness: the component under test IS the route, so nothing shadows it.
function renderAt(ui, route = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('application flow', () => {
  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue([COUNTRY]);
    institutionsApi.fetchInstitutions.mockResolvedValue([INSTITUTION]);
    coursesApi.fetchCourses.mockResolvedValue({ data: [COURSE], meta: { counts: { total: 1 }, page: 1, pageSize: 20, totalPages: 1 } });
    coursesApi.fetchCourse.mockResolvedValue({ data: COURSE });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('CourseCard links into the flow with the course preselected', () => {
    renderAt(<CourseCard program={COURSE} />);
    const link = screen.getByText('Create application').closest('a');
    // Was a <button> with no onClick, so the intended entry point was inert.
    expect(link.getAttribute('href')).toBe(`/partner/add-application?courseId=${COURSE.id}`);
  });

  it('resolves ?courseId= and offers only that course’s intakes', async () => {
    renderAt(<NewApplication />, `/add-application?courseId=${COURSE.id}`);
    await waitFor(() => expect(screen.getByText('MBA (Project Management)')).toBeTruthy());
    expect(coursesApi.fetchCourse).toHaveBeenCalledWith(COURSE.id);
    // GBP, from the course's country — not the hardcoded CAD this app used to print.
    expect(screen.getByText(/£10,500/)).toBeTruthy();

    const intake = screen.getByRole('combobox');
    const options = within(intake).getAllByRole('option').map((o) => o.textContent);
    expect(options.length).toBe(3); // placeholder + the course's two intakes
    expect(options[0]).toMatch(/Select/);
  });

  it('cannot be submitted without a course, and can be with one', async () => {
    renderAt(<NewApplication />, '/add-application');
    await waitFor(() => expect(screen.getByLabelText('Search courses')).toBeTruthy());
    // No course chosen: submit is disabled rather than failing on send.
    expect(screen.getByText('Proceed for application').disabled).toBe(true);

    // Pick from the searchable list, which replaced the empty <select>.
    await waitFor(() => expect(screen.getByText('MBA (Project Management)')).toBeTruthy());
    fireEvent.click(screen.getByText('MBA (Project Management)'));
    await waitFor(() => expect(screen.getByText('Proceed for application').disabled).toBe(false));
  });

  it('submits studentName, passportNo, courseId and intakeLabel', async () => {
    applicationsApi.createApplication.mockResolvedValue({
      id: 'a1',
      reference: 47,
      studentName: 'Aarav Sharma',
    });

    renderAt(<NewApplication />, `/add-application?courseId=${COURSE.id}`);
    await waitFor(() => expect(screen.getByText('MBA (Project Management)')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('As written in the passport'), {
      target: { value: 'Aarav Sharma' },
    });
    fireEvent.change(document.querySelector('input[maxlength="40"]'), {
      target: { value: 'P1234567' },
    });
    const intakeSelect = screen.getByRole('combobox');
    fireEvent.change(intakeSelect, { target: { value: intakeSelect.options[1].value } });
    fireEvent.click(screen.getByText('Proceed for application'));

    await waitFor(() => expect(applicationsApi.createApplication).toHaveBeenCalled());
    // First argument only: React Query v5 passes a mutation context as a second
    // argument, so toHaveBeenCalledWith would need to account for it too.
    expect(applicationsApi.createApplication.mock.calls[0][0]).toEqual({
      studentName: 'Aarav Sharma',
      passportNo: 'P1234567',
      courseId: COURSE.id,
      // Derived from the intake's startDate, so the exact wording is the
      // component's business ("January 2027"), not this test's.
      intakeLabel: expect.any(String),
    });
  });

  it('surfaces the API error message rather than a generic one', async () => {
    applicationsApi.createApplication.mockRejectedValue({
      response: { data: { error: 'That course is not available for new applications' } },
    });

    renderAt(<NewApplication />, `/add-application?courseId=${COURSE.id}`);
    await waitFor(() => expect(screen.getByText('MBA (Project Management)')).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText('As written in the passport'), {
      target: { value: 'X' },
    });
    fireEvent.change(document.querySelector('input[maxlength="40"]'), {
      target: { value: 'P1234567' },
    });
    const intakeSelect = screen.getByRole('combobox');
    fireEvent.change(intakeSelect, { target: { value: intakeSelect.options[1].value } });
    fireEvent.click(screen.getByText('Proceed for application'));

    await waitFor(() =>
      expect(screen.getByText('That course is not available for new applications')).toBeTruthy()
    );
  });
});

describe('ApplicationHistory', () => {
  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue([COUNTRY]);
    institutionsApi.fetchInstitutions.mockResolvedValue([INSTITUTION]);
    applicationsApi.fetchApplications.mockResolvedValue({
      items: [
        {
          id: 'a1',
          reference: 4367,
          studentName: 'Aarav Sharma',
          passportNo: 'P1234567',
          intakeLabel: 'March 2027',
          stage: 'CAS_LETTER',
          stageNote: 'CAS requested from the institution',
          deadlineAt: null,
          course: RAW_COURSE,
        },
      ],
      meta: { total: 40, page: 1, pageSize: 20, totalPages: 2 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the POEC reference, stage label and note', async () => {
    renderAt(<ApplicationHistory />, '/app-history');
    await waitFor(() => expect(screen.getByText('Aarav Sharma')).toBeTruthy());
    const table = document.querySelector('table');
    // The sequential reference agents read out, not a truncated uuid.
    expect(within(table).getByText('4367')).toBeTruthy();
    // Scoped: "CAS Letters" is also an <option> in the stage filter.
    expect(within(table).getByText('CAS Letters')).toBeTruthy();
    expect(within(table).getByText('CAS requested from the institution')).toBeTruthy();
  });

  // F-11: page was tracked in state and no control was ever rendered, so page 2
  // was unreachable on this screen.
  it('renders pagination', async () => {
    renderAt(<ApplicationHistory />, '/app-history');
    await waitFor(() => expect(screen.getByLabelText('Pagination')).toBeTruthy());
    expect(screen.getByText('Showing 1–20 of 40')).toBeTruthy();
  });

  // The Report screen's stat tiles link in here with ?stage=…
  it('applies a stage filter from the URL', async () => {
    renderAt(<ApplicationHistory />, '/app-history?stage=CAS_LETTER');
    await waitFor(() => expect(applicationsApi.fetchApplications).toHaveBeenCalled());
    expect(applicationsApi.fetchApplications).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'CAS_LETTER' })
    );
  });
});
