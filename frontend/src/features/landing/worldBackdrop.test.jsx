import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import WorldBackdrop from './WorldBackdrop.jsx';

/*
 * The backdrop is a canvas painter, so almost none of it can be exercised in
 * jsdom — there is no 2d context and no Path2D. What CAN be pinned here is the
 * thing that actually matters for the rest of the page: it degrades to nothing
 * instead of taking the landing page down with it.
 *
 * That is not hypothetical. jsdom is exactly the "browser with no canvas" case,
 * and Path2D is missing on older Safari.
 */
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('WorldBackdrop', () => {
  it('renders a canvas that is hidden from assistive tech', () => {
    const { container } = render(<WorldBackdrop />);
    const canvas = container.querySelector('canvas.lp-backdrop');
    expect(canvas).toBeTruthy();
    // Decoration. The country list further down the page is the real content.
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not throw where Path2D or a 2d context is unavailable', () => {
    // jsdom provides neither, which is the case this asserts.
    expect(() => render(<WorldBackdrop />)).not.toThrow();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('never fetches the geometry when it cannot paint it', () => {
    // Guard order matters: bailing out before the fetch keeps a browser that
    // cannot render the map from downloading 76 KB of it anyway.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<WorldBackdrop />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cleans up without error when unmounted mid-flight', () => {
    const { unmount } = render(<WorldBackdrop />);
    expect(() => unmount()).not.toThrow();
  });
});
