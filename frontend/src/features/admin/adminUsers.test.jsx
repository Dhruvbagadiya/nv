import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/admin.js', () => ({
  fetchAllUsers: vi.fn(),
  createUser: vi.fn(),
  fetchUserDetail: vi.fn(),
  updateUserAdmin: vi.fn(),
  setUserActive: vi.fn(),
  revokeUserSessions: vi.fn(),
  adminResetPassword: vi.fn(),
}));

const api = await import('../../api/admin.js');
const AdminUsers = (await import('./AdminUsers.jsx')).default;

const USERS = [
  { id: 'u1', name: 'Darshan Limbani', email: 'darshanlimbanib@gmail.com', role: 'SUPER_ADMIN', isActive: true, createdAt: '2026-08-16T00:00:00Z', parentAgentId: null, _count: { applications: 4, subAgents: 0 } },
  { id: 'u2', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN', isActive: true, createdAt: '2026-08-16T00:00:00Z', parentAgentId: null, _count: { applications: 0, subAgents: 0 } },
];

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminUsers /></MemoryRouter>
    </QueryClientProvider>
  );
}

const openCreate = async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText('Create user')).toBeTruthy());
  fireEvent.click(screen.getByText('Create user'));
  await waitFor(() => expect(screen.getByLabelText('Full name *')).toBeTruthy());
};

/**
 * There is one Super Admin and there is meant to stay one — it is the account
 * that can create users, change any role and reset anyone's password.
 *
 * The enforcement is in auth.schemas.js, not here: this route takes a JSON body
 * and only the thing that reads the body can refuse it. What this file pins is
 * that the screen agrees — and, more usefully, the two places where "remove the
 * option" quietly breaks something else.
 */
describe('AdminUsers', () => {
  afterEach(cleanup);

  beforeEach(() => {
    api.fetchAllUsers.mockResolvedValue({
      items: USERS,
      meta: { total: 2, page: 1, pageSize: 20, totalPages: 1, maxPage: 1 },
    });
    api.createUser.mockResolvedValue({ id: 'u3' });
    api.fetchUserDetail.mockResolvedValue(USERS[0]);
    api.updateUserAdmin.mockResolvedValue(USERS[0]);
  });

  it('does not offer Super Admin when creating a user', async () => {
    await openCreate();

    const roles = within(screen.getByLabelText('Role *')).queryAllByRole('option');
    expect(roles.map((o) => o.textContent)).toEqual(['Admin', 'Agent', 'Student']);
  });

  // Dropping SUPER_ADMIN from the shared list would take it out of the filter
  // too, and the one account that holds it would become unfindable.
  it('still offers Super Admin as a filter, so the one account is findable', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Darshan Limbani')).toBeTruthy());

    const filter = screen.getByLabelText(/Role/i, { selector: 'select' });
    expect(within(filter).queryAllByRole('option').map((o) => o.textContent))
      .toContain('Super Admin');
  });

  // …and out of ROLE_LABEL, so the badge would render the raw enum.
  it('still labels the existing Super Admin properly', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Super Admin')).toBeTruthy());
    expect(screen.queryByText('SUPER_ADMIN')).toBeNull();
  });

  describe('the create form', () => {
    it('refuses to submit while the two passwords disagree', async () => {
      await openCreate();

      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'correct-horse-battery' } });
      fireEvent.change(screen.getByLabelText('Confirm password *'), { target: { value: 'correct-horse-batteru' } });

      expect(screen.getByText('The two passwords do not match.')).toBeTruthy();
      // Scoped to the modal's form. A bare <button> defaults to type="submit",
      // so the page header's own "Create user" matches a naive type check too.
      const form = screen.getByLabelText('Full name *').closest('form');
      expect(within(form).getByText('Create user').disabled).toBe(true);
      expect(api.createUser).not.toHaveBeenCalled();
    });

    // An error on the first keystroke of the second field is an error about work
    // in progress, not about a mistake.
    it('says nothing until the second field has something in it', async () => {
      await openCreate();
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'correct-horse-battery' } });

      expect(screen.queryByText('The two passwords do not match.')).toBeNull();
    });

    it('sends the password once, without the confirmation field', async () => {
      await openCreate();

      fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'New Person' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'new@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'correct-horse-battery' } });
      fireEvent.change(screen.getByLabelText('Confirm password *'), { target: { value: 'correct-horse-battery' } });
      fireEvent.submit(screen.getByLabelText('Full name *').closest('form'));

      // The API body is `.strict()`, so an extra `confirm` key is a 400 naming a
      // field the admin never knew existed.
      await waitFor(() => expect(api.createUser).toHaveBeenCalled());
      expect(api.createUser.mock.calls[0][0]).toEqual({
        name: 'New Person', email: 'new@example.com',
        password: 'correct-horse-battery', role: 'AGENT',
      });
    });

    it('reveals the password on request, and hides it again', async () => {
      await openCreate();
      const input = screen.getByLabelText('Password *');
      expect(input.getAttribute('type')).toBe('password');

      const toggle = screen.getAllByLabelText('Show password')[0];
      fireEvent.click(toggle);
      expect(input.getAttribute('type')).toBe('text');

      fireEvent.click(screen.getAllByLabelText('Hide password')[0]);
      expect(input.getAttribute('type')).toBe('password');
    });
  });
});
