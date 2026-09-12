import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';

/**
 * There was no boundary anywhere in the app, and PartnerShell wraps every
 * partner AND admin route — so one throw in one panel unmounted the header, the
 * sidebar and the toast stack along with it. The user got a white page with the
 * URL still on the screen they thought they were looking at.
 */
function Boom({ throws = true }) {
  if (throws) throw new Error('kaboom from a child');
  return <p>CHILD RENDERED</p>;
}

describe('ErrorBoundary', () => {
  let consoleError;

  beforeEach(() => {
    // React logs the caught error itself, and componentDidCatch logs it again on
    // purpose. Silenced so a passing run is not a wall of red.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    cleanup();
  });

  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary><Boom throws={false} /></ErrorBoundary>);
    expect(screen.getByText('CHILD RENDERED')).toBeTruthy();
  });

  it('catches a throw instead of unmounting the tree', () => {
    render(
      <div>
        <p>SIBLING STILL HERE</p>
        <ErrorBoundary><Boom /></ErrorBoundary>
      </div>
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    // The whole point: what sits outside the boundary survives.
    expect(screen.getByText('SIBLING STILL HERE')).toBeTruthy();
  });

  // A boundary that swallows the error silently is worse for debugging than the
  // white page it replaces.
  it('still reports the error to the console', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows the message, which is what makes a bug report actionable', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/kaboom from a child/)).toBeTruthy();
  });

  it('takes a caller-supplied heading', () => {
    render(<ErrorBoundary title="This panel failed"><Boom /></ErrorBoundary>);
    expect(screen.getByText('This panel failed')).toBeTruthy();
  });

  it('re-renders the children when Try again is pressed', () => {
    // The flag is flipped by the test rather than by the component itself:
    // React retries a failed render, so a child that heals on its own first
    // attempt recovers before the boundary ever gets to show anything.
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error('transient');
      return <p>RECOVERED</p>;
    };

    render(<ErrorBoundary><Flaky /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));

    expect(screen.getByText('RECOVERED')).toBeTruthy();
  });
});
