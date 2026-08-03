import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useUrlFilters } from './useUrlFilters.js';

// Must be a module-level constant: the hook documents `defaults` as a stable
// reference, and an inline literal would defeat its memoisation.
const DEFAULTS = { country: '', search: '', page: 1 };

// renderHook rather than a component harness that writes to an outer variable —
// assigning to external state during render is impure, and the lint rule that
// flags it is right.
function setup(url = '/') {
  return renderHook(() => ({ ...useUrlFilters(DEFAULTS), url: useLocation().search }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });
}

describe('useUrlFilters', () => {
  afterEach(cleanup);

  it('falls back to defaults with no query string', () => {
    const { result } = setup('/');
    expect(result.current.applied).toEqual({ country: '', search: '', page: 1 });
  });

  it('reads values out of the URL, coercing numbers', () => {
    const { result } = setup('/?country=UK&page=3');
    expect(result.current.applied).toEqual({ country: 'UK', search: '', page: 3 });
    expect(typeof result.current.applied.page).toBe('number');
  });

  // ?page=abc previously reached the backend, where Number('abc') produced
  // `skip: NaN` and Prisma turned that into a 500.
  it('falls back to the default when a numeric param is not a number', () => {
    const { result } = setup('/?page=abc');
    expect(result.current.applied.page).toBe(1);
  });

  it('ignores query params that are not in the schema', () => {
    const { result } = setup('/?country=UK&evil=1');
    expect(result.current.applied).not.toHaveProperty('evil');
  });

  it('holds edits in the draft until apply is called', () => {
    const { result } = setup('/');
    act(() => result.current.setField('country', 'CA'));
    expect(result.current.draft.country).toBe('CA');
    expect(result.current.applied.country).toBe(''); // not committed yet
    expect(result.current.url).toBe('');

    act(() => result.current.apply());
    expect(result.current.applied.country).toBe('CA');
    expect(result.current.url).toContain('country=CA');
  });

  // F-12: CourseFinder reset `page` on search but not on country change, so
  // switching country while deep in the pages produced an empty grid.
  it('resets to page 1 whenever filters are applied', () => {
    const { result } = setup('/?page=4');
    expect(result.current.applied.page).toBe(4);
    act(() => result.current.setField('country', 'UK'));
    act(() => result.current.apply());
    expect(result.current.applied.page).toBe(1);
    expect(result.current.url).not.toContain('page=');
  });

  it('omits defaults from the URL so a pristine view stays clean', () => {
    const { result } = setup('/?country=UK');
    act(() => result.current.setField('country', ''));
    act(() => result.current.apply());
    expect(result.current.url).toBe('');
  });

  it('clear resets both draft and URL', () => {
    const { result } = setup('/?country=UK&search=data&page=2');
    act(() => result.current.clear());
    expect(result.current.applied).toEqual({ country: '', search: '', page: 1 });
    expect(result.current.url).toBe('');
  });

  it('setPage commits immediately, bypassing the draft cycle', () => {
    const { result } = setup('/?country=UK');
    act(() => result.current.setPage(3));
    expect(result.current.applied).toEqual({ country: 'UK', search: '', page: 3 });
    expect(result.current.url).toContain('page=3');
  });

  it('setPage preserves applied filters but discards uncommitted edits', () => {
    const { result } = setup('/?country=UK');
    act(() => result.current.setField('search', 'typed but not applied'));
    act(() => result.current.setPage(2));
    expect(result.current.applied.country).toBe('UK');
    expect(result.current.applied.search).toBe('');
  });

  it('tracks dirty and active state, ignoring page', () => {
    const { result } = setup('/');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => result.current.setField('country', 'UK'));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.hasActiveFilters).toBe(false); // still uncommitted

    act(() => result.current.apply());
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasActiveFilters).toBe(true);
  });
});
