import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import EntryRequirementsFields from './EntryRequirementsFields.jsx';

afterEach(cleanup);

/**
 * The editor's own header promises "Nothing is hidden" — any key the form does
 * not model is listed under Other fields so importing a new provider never
 * silently drops data. Two holes in that promise, both of which also destroyed
 * the value on the first keystroke.
 */
function renderFields(value) {
  const changes = [];
  render(<EntryRequirementsFields value={value} onChange={(v) => changes.push(v)} />);
  return { changes, last: () => changes.at(-1) };
}

describe('a value the form cannot model', () => {
  // KNOWN-ness was taken as proof of shape. A feed publishing ielts as a bare
  // string rendered blank band boxes and appeared nowhere else on the screen.
  it('shows a band field holding a string, rather than hiding it', () => {
    renderFields({ ielts: '6.5' });
    expect(screen.getByLabelText('ielts')).toBeTruthy();
    expect(screen.getByLabelText('ielts').value).toBe('6.5');
  });

  it('shows a text field holding an object, rather than rendering [object Object]', () => {
    renderFields({ summary: { level: '12th', score: 60 } });
    const input = screen.getByLabelText('summary');
    expect(input.value).toBe('{"level":"12th","score":60}');
  });

  it('shows a single English test published as a string as one chip', () => {
    renderFields({ acceptedEnglishTests: 'IELTS' });
    // Scoped to the chip row: "IELTS" is also the label of the band field.
    expect(document.querySelector('.chip-row').textContent).toContain('IELTS');
  });

  // Spreading a string yields its characters as numbered keys, so correcting a
  // mis-shaped band buried the original inside the replacement:
  // { 0:'6', 1:'.', 2:'5', overall:'7.0' }.
  it('does not spread a string when the band is corrected', () => {
    // The mis-shaped value is visible under Other fields, and the band control
    // is how it gets corrected: typing a score replaces the string with the
    // shape the field expects, rather than merging into its characters.
    const { last } = renderFields({ ielts: '6.5' });

    fireEvent.change(screen.getByLabelText('IELTS overall'), { target: { value: '7.0' } });

    expect(last().ielts).toEqual({ overall: '7.0' });
    expect(last().ielts).not.toHaveProperty('0');
  });
});

/**
 * The row rendered JSON.stringify(value) but wrote back e.target.value raw, so
 * one keystroke turned { years: 2 } into the STRING '{"years":2}'. It looked
 * identical on reopening and any consumer reading .years got undefined.
 */
describe('Other fields round-trip JSON instead of flattening it', () => {
  it('keeps an object an object when it is edited', () => {
    const { last } = renderFields({ workExperience: { years: 2, notes: 'internship' } });

    fireEvent.change(screen.getByLabelText('workExperience'), {
      target: { value: '{"years":3,"notes":"internship"}' },
    });

    expect(last().workExperience).toEqual({ years: 3, notes: 'internship' });
    expect(typeof last().workExperience).toBe('object');
  });

  it('keeps an array an array', () => {
    const { last } = renderFields({ campuses: ['London', 'Leeds'] });

    fireEvent.change(screen.getByLabelText('campuses'), { target: { value: '["London","York"]' } });

    expect(Array.isArray(last().campuses)).toBe(true);
    expect(last().campuses).toEqual(['London', 'York']);
  });

  // A half-typed object is not valid JSON, and propagating it is exactly the
  // flattening this is here to stop.
  it('holds back an unparseable draft and says so', () => {
    const { changes } = renderFields({ workExperience: { years: 2 } });

    fireEvent.change(screen.getByLabelText('workExperience'), { target: { value: '{"years":' } });

    expect(changes).toHaveLength(0);
    expect(screen.getByText(/Not valid JSON/i)).toBeTruthy();
  });

  it('still edits a plain string field as plain text', () => {
    const { last } = renderFields({ someNote: 'hello' });

    fireEvent.change(screen.getByLabelText('someNote'), { target: { value: 'hello there' } });

    expect(last().someNote).toBe('hello there');
  });
});
