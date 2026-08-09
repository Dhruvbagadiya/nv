import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import { useAuth } from '../store/useAuth.js';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

// Renders the guard at /admin with sibling routes, so a redirect is observable
// by which page's text ends up on screen.
function renderAt(path = '/admin', allowedRoles = ADMIN_ROLES) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<p>LOGIN PAGE</p>} />
        <Route path="/login" element={<p>STUDENT LOGIN</p>} />
        <Route path="/partner/dashboard" element={<p>DASHBOARD</p>} />
        <Route path="/programs" element={<p>PROGRAMS</p>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <p>ADMIN PANEL</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, accessToken: null, status: 'loading' });
  });

  // Explicit because vitest runs with globals:false, so testing-library's
  // automatic per-test cleanup never registers itself.
  afterEach(cleanup);

  it('shows neither the page nor a redirect while the session is still loading', () => {
    renderAt();
    expect(screen.queryByText('ADMIN PANEL')).toBeNull();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
    expect(screen.queryByText('DASHBOARD')).toBeNull();
  });

  it('redirects an anonymous visitor to /login', () => {
    useAuth.setState({ status: 'anonymous', user: null });
    renderAt();
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
  });

  // This is the regression test for F-02. The old guard read
  //   allowedRoles && user && !allowedRoles.includes(user.role)
  // so a null user short-circuited it and the admin page rendered. That is
  // exactly the state the app was in after every page refresh, because only the
  // token was persisted and never the user.
  it('does NOT render an admin page when authenticated with no user loaded (fail closed)', () => {
    useAuth.setState({ status: 'authenticated', user: null, accessToken: 'tok' });
    renderAt();
    expect(screen.queryByText('ADMIN PANEL')).toBeNull();
    // No role -> the public entry point, not a partner route it also cannot open.
    expect(screen.getByText('STUDENT LOGIN')).toBeTruthy();
  });

  it('redirects an AGENT away from an admin-only route', () => {
    useAuth.setState({ status: 'authenticated', user: { id: '1', role: 'AGENT' } });
    renderAt();
    expect(screen.queryByText('ADMIN PANEL')).toBeNull();
    expect(screen.getByText('DASHBOARD')).toBeTruthy();
  });

  it.each(ADMIN_ROLES)('allows %s through an admin-only route', (role) => {
    useAuth.setState({ status: 'authenticated', user: { id: '1', role } });
    renderAt();
    expect(screen.getByText('ADMIN PANEL')).toBeTruthy();
  });

  it('allows any authenticated user through when no roles are specified', () => {
    useAuth.setState({ status: 'authenticated', user: { id: '1', role: 'AGENT' } });
    // null, not undefined — renderAt's default parameter would swallow undefined
    // and re-apply ADMIN_ROLES, which is not the case under test here.
    renderAt('/admin', null);
    expect(screen.getByText('ADMIN PANEL')).toBeTruthy();
  });

  it('treats an unrecognised role as not permitted', () => {
    useAuth.setState({ status: 'authenticated', user: { id: '1', role: 'INTERN' } });
    renderAt();
    expect(screen.queryByText('ADMIN PANEL')).toBeNull();
    expect(screen.getByText('STUDENT LOGIN')).toBeTruthy();
  });

  // Each rejected role must land on ITS OWN home. Sending everyone to one fixed
  // route is what produced a blank page for students.
  it.each([
    ['AGENT', 'DASHBOARD'],
    ['STUDENT', 'PROGRAMS'],
  ])('sends a rejected %s to their own home', (role, expected) => {
    useAuth.setState({ status: 'authenticated', user: { id: '1', role } });
    renderAt();
    expect(screen.getByText(expected)).toBeTruthy();
  });
});
