import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/notifications.js', () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const api = await import('../../api/notifications.js');
const NotificationsPage = (await import('./NotificationsPage.jsx')).default;

const page = (items, over = {}) => ({
  items,
  meta: { total: items.length, page: 1, pageSize: 20, totalPages: 1, maxPage: 1, ...over },
});

const ROWS = [
  { id: 'n1', kind: 'NEW_APPLICATION', title: 'POEC #14', body: 'New application', readAt: null, createdAt: '2026-09-12T10:00:00Z', applicationId: 'a1' },
  { id: 'n2', kind: 'STAGE_CHANGE', title: 'POEC #13', body: 'Moved on', readAt: '2026-09-11T10:00:00Z', createdAt: '2026-09-11T09:00:00Z', applicationId: 'a2' },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><NotificationsPage /></MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * The bell dropdown asks for ten rows and has no way to reach an eleventh, so
 * everything older than your last ten events was written to the database and
 * then unreachable. This screen is the call to the page parameter that already
 * existed on the API.
 */
describe('NotificationsPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    api.fetchNotifications.mockResolvedValue(page(ROWS));
    api.fetchUnreadCount.mockResolvedValue(1);
    api.markNotificationRead.mockResolvedValue({});
    api.markAllNotificationsRead.mockResolvedValue({ updated: 1 });
  });

  it('shows read and unread together, and distinguishes them', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('POEC #14')).toBeTruthy());

    // The unread one offers the control; the read one says so instead.
    const unread = screen.getByText('POEC #14').closest('.notif-row');
    const read = screen.getByText('POEC #13').closest('.notif-row');
    expect(within(unread).getByText('Mark read')).toBeTruthy();
    expect(within(read).getByText('Read')).toBeTruthy();
    expect(read.className).toContain('notif-row--read');
  });

  it('marks one read through an explicit control, not by touching the row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Mark read')).toBeTruthy());

    // Clicking the row itself must do nothing: on this page there is nowhere to
    // navigate, so read-on-click would silently lose track of what you had not
    // read yet.
    fireEvent.click(screen.getByText('POEC #14'));
    expect(api.markNotificationRead).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Mark read'));
    // The first ARGUMENT, not the whole call: react-query v5 passes a mutation
    // context as a second argument, so `toHaveBeenCalledWith('n1')` fails
    // against a spy that really was called with 'n1'.
    await waitFor(() => expect(api.markNotificationRead.mock.calls[0]?.[0]).toBe('n1'));
  });

  it('asks the server for unread only, rather than filtering the page in hand', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Unread only/)).toBeTruthy());

    fireEvent.click(screen.getByText(/Unread only/));

    // Filtering client-side would only ever search the twenty rows already
    // fetched, so "unread only" would miss unread items on page 2.
    await waitFor(() =>
      expect(api.fetchNotifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ unreadOnly: true, page: 1 })
      )
    );
  });

  it('disables mark-all when there is nothing unread', async () => {
    api.fetchUnreadCount.mockResolvedValue(0);
    renderPage();
    await waitFor(() => expect(screen.getByText('Mark all read')).toBeTruthy());

    expect(screen.getByText('Mark all read').disabled).toBe(true);
  });

  // A failed request rendering an empty list is indistinguishable from having no
  // notifications — the defect the dropdown shipped with.
  it('says the load failed rather than showing an empty inbox', async () => {
    api.fetchNotifications.mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Try again')).toBeTruthy());
    expect(screen.queryByText('No notifications yet.')).toBeNull();
  });

  it('reaches page two', async () => {
    api.fetchNotifications.mockResolvedValue(page(ROWS, { total: 45, totalPages: 3, maxPage: 3 }));
    renderPage();
    await waitFor(() => expect(screen.getByText('2')).toBeTruthy());

    fireEvent.click(screen.getByText('2'));

    await waitFor(() =>
      expect(api.fetchNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );
  });
});
