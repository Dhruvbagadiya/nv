import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSeededForm } from './useSeededForm.js';

const toForm = (p) => ({ name: p.name ?? '', bio: p.bio ?? '' });

/**
 * `invalidateResource(qc, 'profile')` clears both profile caches, so saving one
 * section of the page refetched the other. The re-seed fired on the new object's
 * identity and reset the fields under whatever the user had typed there.
 */
describe('useSeededForm', () => {
  // Hoisted: the hook keys on the payload's IDENTITY, so a fresh object literal
  // built inside the render callback would look like new data every time.
  // React Query holds a stable object while the data is unchanged, which is what
  // makes that safe in the app.
  const ADA = { name: 'Ada' };

  it('seeds from the first payload', () => {
    const { result } = renderHook(() => useSeededForm(ADA, toForm));
    expect(result.current.values.name).toBe('Ada');
  });

  it('takes new data while the form is untouched', () => {
    const { result, rerender } = renderHook(({ p }) => useSeededForm(p, toForm), {
      initialProps: { p: { name: 'Ada' } },
    });

    rerender({ p: { name: 'Grace' } });

    expect(result.current.values.name).toBe('Grace');
  });

  // The bug: a refetch triggered by saving a DIFFERENT section reverted this one.
  it('keeps what the user typed when new data arrives', () => {
    const { result, rerender } = renderHook(({ p }) => useSeededForm(p, toForm), {
      initialProps: { p: { name: 'Ada', bio: 'old' } },
    });

    act(() => result.current.setField('bio', 'half-written thought'));
    // A fresh object for the same row, exactly what a refetch produces.
    rerender({ p: { name: 'Ada', bio: 'old' } });

    expect(result.current.values.bio).toBe('half-written thought');
  });

  it('accepts new data again once the edit has been saved', () => {
    const { result, rerender } = renderHook(({ p }) => useSeededForm(p, toForm), {
      initialProps: { p: { name: 'Ada', bio: 'old' } },
    });

    act(() => result.current.setField('bio', 'new bio'));
    act(() => result.current.markSaved());
    rerender({ p: { name: 'Ada', bio: 'new bio' } });

    // Clean again, so a genuine server-side change is allowed through.
    rerender({ p: { name: 'Ada', bio: 'changed elsewhere' } });
    expect(result.current.values.bio).toBe('changed elsewhere');
  });

  it('reports empty values rather than throwing before any data arrives', () => {
    const { result } = renderHook(() => useSeededForm(null, toForm));
    expect(result.current.values).toEqual({});
  });
});
