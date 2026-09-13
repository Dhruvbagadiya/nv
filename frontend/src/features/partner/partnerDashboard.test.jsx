import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/referenceScreens.js', () => ({ fetchReportSummary: vi.fn() }));
vi.mock('../../api/applications.js', () => ({ fetchApplications: vi.fn() }));
vi.mock('../../api/auth.js', () => ({ login: vi.fn(), refresh: vi.fn(), logout: vi.fn() }));

const refApi = await import('../../api/referenceScreens.js');
const appsApi = await import('../../api/applications.js');
const { useAuth } = await import('../../store/useAuth.js');
const PartnerDashboard = (await import('./PartnerDashboard.jsx')).default;

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

const SUMMARY = (over = {}) => ({
  applications: {
    PROFILE_ASSESSMENT: 3, APPLICATION: 5, CONDITIONAL_OFFER: 2, UNCONDITIONAL_OFFER: 1,
    FEES_PAYMENT: 0, CAS_LETTER: 0, VISA_APPLICATION: 1, VISA_APPROVAL: 4,
  },
  courseInquiries: {},
  trending: [],
  deadlines: [],
  usefulInformation: [],
  recentNotifications: [],
  byCountry: [],
  topCourses: [],
  monthly: { thisMonth: 0, lastMonth: 0 },
  awaitingDocuments: 0,
  recentInquiries: [],
  ...over,
});

function renderDash() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><PartnerDashboard /></MemoryRouter>
    </QueryClientProvider>
  );
}

/** The tile carrying a given label, so a figure is read beside the word it belongs to. */
const kpi = (label) => screen.getByText(label).closest('.pdash-tile');

const APPS = [
  {
    id: 'a1', reference: 14, studentName: 'Dhruv', stage: 'PROFILE_ASSESSMENT', deadlineAt: null,
    course: { institution: { name: 'NEW VANTAGE', country: { code: 'SG', isoCode: 'sg' } } },
  },
  {
    id: 'a2', reference: 13, studentName: 'Srushti', stage: 'APPLICATION', deadlineAt: day(-3),
    course: { institution: { name: 'EUBA', country: { code: 'SK', isoCode: 'sk' } } },
  },
];

/**
 * /partner/dashboard was the course finder — a search box and 93,000 programmes
 * under a heading that said Dashboard. This is the summary that replaced it, and
 * what is worth pinning is the arithmetic: every figure is derived from one
 * payload, and a wrong one here is a number an agent would act on.
 */
describe('PartnerDashboard', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAuth.setState({ user: { id: 'u1', name: 'Darshan', role: 'AGENT' }, status: 'authenticated' });
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY());
    appsApi.fetchApplications.mockResolvedValue({ items: APPS, meta: {} });
  });

  // An agent's working set is what is still moving. A total that only ever grows
  // is not a workload, so the finished ones come out.
  it('counts active applications as everything not yet approved', async () => {
    renderDash();
    await waitFor(() => expect(kpi('In progress')).toBeTruthy());
    // 16 filed in total, 4 approved.
    expect(within(kpi('In progress')).getByText('12')).toBeTruthy();
  });

  it('adds conditional and unconditional into one offers figure', async () => {
    renderDash();
    await waitFor(() => expect(kpi('Offers received')).toBeTruthy());
    expect(within(kpi('Offers received')).getByText('3')).toBeTruthy();
  });

  it('reports approved visas on their own', async () => {
    renderDash();
    await waitFor(() => expect(kpi('Visas approved')).toBeTruthy());
    expect(within(kpi('Visas approved')).getByText('4')).toBeTruthy();
  });

  // The point of the rewrite: with three applications, the three applications
  // are more use than a count of them.
  it('leads with the applications themselves, not counts of them', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Dhruv')).toBeTruthy());

    expect(screen.getByText('NEW VANTAGE')).toBeTruthy();
    expect(screen.getByText('#14')).toBeTruthy();
    // Scoped to the row: the pipeline legend names the stages too.
    const row = screen.getByText('Dhruv').closest('tr');
    expect(within(row).getByText('Profile Assessment')).toBeTruthy();
  });

  // new Date(null) is the epoch rather than an Invalid Date, so a row with no
  // deadline read "20710d overdue" — measured from 1970.
  it('shows no deadline as a dash, not as decades overdue', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Dhruv')).toBeTruthy());

    const row = screen.getByText('Dhruv').closest('tr');
    expect(within(row).getByText('—')).toBeTruthy();
    expect(within(row).queryByText(/overdue/)).toBeNull();
  });

  // A null deadline must not be counted as urgent either.
  it('does not count an absent deadline as due this week', async () => {
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY({
      deadlines: [{ id: 'd1', studentName: 'A', deadlineAt: null, course: null }],
    }));

    renderDash();
    await waitFor(() => expect(kpi('Due this week')).toBeTruthy());
    expect(within(kpi('Due this week')).getByText('0')).toBeTruthy();
  });

  it('tells you how late a deadline is, in the row', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Srushti')).toBeTruthy());
    expect(screen.getByText('3d overdue')).toBeTruthy();
  });

  // An empty panel takes the same room as a full one and pays nothing back.
  it('renders no activity panel when there is no activity', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Recent applications')).toBeTruthy());
    expect(screen.queryByText('Recent activity')).toBeNull();
  });

  it('offers a way to start when there are no applications at all', async () => {
    appsApi.fetchApplications.mockResolvedValue({ items: [], meta: {} });

    renderDash();
    await waitFor(() => expect(screen.getByText('No applications yet.')).toBeTruthy());
    expect(screen.getByText('Add your first application')).toBeTruthy();
  });

  // The point of the tile is urgency, so it counts the ones inside a week —
  // including the ones already past, which are the most urgent of all.
  it('counts only deadlines within a week, overdue included', async () => {
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY({
      deadlines: [
        { id: 'd1', studentName: 'A', deadlineAt: day(-2), course: null },
        { id: 'd2', studentName: 'B', deadlineAt: day(3), course: null },
        { id: 'd3', studentName: 'C', deadlineAt: day(40), course: null },
      ],
    }));

    renderDash();
    await waitFor(() => expect(kpi('Due this week')).toBeTruthy());
    expect(within(kpi('Due this week')).getByText('2')).toBeTruthy();
  });

  // Eight segments, six of them zero-width, is a bar that describes nothing.
  it('draws a pipeline segment only for the stages carrying work', async () => {
    renderDash();
    await waitFor(() => expect(document.querySelector('.pdash-bar')).toBeTruthy());
    // Six of the eight stages carry work in this fixture; the two empty ones
    // get no segment at all.
    expect(document.querySelectorAll('.pdash-bar__seg')).toHaveLength(6);
  });

  it('makes every figure a way into the list behind it', async () => {
    renderDash();
    await waitFor(() => expect(kpi('Visas approved')).toBeTruthy());

    expect(kpi('Visas approved').getAttribute('href')).toBe('/partner/app-history?stage=VISA_APPROVAL');
  });

  // Every panel below the tiles disappears when it has nothing behind it, and
  // each one is a separate `length > 0` in the component — so each is checked.
  it('renders no breakdown, no top courses and no inquiries when there are none', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Recent applications')).toBeTruthy());

    expect(screen.queryByText('By destination')).toBeNull();
    expect(screen.queryByText('Most applied courses')).toBeNull();
    expect(screen.queryByText('Recent inquiries')).toBeNull();
    expect(screen.queryByText('Upcoming deadlines')).toBeNull();
  });

  it('ranks destinations by volume and labels every bar with its figure', async () => {
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY({
      // Deliberately not pre-sorted: the ordering is the service's job, and the
      // component renders what it is given rather than re-sorting.
      byCountry: [
        { id: 'uk', code: 'UK', name: 'United Kingdom', isoCode: 'gb', count: 9 },
        { id: 'ca', code: 'CA', name: 'Canada', isoCode: 'ca', count: 3 },
      ],
    }));

    renderDash();
    await waitFor(() => expect(screen.getByText('By destination')).toBeTruthy());

    const rows = document.querySelectorAll('.pdash-bars li');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('United Kingdom')).toBeTruthy();
    expect(within(rows[0]).getByText('9')).toBeTruthy();
    // The largest is full width; the rest are a share of it.
    expect(rows[0].querySelector('.pdash-bars__fill').style.width).toBe('100%');
  });

  // A row present in the data with an invisible bar reads as a rendering fault
  // rather than as a small number.
  it('gives a tiny share a bar you can still see', async () => {
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY({
      byCountry: [
        { id: 'uk', code: 'UK', name: 'United Kingdom', isoCode: 'gb', count: 400 },
        { id: 'ca', code: 'CA', name: 'Canada', isoCode: 'ca', count: 1 },
      ],
    }));

    renderDash();
    await waitFor(() => expect(screen.getByText('By destination')).toBeTruthy());

    const fills = document.querySelectorAll('.pdash-bars__fill');
    expect(parseFloat(fills[1].style.width)).toBeGreaterThanOrEqual(4);
  });

  it('compares this month with last, and says nothing in a partner\'s first month', async () => {
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY({ monthly: { thisMonth: 6, lastMonth: 4 } }));
    renderDash();
    await waitFor(() => expect(screen.getByText(/50% on last month/)).toBeTruthy());

    cleanup();
    // No history to compare against — a "+600%" off a base of zero is not a
    // trend, it is a division by nothing.
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY({ monthly: { thisMonth: 6, lastMonth: 0 } }));
    renderDash();
    await waitFor(() => expect(screen.getByText('Total applications')).toBeTruthy());
    expect(screen.queryByText(/on last month/)).toBeNull();
  });

  // A dashboard that renders zeroes when the request failed is worse than one
  // that says so: the numbers look like an answer.
  it('says the load failed rather than showing zeroes', async () => {
    refApi.fetchReportSummary.mockRejectedValue(new Error('boom'));

    renderDash();

    // Asserted on the retry and the absence of figures rather than on the
    // wording: errorMessage() prefers the error's own message to the fallback,
    // so the heading is whatever the failure said. What matters is that no
    // number is rendered, because a zero looks like an answer.
    await waitFor(() => expect(screen.getByText('Try again')).toBeTruthy());
    expect(document.querySelectorAll('.pdash-tile')).toHaveLength(0);
  });
});
