import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import { useAuth } from '../store/useAuth.js';

// Three portals share ONE session. That is a deliberate simplification, but it
// means a signed-in user can land on a portal their role cannot enter, and what
// happens next has to be defined for every role/portal pair — otherwise a guard
// can redirect somewhere that redirects straight back.

const PARTNER_ROLES = ['AGENT', 'ADMIN', 'SUPER_ADMIN'];

function renderPartnerArea(initial = '/partner/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/partner/login" element={<p>PARTNER LOGIN</p>} />
        <Route path="/programs" element={<p>STUDENT PROGRAMS</p>} />
        <Route
          path="/partner/*"
          element={
            <ProtectedRoute
              allowedRoles={PARTNER_ROLES}
              loginPath="/partner/login"
              redirectPath="/partner/dashboard"
            >
              <Routes>
                <Route path="dashboard" element={<p>PARTNER DASHBOARD</p>} />
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('cross-portal redirects', () => {
  beforeEach(() => useAuth.setState({ user: null, accessToken: null, status: 'loading' }));
  afterEach(cleanup);

  it('lets a partner role into the partner area', () => {
    useAuth.setState({ status: 'authenticated', user: { id: '1', role: 'AGENT' } });
    renderPartnerArea();
    expect(screen.getByText('PARTNER DASHBOARD')).toBeTruthy();
  });

  // A signed-in STUDENT who lands anywhere under /partner/* is redirected by the
  // guard to redirectPath — which is ITSELF under /partner/*, so the guard rejects
  // it again and redirects again. React Router aborts after ~50 hops.
  //
  // This is reachable in one click: the student clicks "Partner portal" from their
  // own login page while signed in.
  it('does not bounce a signed-in STUDENT between two forbidden routes', () => {
    useAuth.setState({ status: 'authenticated', user: { id: '2', role: 'STUDENT' } });

    const errors = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(String(a[0])));
    let threw = null;
    try {
      renderPartnerArea();
    } catch (e) {
      threw = e;
    }
    spy.mockRestore();

    const looped =
      threw?.message?.match(/maximum update depth|too many re-?renders/i) ||
      errors.some((e) => /maximum update depth|too many re-?renders/i.test(e));

    // The student must end up somewhere they are allowed to be.
    expect(looped, `redirect loop: ${threw?.message ?? errors[0]}`).toBeFalsy();
    expect(screen.queryByText('PARTNER DASHBOARD')).toBeNull();
    expect(screen.getByText('STUDENT PROGRAMS')).toBeTruthy();
  });
});
