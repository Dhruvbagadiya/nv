import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/**
 * The landing nav highlighted "About Us" while the page sat at the top.
 *
 * Two causes, and each alone was enough:
 *
 *   1. id="top" was on the outermost page wrapper, so it spanned the whole
 *      document and intersected the spy's detection band at every scroll
 *      position.
 *   2. An IntersectionObserver callback receives only the entries whose state
 *      CHANGED. Choosing the winner from that batch let a section entering the
 *      band override the one already in it, with nothing firing again to
 *      correct it.
 *
 * This drives a fake observer so the behaviour can be asserted without layout,
 * which jsdom does not do.
 */
/** jsdom has no matchMedia; the page checks it for reduced motion. */
function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
}

/** The spy is the observer with the nav's detection band; the reveal and
 *  backdrop observers use their own margins. Counting targets is not enough. */
const findSpy = (instances) => instances.find((o) => o.options?.rootMargin?.includes('-45%'));

function installFakeObserver() {
  const instances = [];
  class FakeIO {
    constructor(cb, options) { this.cb = cb; this.options = options; this.targets = []; instances.push(this); }
    observe(el) { this.targets.push(el); }
    unobserve(el) { this.targets = this.targets.filter((t) => t !== el); }
    disconnect() { this.targets = []; }
    /** Fire with only the entries that changed, exactly as the real one does. */
    fire(changes) {
      // act() so the setActive it triggers is flushed before the assertion,
      // the same as any other update originating outside React.
      act(() => {
        this.cb(changes.map(([id, isIntersecting, top]) => ({
          target: { id },
          isIntersecting,
          boundingClientRect: { top },
        })));
      });
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
  return instances;
}

const LandingPage = (await import('./LandingPage.jsx')).default;

const renderPage = () => render(<MemoryRouter><LandingPage /></MemoryRouter>);
const activeLink = () =>
  [...document.querySelectorAll('.lp-nav a')].find((a) => a.className.includes('is-active'));

describe('landing nav scroll spy', () => {
  it('highlights Home when the page is at the top', () => {
    stubMatchMedia();
    const observers = installFakeObserver();
    renderPage();
    // The spy observer is the one watching several nav targets.
    const spy = findSpy(observers);
    expect(spy, 'no observer watched the nav sections').toBeTruthy();

    spy.fire([['top', true, 0]]);
    expect(activeLink()?.textContent).toBe('Home');
  });

  it('does not let a later section steal the highlight while the first is still in view', () => {
    stubMatchMedia();
    const observers = installFakeObserver();
    renderPage();
    const spy = findSpy(observers);

    spy.fire([['top', true, 0]]);
    // "about" enters the band in its own callback — `top` is absent from this
    // batch because its state did not change. This is the exact sequence that
    // produced the bug.
    spy.fire([['about', true, 400]]);

    expect(activeLink()?.textContent).toBe('Home');
  });

  it('moves the highlight once the earlier section leaves the band', () => {
    stubMatchMedia();
    const observers = installFakeObserver();
    renderPage();
    const spy = findSpy(observers);

    spy.fire([['top', true, 0]]);
    spy.fire([['about', true, 400]]);
    spy.fire([['top', false, -900]]);

    expect(activeLink()?.textContent).toBe('About Us');
  });

  it('anchors Home to the hero, not to the whole page', () => {
    stubMatchMedia();
    installFakeObserver();
    const { container } = renderPage();
    const top = container.querySelector('#top');
    expect(top, '#top is missing').toBeTruthy();
    // On the wrapper it contained every section; on the hero it does not.
    expect(top.querySelector('#about')).toBeNull();
    expect(top.className).toContain('lp-hero');
  });
});
