import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/referenceScreens.js', () => ({ fetchReportSummary: vi.fn() }));
vi.mock('../../api/auth.js', () => ({ login: vi.fn(), refresh: vi.fn(), logout: vi.fn() }));

const refApi = await import('../../api/referenceScreens.js');
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

/** The card carrying a given label, so a number is read from its own tile. */
const card = (label) => screen.getByText(label).closest('.pdash-stat');

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
  });

  // An agent's working set is what is still moving. A total that only ever grows
  // is not a workload, so the finished ones come out.
  it('counts active applications as everything not yet approved', async () => {
    renderDash();
    await waitFor(() => expect(card('Active applications')).toBeTruthy());

    // 16 filed in total, 4 approved.
    expect(within(card('Active applications')).getByText('12')).toBeTruthy();
    expect(within(card('Active applications')).getByText(/16 all time/)).toBeTruthy();
  });

  it('adds conditional and unconditional into one offers figure', async () => {
    renderDash();
    await waitFor(() => expect(card('Offers in hand')).toBeTruthy());
    expect(within(card('Offers in hand')).getByText('3')).toBeTruthy();
  });

  it('reports approved visas on their own', async () => {
    renderDash();
    await waitFor(() => expect(card('Visas approved')).toBeTruthy());
    expect(within(card('Visas approved')).getByText('4')).toBeTruthy();
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
    await waitFor(() => expect(card('Deadlines this week')).toBeTruthy());

    expect(within(card('Deadlines this week')).getByText('2')).toBeTruthy();
    expect(within(card('Deadlines this week')).getByText(/3 upcoming in total/)).toBeTruthy();
  });

  it('says how overdue a deadline is, not just its date', async () => {
    refApi.fetchReportSummary.mockResolvedValue(SUMMARY({
      deadlines: [{ id: 'd1', studentName: 'Late Student', deadlineAt: day(-3), course: null }],
    }));

    renderDash();
    await waitFor(() => expect(screen.getByText('Late Student')).toBeTruthy());
    expect(screen.getByText('3d overdue')).toBeTruthy();
  });

  it('renders every pipeline stage, including the empty ones', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByText('Pipeline')).toBeTruthy());

    // Eight stages, and a stage with nothing in it still appears — where work is
    // NOT sitting is part of the shape.
    expect(document.querySelectorAll('.pdash-stage')).toHaveLength(8);
    expect(document.querySelectorAll('.pdash-stage--empty')).toHaveLength(2);
  });

  it('makes every figure a way into the list behind it', async () => {
    renderDash();
    await waitFor(() => expect(card('Visas approved')).toBeTruthy());

    expect(card('Visas approved').getAttribute('href')).toBe('/partner/app-history?stage=VISA_APPROVAL');
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
    expect(screen.queryByText('Active applications')).toBeNull();
    expect(document.querySelectorAll('.pdash-stat')).toHaveLength(0);
  });
});
