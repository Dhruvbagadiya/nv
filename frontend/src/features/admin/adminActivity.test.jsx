import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/admin.js', () => ({ fetchActivity: vi.fn(), fetchAgentSummary: vi.fn() }));

const api = await import('../../api/admin.js');
const AdminActivity = (await import('./AdminActivity.jsx')).default;

const EVENTS = [
  { id: 'application:a1', type: 'APPLICATION', createdAt: '2026-09-12T10:00:00Z', actor: { id: 'u1', name: 'Alpha Edu' }, title: 'Filed application #14', subject: 'Dhruv', detail: 'EUBA', applicationId: 'a1' },
  { id: 'document:d1', type: 'DOCUMENT', createdAt: '2026-09-11T10:00:00Z', actor: { id: 'u2', name: 'Beta Edu' }, title: 'Uploaded passport.pdf', subject: 'Srushti', detail: 'Application #13', applicationId: 'a2' },
];
const AGENTS = [
  { id: 'u1', name: 'Alpha Edu', email: 'a@x.com', applications: 9, inquiries: 2, lastActiveAt: '2026-09-12T10:00:00Z' },
  { id: 'u2', name: 'Beta Edu', email: 'b@x.com', applications: 0, inquiries: 0, lastActiveAt: null },
];

const feed = (items, over = {}) => ({
  items,
  meta: { total: items.length, page: 1, pageSize: 20, totalPages: 1, maxPage: 1, ...over },
});

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminActivity /></MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * The screen that looks most like an audit log and is not one. There is no audit
 * table in this schema — nothing records a login, an edit or a deletion — so the
 * one thing worth pinning beyond the wiring is that the empty state SAYS what it
 * is built from. An empty feed on a page titled "activity" otherwise reads as
 * "nobody did anything" rather than "this only tracks three things".
 */
describe('AdminActivity', () => {
  afterEach(cleanup);

  beforeEach(() => {
    api.fetchActivity.mockResolvedValue(feed(EVENTS));
    api.fetchAgentSummary.mockResolvedValue(AGENTS);
  });

  it('shows who did what, across agencies', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Filed application #14')).toBeTruthy());

    expect(screen.getByText(/Alpha Edu · Dhruv · EUBA/)).toBeTruthy();
    expect(screen.getByText('Uploaded passport.pdf')).toBeTruthy();
  });

  it('narrows the feed to one agency server-side, and clears on a second click', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('9')).toBeTruthy());

    fireEvent.click(screen.getByText('9').closest('button'));

    // Server-side: filtering the fetched page would only ever search the twenty
    // rows in hand, so an agency's older events would be invisible.
    await waitFor(() =>
      expect(api.fetchActivity).toHaveBeenLastCalledWith(expect.objectContaining({ agentId: 'u1', page: 1 }))
    );

    fireEvent.click(screen.getByText('9').closest('button'));
    await waitFor(() => {
      const last = api.fetchActivity.mock.calls.at(-1)[0];
      expect(last.agentId).toBeUndefined();
    });
  });

  it('keeps an agency that has filed nothing — those are the ones worth calling', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Beta Edu')).toBeTruthy());
    expect(screen.getByText('Nothing filed yet')).toBeTruthy();
  });

  it('says what the feed is built from when it is empty', async () => {
    api.fetchActivity.mockResolvedValue(feed([]));
    renderScreen();

    await waitFor(() => expect(screen.getByText('No activity recorded.')).toBeTruthy());
    expect(screen.getByText(/Edits and sign-ins are not recorded/)).toBeTruthy();
  });

  it('says the feed failed rather than showing it as empty', async () => {
    api.fetchActivity.mockRejectedValue(new Error('boom'));
    renderScreen();

    await waitFor(() => expect(screen.getByText('Try again')).toBeTruthy());
    expect(screen.queryByText('No activity recorded.')).toBeNull();
  });

  // The two queries are independent, and the roster failing must not take the
  // feed down with it.
  it('still shows the feed when the agency list fails', async () => {
    api.fetchAgentSummary.mockRejectedValue(new Error('boom'));
    renderScreen();

    await waitFor(() => expect(screen.getByText('Filed application #14')).toBeTruthy());
    expect(screen.getByText(/Couldn’t load the agency list/)).toBeTruthy();
  });
});
