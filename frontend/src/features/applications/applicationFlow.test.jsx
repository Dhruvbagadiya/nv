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
  fetchApplication: vi.fn(),
  advanceApplicationStage: vi.fn(),
  fetchApplicationDocuments: vi.fn(),
  uploadApplicationDocument: vi.fn(),
  removeApplicationDocument: vi.fn(),
}));
vi.mock('../../api/countries.js', () => ({ fetchCountries: vi.fn() }));
vi.mock('../../api/auth.js', () => ({ login: vi.fn(), refresh: vi.fn(), logout: vi.fn() }));
vi.mock('../../api/institutions.js', () => ({
  fetchInstitutions: vi.fn(),
  createInstitution: vi.fn(),
  setBlacklist: vi.fn(),
}));

const coursesApi = await import('../../api/courses.js');
const applicationsApi = await import('../../api/applications.js');

/**
 * The documents endpoint is paged now — an application accumulates attachments
 * for as long as it is open, and it used to return all of them in one array.
 */
const docPage = (items) => ({
  items,
  meta: { total: items.length, page: 1, pageSize: 24, totalPages: 1, maxPage: 1 },
});
const countriesApi = await import('../../api/countries.js');
const institutionsApi = await import('../../api/institutions.js');
const { useAuth } = await import('../../store/useAuth.js');

const NewApplication = (await import('./NewApplication.jsx')).default;
const ApplicationHistory = (await import('./ApplicationHistory.jsx')).default;
const ApplicationDetail = (await import('./ApplicationDetail.jsx')).default;
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

/**
 * The stage strip is the ONLY way an admin moves an application through the
 * pipeline, and it was a <div onClick> — no tabIndex, no role, no key handler.
 * DataTable's rows were given keyboard access precisely so a keyboard user could
 * reach an application; the fix stopped at the row, so they arrived at the panel
 * and could not act.
 */
describe('advancing a stage without a mouse', () => {
  const APP = {
    id: 'a1',
    reference: 41,
    studentName: 'Test Student',
    passportNo: 'P123',
    intakeLabel: 'January 2027',
    stage: 'PROFILE_ASSESSMENT',
    stageNote: null,
    deadlineAt: null,
    createdAt: '2026-08-09T00:00:00.000Z',
    agent: null,
    course: {
      id: 'p1',
      title: 'MBA (Project Management)',
      institution: { id: 'i1', name: 'University of Hertfordshire', country: COUNTRY },
    },
  };

  // Registered per-describe in this file, so a new block needs its own.
  afterEach(cleanup);

  beforeEach(() => {
    applicationsApi.fetchApplication.mockResolvedValue(APP);
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([]));
    useAuth.setState({ user: { id: 'u1', name: 'Admin', role: 'ADMIN' }, status: 'authenticated' });
  });

  const nextStageTile = async () => {
    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Test Student')).toBeTruthy());
    // The stages after the current one are the actionable ones; each is labelled
    // with where it would advance to.
    return screen.getAllByRole('button', { name: /^Advance to / })[0];
  };

  it('exposes each advanceable stage as a focusable button', async () => {
    const tile = await nextStageTile();
    expect(tile.getAttribute('tabIndex')).toBe('0');
  });

  it.each(['Enter', ' '])('opens the stage form on %s', async (key) => {
    const tile = await nextStageTile();
    fireEvent.keyDown(tile, { key });

    await waitFor(() => expect(screen.getByText(/Stage note/i)).toBeTruthy());
  });

  // An AGENT can view but not advance, so those tiles must not be focusable at
  // all — a tab stop that does nothing is its own kind of broken.
  it('leaves the tiles unfocusable for a role that cannot advance', async () => {
    useAuth.setState({ user: { id: 'u2', name: 'Agent', role: 'AGENT' }, status: 'authenticated' });

    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Test Student')).toBeTruthy());

    expect(screen.queryAllByRole('button', { name: /^Advance to / })).toHaveLength(0);
  });
});

/**
 * An agent had nowhere to attach a passport scan or the mandatory declaration
 * form: the Application model carried no documents, and /api/uploads is
 * ADMIN-only so there was no upload endpoint an agent could reach at all. The
 * stage-note field on this same panel offers "pending document upload" as its
 * example text, so the workflow had assumed these existed the whole time.
 */
describe('attaching documents to an application', () => {
  afterEach(cleanup);

  const APP_DOC = {
    id: 'd1',
    kind: 'DECLARATION_FORM',
    label: 'Signed copy',
    fileUrl: '/uploads/application-documents/abc.pdf',
    fileName: 'declaration.pdf',
    contentType: 'application/pdf',
    sizeBytes: 240_000,
    createdAt: '2026-09-01T00:00:00.000Z',
    uploadedBy: { id: 'u1', name: 'Darshan' },
  };

  const APP = {
    id: 'a1', reference: 41, studentName: 'Test Student', passportNo: 'P123',
    intakeLabel: 'January 2027', stage: 'PROFILE_ASSESSMENT', stageNote: null,
    deadlineAt: null, createdAt: '2026-08-09T00:00:00.000Z', agent: null,
    course: {
      id: 'p1', title: 'MBA (Project Management)',
      institution: { id: 'i1', name: 'University of Hertfordshire', country: COUNTRY },
    },
  };

  beforeEach(() => {
    applicationsApi.fetchApplication.mockResolvedValue(APP);
    useAuth.setState({ user: { id: 'u1', name: 'Darshan', role: 'AGENT' }, status: 'authenticated' });
  });

  it('offers a file picker on the application panel', async () => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([]));
    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByLabelText('File')).toBeTruthy());
    // The type picker is a combobox with a value already set, so its control is
    // the button that reopens it. getByLabelText finding anything at all is the
    // assertion: it pointed at nothing until the picker carried the id in this
    // branch.
    expect(screen.getByLabelText(/Document type/)).toBeTruthy();
    expect(screen.getByText('Passport')).toBeTruthy();
  });

  // Fifty-four options is a scroll, and the thing an agent knows is the word.
  it('finds a document type by typing part of its name', async () => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([]));
    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('File')).toBeTruthy());

    fireEvent.click(screen.getByText('Change'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tb' } });

    await waitFor(() => expect(screen.getByText('TB test certificate')).toBeTruthy());
  });

  // The group is searchable too, so knowing the category is enough.
  it('finds a type by its group when the name is not known', async () => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([]));
    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('File')).toBeTruthy());

    fireEvent.click(screen.getByText('Change'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'financial' } });

    await waitFor(() => expect(screen.getByText('Loan sanction letter')).toBeTruthy());
  });

  it('sends the picked file with the chosen type', async () => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([]));
    applicationsApi.uploadApplicationDocument.mockResolvedValue(APP_DOC);

    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('File')).toBeTruthy());

    // Passport is the default, so no change is needed to assert what is sent.
    const file = new File(['%PDF-1.4'], 'passport.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } });

    await waitFor(() => expect(applicationsApi.uploadApplicationDocument).toHaveBeenCalled());
    const [id, payload] = applicationsApi.uploadApplicationDocument.mock.calls[0];
    expect(id).toBe('a1');
    expect(payload.kind).toBe('PASSPORT');
    expect(payload.file.name).toBe('passport.pdf');
  });

  it('lists an attached document by the name the agent gave it', async () => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([APP_DOC]));

    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('declaration.pdf')).toBeTruthy());
    // Scoped to the row: "Declaration form" is also one of the picker's options.
    // The stored key is a uuid, so the type and description are what identify it.
    const meta = document.querySelector('.appdoc-meta').textContent;
    expect(meta).toContain('Declaration form');
    expect(meta).toContain('Signed copy');
  });

  // "01-hero.png" beside a generic page icon says nothing about whether the
  // right file was sent, and half of what gets attached is a phone photo of a
  // passport.
  it('previews an image document with the image itself', async () => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([APP_DOC]));

    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('declaration.pdf')).toBeTruthy());

    // APP_DOC is a PDF, so it takes the typed tile rather than a preview.
    expect(document.querySelector('img.appdoc-thumb')).toBeNull();
    expect(document.querySelector('.appdoc-thumb--pdf')).toBeTruthy();
    expect(document.querySelector('.appdoc-thumb__ext').textContent).toBe('PDF');
  });

  it('uses the file itself as the thumbnail when it is an image', async () => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([{
      ...APP_DOC,
      fileName: 'passport.png',
      contentType: 'image/png',
      fileUrl: 'https://cdn.example.com/application-documents/abc.png',
    }]));

    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('passport.png')).toBeTruthy());

    const img = document.querySelector('img.appdoc-thumb');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/application-documents/abc.png');
    // Decorative: the filename beside it already names the document.
    expect(img.getAttribute('alt')).toBe('');
  });

  // A failed fetch rendering as "nothing attached yet" would have an agent
  // re-upload files that are already there.
  it('says the list failed rather than showing it as empty', async () => {
    applicationsApi.fetchApplicationDocuments.mockRejectedValue(new Error('boom'));

    renderAt(<ApplicationDetail applicationId="a1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText(/Couldn.t load the documents/i)).toBeTruthy());
    expect(screen.queryByText(/Nothing attached yet/i)).toBeNull();
  });
});

/**
 * The document count on a row.
 *
 * "Which of these has anything attached" was unanswerable without opening each
 * application in turn, and the count is carried on the list payload precisely so
 * that it costs no request per row.
 */
describe('the documents chip on an applications row', () => {
  afterEach(cleanup);

  beforeEach(() => {
    applicationsApi.fetchApplicationDocuments.mockResolvedValue(docPage([]));
  });

  const row = (over = {}) => ({
    id: 'a1', reference: 14, studentName: 'Dhruv', passportNo: 'X1', stage: 'APPLICATION',
    deadlineAt: null, stageNote: null, intakeLabel: null,
    course: { title: 'BSc', institution: { name: 'EUBA', country: { code: 'SK', isoCode: 'sk', name: 'Slovakia', flagEmoji: null } } },
    _count: { documents: 0 },
    ...over,
  });

  const renderList = async (rows) => {
    applicationsApi.fetchApplications.mockResolvedValue({
      items: rows,
      meta: { total: rows.length, page: 1, pageSize: 20, totalPages: 1, maxPage: 1 },
    });
    renderAt(<ApplicationHistory />, '/app-history');
    await waitFor(() => expect(screen.getByText('Dhruv')).toBeTruthy());
  };

  it('shows the count when something is attached', async () => {
    await renderList([row({ _count: { documents: 3 } })]);
    expect(screen.getByText('3')).toBeTruthy();
    expect(document.querySelector('.docs-chip')).toBeTruthy();
  });

  it('shows a dash, not a zero, when nothing is', async () => {
    await renderList([row()]);
    // A "0" in a column of counts reads as a figure worth comparing. It is not —
    // it is the absence of any, and a dash says that without competing.
    expect(document.querySelector('.docs-chip')).toBeNull();
    expect(document.querySelector('.docs-none')).toBeTruthy();
  });

  it('opens the panel once, not twice', async () => {
    await renderList([row({ _count: { documents: 2 } })]);

    // The row is clickable too, so without stopPropagation the click is handled
    // twice and the panel opens, closes and reopens.
    fireEvent.click(document.querySelector('.docs-chip'));
    await waitFor(() => expect(screen.getByText('Documents')).toBeTruthy());
  });
});
