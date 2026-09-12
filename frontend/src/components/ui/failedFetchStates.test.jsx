import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/institutions.js', () => ({ fetchInstitutions: vi.fn() }));
vi.mock('../../api/notifications.js', () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const institutionsApi = await import('../../api/institutions.js');
const notificationsApi = await import('../../api/notifications.js');
const InstitutionPicker = (await import('./InstitutionPicker.jsx')).default;
const NotificationDropdown = (await import('../layout/NotificationDropdown.jsx')).default;

/**
 * A failed request rendered the same tidy empty state as a genuine zero result.
 * "You're all caught up", "No institutions found" — the user is told a fact, not
 * shown a failure, and there is nothing to retry. The notifications panel is the
 * worst of them: it sits in the header of every partner and admin page.
 */
function renderIn(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('a failed fetch does not render as an empty result', () => {
  afterEach(cleanup);

  describe('NotificationDropdown', () => {
    beforeEach(() => {
      notificationsApi.fetchUnreadCount.mockResolvedValue({ unread: 0 });
    });

    it('says the load failed instead of "all caught up"', async () => {
      notificationsApi.fetchNotifications.mockRejectedValue(new Error('boom'));

      renderIn(<NotificationDropdown />);
      fireEvent.click(screen.getByRole('button', { name: /notification/i }));

      await waitFor(() => expect(screen.getByText(/Couldn’t load notifications/i)).toBeTruthy());
      expect(screen.queryByText(/all caught up/i)).toBeNull();
    });

    it('still says "all caught up" on a genuine zero', async () => {
      notificationsApi.fetchNotifications.mockResolvedValue({ items: [] });

      renderIn(<NotificationDropdown />);
      fireEvent.click(screen.getByRole('button', { name: /notification/i }));

      await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeTruthy());
    });
  });

  describe('InstitutionPicker', () => {
    it('says the search failed instead of "none found"', async () => {
      institutionsApi.fetchInstitutions.mockRejectedValue(new Error('boom'));

      renderIn(<InstitutionPicker value="" onChange={() => {}} />);
      // The picker is a combobox; the list opens on focus.
      fireEvent.focus(screen.getByRole('combobox'));

      await waitFor(() => expect(screen.getByText(/Search failed/i)).toBeTruthy());
    });

    // Reading "not found" off a failed search is how a duplicate institution
    // gets created.
    it('reports no matches when the search genuinely returns none', async () => {
      institutionsApi.fetchInstitutions.mockResolvedValue([]);

      renderIn(<InstitutionPicker value="" onChange={() => {}} />);
      fireEvent.focus(screen.getByRole('combobox'));

      await waitFor(() => expect(institutionsApi.fetchInstitutions).toHaveBeenCalled());
      expect(screen.queryByText(/Search failed/i)).toBeNull();
    });
  });
});
