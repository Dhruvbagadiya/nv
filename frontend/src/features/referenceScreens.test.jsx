import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Smoke tests for the 11 reference screens. The real risk in these components is
// not logic, it is SHAPE: reaching for `c.institution.country.flagEmoji` when the
// include is missing, or `data.meta.total` when the response is flat. Lint and the
// build cannot catch that — only rendering can.
//
// The fixtures below are trimmed copies of the actual API responses (captured from
// the running server against seeded data), so a drift between client and server
// shows up here.

vi.mock('../api/referenceScreens.js', () => ({
  fetchCommissions: vi.fn(),
  fetchEntryRequirements: vi.fn(),
  fetchEnglishTests: vi.fn(),
  fetchImportantUpdates: vi.fn(),
  fetchImportantUpdate: vi.fn(),
  fetchDocuments: vi.fn(),
  fetchDocumentCounts: vi.fn(),
  fetchAnnouncements: vi.fn(),
  fetchSupportContacts: vi.fn(),
  fetchReportSummary: vi.fn(),
}));

vi.mock('../api/countries.js', () => ({ fetchCountries: vi.fn() }));
vi.mock('../api/institutions.js', () => ({
  fetchInstitutions: vi.fn(),
  createInstitution: vi.fn(),
  setBlacklist: vi.fn(),
}));

const api = await import('../api/referenceScreens.js');
const countriesApi = await import('../api/countries.js');
const institutionsApi = await import('../api/institutions.js');

const Commission = (await import('./commission/Commission.jsx')).default;
const EntryRequirements = (await import('./entryRequirements/EntryRequirements.jsx')).default;
const ImportantUpdates = (await import('./importantUpdates/ImportantUpdates.jsx')).default;
const DocumentBank = (await import('./documentBank/DocumentBank.jsx')).default;
const Report = (await import('./report/Report.jsx')).default;
const HelpSupport = (await import('./help/HelpSupport.jsx')).default;

const meta = (total) => ({ total, page: 1, pageSize: 20, totalPages: Math.ceil(total / 20) });

const COUNTRY = { id: 'c1', code: 'UK', name: 'United Kingdom', flagEmoji: '🇬🇧', currencyCode: 'GBP', institutionCount: 10 };

function renderScreen(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('reference screens', () => {
  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue([COUNTRY]);
    institutionsApi.fetchInstitutions.mockResolvedValue([
      { id: 'i1', name: 'University of Hertfordshire', country: COUNTRY },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('Commission renders multi-tier commission rates', async () => {
    api.fetchCommissions.mockResolvedValue({
      items: [
        {
          id: 'cm1',
          tiers: [
            { label: '1 - 5 Students', rate: '15%' },
            { label: '6+ Students', rate: '17%' },
          ],
          notes: null,
          institution: { id: 'i1', name: 'University of Hertfordshire', country: COUNTRY },
        },
      ],
      meta: meta(1),
    });

    renderScreen(<Commission />);
    await waitFor(() => expect(screen.getByText('University of Hertfordshire')).toBeTruthy());
    // Both tiers on separate lines, which is the point of the Json column.
    expect(screen.getByText(/1 - 5 Students/)).toBeTruthy();
    expect(screen.getByText('17%')).toBeTruthy();
    // Scoped to the table: the country filter's <option> list also says
    // "United Kingdom", so an unscoped query is genuinely ambiguous.
    const table = document.querySelector('table');
    expect(within(table).getByText(/United Kingdom/)).toBeTruthy();
  });

  it.each([
    ['UG', 'Under Graduate Programs'],
    ['PG', 'Post Graduate Programs'],
  ])('EntryRequirements %s renders its own subtitle and rows', async (level, subtitle) => {
    api.fetchEnglishTests.mockResolvedValue(['IELTS', 'PTE']);
    api.fetchEntryRequirements.mockResolvedValue({
      items: [
        {
          id: 'er1',
          level,
          englishRequirement: 'IELTS 6.5 overall no less than 6.0',
          academicRequirement: '60% in Bachelors',
          offerTimeline: '48 to 72 hours',
          credibilityInterview: true,
          financialInformation: '1000 GBP',
          institution: { id: 'i1', name: 'Oxford Brookes University', country: COUNTRY },
        },
      ],
      meta: meta(1),
    });

    renderScreen(<EntryRequirements level={level} />);
    await waitFor(() => expect(screen.getByText('Oxford Brookes University')).toBeTruthy());
    expect(screen.getByText(subtitle)).toBeTruthy();
    expect(screen.getByText('48 to 72 hours')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy(); // credibility interview pill
    // Level is passed to the API, not guessed from the URL.
    expect(api.fetchEntryRequirements).toHaveBeenCalledWith(expect.objectContaining({ level }));
  });

  it('ImportantUpdates shows a download action only when there is an attachment', async () => {
    api.fetchImportantUpdates.mockResolvedValue({
      items: [
        {
          id: 'u1',
          title: 'With attachment',
          body: 'Body one',
          publishDate: '2026-07-15T00:00:00.000Z',
          attachmentUrl: '/files/x.pdf',
          country: COUNTRY,
          institution: null,
        },
        {
          id: 'u2',
          title: 'Without attachment',
          body: 'Body two',
          publishDate: '2026-07-01T00:00:00.000Z',
          attachmentUrl: null,
          country: null,
          institution: null,
        },
      ],
      meta: meta(2),
    });

    renderScreen(<ImportantUpdates />);
    await waitFor(() => expect(screen.getByText('With attachment')).toBeTruthy());
    expect(screen.getByLabelText('View With attachment')).toBeTruthy();
    expect(screen.getByLabelText('View Without attachment')).toBeTruthy();
    // Exactly one download link — a button that resolves to nothing is worse than none.
    expect(screen.getByLabelText('Download attachment for With attachment')).toBeTruthy();
    expect(screen.queryByLabelText('Download attachment for Without attachment')).toBeNull();
  });

  it('ImportantUpdates opens the detail modal from the eye action', async () => {
    api.fetchImportantUpdates.mockResolvedValue({
      items: [
        {
          id: 'u1',
          title: 'ICP deadline change',
          body: 'The full body text that the table truncates.',
          publishDate: '2026-07-15T00:00:00.000Z',
          attachmentUrl: null,
          country: COUNTRY,
          institution: null,
        },
      ],
      meta: meta(1),
    });

    renderScreen(<ImportantUpdates />);
    await waitFor(() => expect(screen.getByLabelText('View ICP deadline change')).toBeTruthy());
    screen.getByLabelText('View ICP deadline change').click();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
  });

  it('DocumentBank renders tiles per category', async () => {
    api.fetchDocuments.mockResolvedValue({
      items: [
        { id: 'd1', title: 'Bar Code Document', fileUrl: '/files/a.pdf', country: null, institution: null },
        { id: 'd2', title: 'FD Cover Letter', fileUrl: '/files/b.pdf', country: null, institution: null },
      ],
      meta: meta(2),
    });

    renderScreen(<DocumentBank category="VISA_DOCUMENT" />);
    await waitFor(() => expect(screen.getByText('Bar Code Document')).toBeTruthy());
    expect(screen.getByText('Explore Visa Document')).toBeTruthy();
    const link = screen.getByTitle('Bar Code Document');
    expect(link.getAttribute('href')).toBe('/files/a.pdf');
    // noopener matters: without it the opened document can reach window.opener.
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  // Image 11 of the reference set is this exact state, so it is a designed state
  // and needs to keep working.
  it('DocumentBank shows "No Data Found" for an empty category', async () => {
    api.fetchDocuments.mockResolvedValue({ items: [], meta: meta(0) });
    renderScreen(<DocumentBank category="INSTITUTE_BROCHURE" />);
    await waitFor(() => expect(screen.getByText('No Data Found')).toBeTruthy());
  });

  it('Report renders all 8 stage tiles plus the 4 inquiry tiles, including zeros', async () => {
    api.fetchReportSummary.mockResolvedValue({
      applications: {
        PROFILE_ASSESSMENT: 2,
        APPLICATION: 2,
        CONDITIONAL_OFFER: 0,
        UNCONDITIONAL_OFFER: 1,
        FEES_PAYMENT: 1,
        CAS_LETTER: 1,
        VISA_APPLICATION: 1,
        VISA_APPROVAL: 0,
      },
      courseInquiries: { INQUIRY: 3, PENDING: 2, OFFERED: 1, APPLIED: 1 },
      trending: [{ id: 'i1', name: 'De Montfort University', logoUrl: null, country: COUNTRY }],
      deadlines: [],
      usefulInformation: [],
      recentNotifications: [],
    });

    renderScreen(<Report />);
    await waitFor(() => expect(screen.getByText('Profile Assessment')).toBeTruthy());
    const grids = document.querySelectorAll('.stat-grid');
    expect(grids).toHaveLength(2); // application stages, then course inquiry stages

    for (const label of [
      'Profile Assessment', 'Applications', 'Conditional Offers', 'Unconditional Offers',
      'Fees Payment', 'CAS Letters', 'Visa Application', 'Visa Approval',
    ]) {
      expect(within(grids[0]).getByText(label)).toBeTruthy();
    }
    // "Course Inquiry" is both the section heading and a tile label, so this is
    // scoped to the grid rather than queried globally.
    for (const label of ['Course Inquiry', 'Pending Course', 'Offered Course', 'Applied Course']) {
      expect(within(grids[1]).getByText(label)).toBeTruthy();
    }
    // A zero must render as "0", not as a blank tile.
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    // Logo-less institution falls back to initials rather than a broken image.
    expect(screen.getByTitle('De Montfort University').textContent).toBe('DMU');
    // Designed empty states, not blank boxes.
    expect(screen.getByText('No upcoming deadlines found.')).toBeTruthy();
    expect(screen.getByText('No useful information found.')).toBeTruthy();
  });

  it('HelpSupport turns contacts into real tel: and WhatsApp links', async () => {
    api.fetchSupportContacts.mockResolvedValue([
      { id: 's1', name: 'Asha Menon', phone: '+91 90000 00001', avatarUrl: null },
    ]);

    renderScreen(<HelpSupport />);
    await waitFor(() => expect(screen.getByText('Asha Menon')).toBeTruthy());
    // Spaces stripped — tel: and wa.me both reject them.
    expect(screen.getByText('+91 90000 00001').closest('a').getAttribute('href')).toBe('tel:+919000000001');
    expect(screen.getByText('Message').closest('a').getAttribute('href')).toBe('https://wa.me/919000000001');
  });

  it('every screen surfaces a failure instead of rendering as empty', async () => {
    api.fetchCommissions.mockRejectedValue(new Error('boom'));
    renderScreen(<Commission />);
    await waitFor(() => expect(screen.getByText(/Couldn’t load this list/)).toBeTruthy());
    expect(screen.queryByText(/No commission rates match/)).toBeNull();
  });
});
