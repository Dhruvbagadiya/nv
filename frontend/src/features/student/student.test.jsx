import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The student portal had no render coverage at all. Its risk is the same as the
// partner screens': shape. It reads the program resource
// ({ id, type, attributes: { name, school, tuition, programIntakes } }) on some
// screens and the raw application row on others, and those are different objects.

vi.mock('../../api/students.js', () => ({
  fetchStudentProfile: vi.fn(),
  updateStudentProfile: vi.fn(),
  fetchStudentApplications: vi.fn(),
  fetchStudentApplication: vi.fn(),
  createStudentApplication: vi.fn(),
  registerStudent: vi.fn(),
}));
vi.mock('../../api/courses.js', () => ({
  fetchCourses: vi.fn(),
  fetchCourse: vi.fn(),
}));
vi.mock('../../api/auth.js', () => ({ login: vi.fn(), refresh: vi.fn(), logout: vi.fn() }));

const studentsApi = await import('../../api/students.js');
const coursesApi = await import('../../api/courses.js');
const { useAuth } = await import('../../store/useAuth.js');

const StudentProgramBrowser = (await import('./StudentProgramBrowser.jsx')).default;
const StudentProgramDetail = (await import('./StudentProgramDetail.jsx')).default;
const StudentApplications = (await import('./StudentApplications.jsx')).default;
const StudentApplyForm = (await import('./StudentApplyForm.jsx')).default;
const StudentProfile = (await import('./StudentProfile.jsx')).default;
const StudentLoginPage = (await import('./StudentLoginPage.jsx')).default;

const PROGRAM = {
  id: 'p1',
  type: 'program',
  attributes: {
    id: 'p1',
    name: 'Bachelor of Computer Science - General',
    shortName: 'Computer Science',
    slug: 'bsc-cs',
    programLevel: 'three_year_bachelors',
    minLength: 36,
    maxLength: 36,
    languageOfInstructionCode: 'eng',
    tuition: 22601,
    applicationFee: 0,
    currency: 'CAD',
    commissionAmount: 3165,
    abAppCreationEnabled: true,
    successScore: null,
    tags: ['Popular Programs'],
    school: {
      id: 's1',
      name: 'Algoma University',
      slug: 'algoma',
      city: 'Sault Ste. Marie',
      province: 'Ontario',
      countryCode: 'CA',
      logoThumbnailUrl: null,
    },
    programIntakes: [
      { id: 1, startDate: '2027-01-01', openDate: '2026-06-27', submissionDeadline: '2027-01-01', overallScore: null, scoreDetails: [] },
    ],
  },
};

// What /students/applications returns — the RAW application row, not a program.
const APPLICATION = {
  id: 'a1',
  reference: 60,
  studentName: 'Flow Student',
  passportNo: 'P7654321',
  intakeLabel: 'January 2027',
  stage: 'PROFILE_ASSESSMENT',
  stageNote: 'Profile Under Review',
  deadlineAt: null,
  createdAt: '2026-08-09T00:00:00.000Z',
  course: {
    id: 'p1',
    title: 'Bachelor of Computer Science - General',
    institution: { id: 's1', name: 'Algoma University', country: { code: 'CA', name: 'Canada', flagEmoji: '🇨🇦' } },
  },
};

// `pattern` matters: components read useParams(), which is empty under a bare
// "*" route. /apply/:courseId has to be declared as such or courseId is undefined.
function renderAt(ui, route = '/', pattern = '*') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/programs" element={<p>PROGRAMS</p>} />
          <Route path="/partner/dashboard" element={<p>PARTNER</p>} />
          <Route path="/admin" element={<p>ADMIN</p>} />
          <Route path={pattern} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('student portal', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'authenticated',
      // emailVerifiedAt set: the apply form refuses to submit without it, so an
      // unverified fixture would make every flow test here a test of the gate.
      // The gate has its own test below.
      user: {
        id: 'u1', name: 'Flow Student', email: 'f@x.com', role: 'STUDENT',
        parentAgentId: null, emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    coursesApi.fetchCourses.mockResolvedValue({
      data: [PROGRAM],
      meta: { counts: { total: 1 }, page: 1, pageSize: 12, totalPages: 1 },
    });
    coursesApi.fetchCourse.mockResolvedValue({ data: PROGRAM });
    studentsApi.fetchStudentApplications.mockResolvedValue({
      items: [APPLICATION],
      meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
    });
    studentsApi.fetchStudentApplication.mockResolvedValue(APPLICATION);
    studentsApi.fetchStudentProfile.mockResolvedValue({
      userId: 'u1', nationality: 'Indian', dateOfBirth: null, passportNo: 'P7654321', phone: '', address: '',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('browser renders programs from the program resource', async () => {
    renderAt(<StudentProgramBrowser />, '/programs-list');
    await waitFor(() => expect(screen.getByText(/Bachelor of Computer Science/)).toBeTruthy());
    expect(screen.getByText(/Algoma University/)).toBeTruthy();
    // City and country come from attributes.school, not the course itself.
    expect(screen.getByText(/Sault Ste\. Marie/)).toBeTruthy();
  });

  // applicationFee is nullable and null means "no fee published" — the majority
  // of the imported catalogue. Number(null) is 0, so the browser and the course
  // page both announced Free on two PUBLIC pages, for courses that then invoice.
  it('does not advertise an unpublished application fee as free', async () => {
    const noFee = { ...PROGRAM, attributes: { ...PROGRAM.attributes, applicationFee: null } };
    coursesApi.fetchCourses.mockResolvedValue({
      data: [noFee],
      meta: { counts: { total: 1 }, page: 1, pageSize: 12, totalPages: 1, maxPage: 1 },
    });

    renderAt(<StudentProgramBrowser />, '/programs-list');
    await waitFor(() => expect(screen.getByText(/Bachelor of Computer Science/)).toBeTruthy());

    expect(screen.queryByText('Free')).toBeNull();
    expect(screen.getByText('Not published')).toBeTruthy();
  });

  it('still says Free when the fee is genuinely zero', async () => {
    renderAt(<StudentProgramBrowser />, '/programs-list');
    await waitFor(() => expect(screen.getByText(/Bachelor of Computer Science/)).toBeTruthy());

    expect(screen.getByText('Free')).toBeTruthy();
  });

  // Both length columns default to 0, so an unstated duration read "0 months".
  it('does not render an unpublished duration as zero months', async () => {
    coursesApi.fetchCourse.mockResolvedValue({
      data: { ...PROGRAM, attributes: { ...PROGRAM.attributes, minLength: 0, maxLength: 0 } },
    });

    renderAt(<StudentProgramDetail />, '/programs/p1', '/programs/:id');
    await waitFor(() => expect(screen.getByText(/Bachelor of Computer Science/)).toBeTruthy());

    expect(screen.queryByText('0 months')).toBeNull();
  });

  // The public browser offered all 7,757 pages while the API refuses any offset
  // past page 834, so the last-page button led straight to an error. The partner
  // course finder already passed maxPage; this screen did not.
  it('caps the pager at the last page the API will actually serve', async () => {
    coursesApi.fetchCourses.mockResolvedValue({
      data: [PROGRAM],
      meta: { counts: { total: 93076 }, page: 1, pageSize: 12, totalPages: 7757, maxPage: 834 },
    });

    renderAt(<StudentProgramBrowser />, '/programs-list');
    await waitFor(() => expect(screen.getByLabelText('Page 834')).toBeTruthy());
    expect(screen.queryByLabelText('Page 7757')).toBeNull();
  });

  it('program detail renders fees in the program currency', async () => {
    renderAt(<StudentProgramDetail />, '/programs/p1', '/programs/:id');
    await waitFor(() => expect(screen.getByText(/Bachelor of Computer Science/)).toBeTruthy());
    // CAD from attributes.currency — not a hardcoded symbol.
    expect(screen.getByText(/22,601|22601/)).toBeTruthy();
    // A zero application fee reads as "Free", not "$0".
    expect(screen.getByText(/Free/i)).toBeTruthy();
  });

  it('applications list reads the RAW application row, not a program resource', async () => {
    renderAt(<StudentApplications />, '/my-applications');
    await waitFor(() => expect(screen.getByText(/POEC #60/)).toBeTruthy());
    // course.title exists on the raw row; attributes.name does not.
    expect(screen.getByText('Bachelor of Computer Science - General')).toBeTruthy();
    expect(screen.getByText(/January 2027/)).toBeTruthy();
  });

  it('apply form prefills the name and offers the program’s own intakes', async () => {
    renderAt(<StudentApplyForm />, '/apply/p1', '/apply/:courseId');
    await waitFor(() => expect(screen.getByDisplayValue('Flow Student')).toBeTruthy());
    const select = screen.getByRole('combobox');
    // Placeholder + the single seeded intake.
    expect(select.options.length).toBe(2);
  });

  it('apply form submits exactly the fields the API requires', async () => {
    studentsApi.createStudentApplication.mockResolvedValue({ id: 'a9', reference: 61 });
    renderAt(<StudentApplyForm />, '/apply/p1', '/apply/:courseId');
    await waitFor(() => expect(screen.getByDisplayValue('Flow Student')).toBeTruthy());

    // Exact ids/text: "Apply" also appears in the page heading, so a loose
    // matcher is genuinely ambiguous here.
    fireEvent.change(document.querySelector('#a-passport'), { target: { value: 'P7654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => expect(studentsApi.createStudentApplication).toHaveBeenCalled());
    const payload = studentsApi.createStudentApplication.mock.calls[0][0];
    // The API's schema is .strict() and requires all three.
    expect(payload.courseId).toBe('p1');
    expect(payload.studentName).toBe('Flow Student');
    expect(payload.passportNo).toBe('P7654321');
  });

  /*
   * The gate that stops unverified accounts filing applications against real
   * partner institutions. The server refuses these outright; this asserts the
   * client explains why rather than letting someone fill the form in and hit a
   * 403 at the end.
   */
  it('refuses to submit an application until the email is confirmed', async () => {
    useAuth.setState({
      status: 'authenticated',
      user: {
        id: 'u1', name: 'Flow Student', email: 'f@x.com', role: 'STUDENT',
        parentAgentId: null, emailVerifiedAt: null,
      },
    });
    studentsApi.createStudentApplication.mockClear();
    renderAt(<StudentApplyForm />, '/apply/p1', '/apply/:courseId');
    await waitFor(() => expect(screen.getByDisplayValue('Flow Student')).toBeTruthy());

    const submit = screen.getByRole('button', { name: 'Submit application' });
    expect(submit.disabled).toBe(true);
    expect(screen.getByText(/Confirm your email address before submitting/i)).toBeTruthy();

    fireEvent.click(submit);
    expect(studentsApi.createStudentApplication).not.toHaveBeenCalled();
  });

  it('profile seeds its form from the fetched profile', async () => {
    renderAt(<StudentProfile />, '/profile');
    await waitFor(() => expect(screen.getByDisplayValue('Indian')).toBeTruthy());
  });

  // The crash: the early return used to sit above two useMutation calls, so the
  // hook count changed between renders and React threw.
  it('login page redirects a signed-in student without a hook-order crash', () => {
    renderAt(<StudentLoginPage />, '/login');
    expect(screen.getByText('PROGRAMS')).toBeTruthy();
  });

  it.each([
    ['AGENT', 'PARTNER'],
    ['SUPER_ADMIN', 'ADMIN'],
  ])('login page sends a signed-in %s to their own portal', (role, expected) => {
    useAuth.setState({ status: 'authenticated', user: { id: 'x', role, parentAgentId: null } });
    renderAt(<StudentLoginPage />, '/login');
    expect(screen.getByText(expected)).toBeTruthy();
  });
});
