import { useState } from 'react';

/**
 * Form state seeded from a query, that does not throw away what you have typed.
 *
 * Three forms hand-rolled this, and all three had the same hole. The seed fired
 * whenever the server object's identity changed, and `invalidateResource(qc,
 * 'profile')` clears BOTH ['my-profile'] and ['student-profile'] — so saving one
 * section refetched the other, produced a fresh object, and reset the fields
 * under it. Type a new bio, upload an avatar without saving it, and the bio was
 * gone with nothing said. Two sections on one page made it easy to hit; it only
 * stayed survivable at all because refetchOnWindowFocus is off, so flipping that
 * default would have fired it on every tab switch.
 *
 * The rule: new data wins while the form is untouched, and the user wins once it
 * is not. A dirty form is only re-seeded after a save, which is what `markSaved`
 * is for.
 *
 * `source` is keyed on IDENTITY, so it must be the object React Query hands you
 * rather than one rebuilt each render — the same requirement the hand-rolled
 * versions had.
 *
 * Seeded during render rather than in an effect, matching what these forms
 * already did: setting state in an effect renders twice and paints the empty
 * form first, so the fields visibly fill in a beat after the page appears.
 */
export function useSeededForm(source, toForm) {
  const [state, setState] = useState({ from: null, seed: null, values: null });

  const seed = source ? toForm(source) : null;

  if (source && source !== state.from) {
    // Dirty means the user has typed since the last seed. Compared against the
    // seed rather than against the server object, so a save that echoes the
    // values back still counts as clean.
    const dirty = state.values !== null && !shallowEqual(state.values, state.seed);
    if (!dirty) setState({ from: source, seed, values: seed });
    // Still record which payload we have seen, so an unchanged one does not
    // re-check on every render.
    else setState((s) => ({ ...s, from: source }));
  }

  const values = state.values ?? seed ?? {};

  const setField = (key, value) =>
    setState((s) => ({ ...s, values: { ...(s.values ?? seed ?? {}), [key]: value } }));

  /** Call after a successful save so the next refetch is allowed to seed again. */
  const markSaved = () => setState((s) => ({ ...s, seed: s.values }));

  return { values, setField, markSaved };
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}
