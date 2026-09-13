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

/** The strip entry carrying a given word, so a figure is read beside its label. */
const kpi = (label) => screen.getByText(label).closest('.pdash-kpi');

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
    await waitFor(() => expect(kpi('active')).toBeTruthy());
    // 16 filed in total, 4 approved.
    expect(within(kpi('active')).getByText('12')).toBeTruthy();
  });

  it('adds conditional and unconditional into one offers figure', async () => {
    renderDash();
    await waitFor(() => expect(kpi('offers')).toBeTruthy());
    expect(within(kpi('offers')).getByText('3')).toBeTruthy();
  });

  it('reports approved visas on their own', async () => {
    renderDash();
    await waitFor(() => expect(kpi('visas approved')).toBeTruthy());
    expect(within(kpi('visas approved')).getByText('4')).toBeTruthy();
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

  it('tells you how late a deadline is, in the row', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Srushti')).toBeTruthy());
    expect(screen.getByText('3d overdue')).toBeTruthy();
  });

  // An empty panel takes the same room as a full one and pays nothing back.
  it('renders no activity panel when there is no activity', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Your applications')).toBeTruthy());
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
    await waitFor(() => expect(kpi('due this week')).toBeTruthy());
    expect(within(kpi('due this week')).getByText('2')).toBeTruthy();
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
    await waitFor(() => expect(kpi('visas approved')).toBeTruthy());

    expect(kpi('visas approved').getAttribute('href')).toBe('/partner/app-history?stage=VISA_APPROVAL');
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
    expect(document.querySelectorAll('.pdash-kpi')).toHaveLength(0);
  });
});
