import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Filter state lives in the query string, not component state. Three reasons:
//
//  1. Filtered views become linkable and shareable — the reference portal does
//     this too (…/doc-bank/Institute%20Brochures?country_id=1&university_id=1).
//  2. Back/forward work the way users expect instead of dumping them on an
//     unfiltered page.
//  3. It removes a bug class the existing screens have: CourseFinder resets
//     `page` on search and tag changes but not on country change, because the
//     country lives in a separate store (F-12). With one source of truth, "any
//     filter change resets the page" is enforced in a single place.
//
// `defaults` doubles as the schema: only these keys are read or written, so a
// stray query param cannot leak into an API request.
//
// IMPORTANT: pass `defaults` as a stable reference — a module-level constant, not
// an inline literal. An inline object is a new identity every render, which would
// invalidate the memoisation below on each pass. Declaring it outside the
// component costs nothing and keeps the hook honest about its dependencies.
export function useUrlFilters(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  // What the API should be querying — committed values only.
  const applied = useMemo(() => {
    const out = {};
    for (const [key, fallback] of Object.entries(defaults)) {
      const raw = searchParams.get(key);
      if (raw === null || raw === '') {
        out[key] = fallback;
      } else if (typeof fallback === 'number') {
        const n = Number(raw);
        // A non-numeric ?page=abc used to reach the backend and produce
        // `skip: NaN`, which Prisma turns into a 500.
        out[key] = Number.isFinite(n) ? n : fallback;
      } else {
        out[key] = raw;
      }
    }
    return out;
  }, [searchParams, defaults]);

  // What is currently typed into the inputs. Separate from `applied` because the
  // screens in the images commit on an explicit "Apply Filter" click rather than
  // firing a request per keystroke.
  const [draft, setDraft] = useState(applied);

  // Keyed on the committed values, in the fixed order `defaults` declares, so
  // two equivalent states compare equal regardless of how the URL was written.
  const appliedKey = useMemo(
    () => JSON.stringify(Object.keys(defaults).map((k) => applied[k])),
    [applied, defaults]
  );
  // The last state this hook itself put in the URL. Anything else that shows up
  // there came from outside — Back/forward, or a pasted link. Held in state
  // rather than a ref because it is read during render, and a ref read there is
  // not safe under concurrent rendering.
  const [lastWritten, setLastWritten] = useState(appliedKey);
  const [syncedKey, setSyncedKey] = useState(appliedKey);

  // Adjusting state during render rather than in an effect: this is the
  // documented pattern for "derive state from a prop change", and it means the
  // inputs never paint one frame showing the previous filters.
  if (appliedKey !== syncedKey) {
    setSyncedKey(appliedKey);
    if (lastWritten !== appliedKey) {
      // Came from outside. The draft was seeded once at mount, so pressing Back
      // left the inputs showing filters that no longer matched the results.
      setDraft(applied);
    } else {
      // Our own write. Keep whatever is half-typed and only follow the page.
      setDraft((d) => ({ ...d, ...('page' in defaults ? { page: applied.page } : {}) }));
    }
  }

  const setField = useCallback((key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const writeToUrl = useCallback(
    (next) => {
      const params = new URLSearchParams();
      for (const [key, fallback] of Object.entries(defaults)) {
        const value = next[key];
        // Defaults are omitted so a pristine URL stays clean rather than
        // accumulating ?country=&intake=&page=1.
        if (value !== '' && value != null && value !== fallback) {
          params.set(key, String(value));
        }
      }
      setLastWritten(JSON.stringify(Object.keys(defaults).map((k) => {
        const v = next[k];
        return v === '' || v == null ? defaults[k] : v;
      })));
      setSearchParams(params, { replace: false });
    },
    [setSearchParams, defaults]
  );

  const apply = useCallback(() => {
    // Reset to page 1: holding page 5 while changing a filter is how you land on
    // an empty result set that looks like "no data".
    const next = { ...draft, ...('page' in defaults ? { page: 1 } : {}) };
    setDraft(next);
    writeToUrl(next);
  }, [draft, writeToUrl, defaults]);

  const clear = useCallback(() => {
    setDraft(defaults);
    writeToUrl(defaults);
  }, [defaults, writeToUrl]);

  // Pagination has to bypass the draft/apply cycle — clicking page 2 should
  // navigate immediately, not wait for "Apply Filter".
  const setPage = useCallback(
    (page) => {
      // Only the page is committed. Paging used to overwrite the draft with the
      // applied values, so half-typed filters vanished when you clicked page 2 —
      // but it must not commit them either, which would apply a filter the user
      // had not asked for yet.
      const next = { ...applied, page };
      setDraft((d) => ({ ...d, page }));
      writeToUrl(next);
    },
    [applied, writeToUrl]
  );

  const isDirty = useMemo(
    () => Object.keys(defaults).some((k) => k !== 'page' && draft[k] !== applied[k]),
    [draft, applied, defaults]
  );

  const hasActiveFilters = useMemo(
    () => Object.keys(defaults).some((k) => k !== 'page' && applied[k] !== defaults[k]),
    [applied, defaults]
  );

  return { applied, draft, setField, apply, clear, setPage, isDirty, hasActiveFilters };
}
