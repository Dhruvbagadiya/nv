import { describe, it, expect, vi } from 'vitest';
import { invalidateResource, RELATED_KEYS } from './useInvalidateResource.js';

/**
 * Saving used to refetch only the list on screen. The shared reference caches
 * behind every dropdown are held for 30 minutes, so a newly added institution
 * stayed missing from every other screen until the page was reloaded — the
 * "I have to refresh every time" report.
 */
function spyClient() {
  const calls = [];
  return { calls, invalidateQueries: vi.fn(({ queryKey }) => calls.push(queryKey)) };
}

const flat = (calls) => calls.map((k) => k.join('.'));

describe('invalidateResource', () => {
  it('clears the shared dropdown cache, not just the admin list', () => {
    const c = spyClient();
    invalidateResource(c, 'institutions');
    const keys = flat(c.calls);
    expect(keys).toContain('admin-institutions');
    // The one that was missing: every other screen's institution picker.
    expect(keys).toContain('institutions');
  });

  it('re-derives the document facets, so a newly scoped document gains its filter', () => {
    const c = spyClient();
    invalidateResource(c, 'documents');
    expect(flat(c.calls)).toContain('document-facets');
  });

  // Commission is read onto agent-facing program cards, so editing it in admin
  // has to reach further than the commissions screen.
  it('reaches the program caches when commission changes', () => {
    const c = spyClient();
    invalidateResource(c, 'commissions');
    const keys = flat(c.calls);
    expect(keys).toContain('commissions');
    expect(keys).toContain('courses');
  });

  it('falls back to the resource key alone when nothing is mapped', () => {
    const c = spyClient();
    invalidateResource(c, 'not-mapped-yet');
    expect(flat(c.calls)).toEqual(['not-mapped-yet']);
  });

  // A typo in a key is invisible at runtime — invalidating a name nothing uses
  // simply does nothing — so the shape is asserted rather than trusted.
  it('maps every resource to a non-empty list of array keys', () => {
    for (const [resource, keys] of Object.entries(RELATED_KEYS)) {
      expect(keys.length, `${resource} has no keys`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(Array.isArray(key), `${resource} key is not an array`).toBe(true);
        expect(typeof key[0]).toBe('string');
      }
    }
  });
});
