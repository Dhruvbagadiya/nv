import { describe, it, expect } from 'vitest';
import { cleanRequirements } from './EntryRequirementsFields.jsx';

describe('cleanRequirements', () => {
  it('drops empty values so a blank form saves null, not a husk', () => {
    expect(cleanRequirements({ summary: '', moi: null, ielts: { overall: '', notLessThan: '' } }))
      .toBeNull();
  });

  it('keeps a half-filled band pair', () => {
    expect(cleanRequirements({ ielts: { overall: '6.5', notLessThan: '' } }))
      .toEqual({ ielts: { overall: '6.5' } });
  });

  it('keeps "No", which means the test is not accepted', () => {
    // Distinct from saying nothing about the test at all, and dropping it would
    // turn "Duolingo not accepted" into "Duolingo unmentioned".
    expect(cleanRequirements({ duolingo: { overall: 'No' } }))
      .toEqual({ duolingo: { overall: 'No' } });
  });

  it('keeps non-numeric band text the providers really publish', () => {
    expect(cleanRequirements({ toefl: { overall: 'L 16, R 17, W 17, S 19' } }))
      .toEqual({ toefl: { overall: 'L 16, R 17, W 17, S 19' } });
  });

  it('drops an empty list but keeps a populated one', () => {
    expect(cleanRequirements({ acceptedEnglishTests: [] })).toBeNull();
    expect(cleanRequirements({ acceptedEnglishTests: ['IELTS'] }))
      .toEqual({ acceptedEnglishTests: ['IELTS'] });
  });

  it('preserves keys the form does not model', () => {
    // A new provider's fields must survive an admin save rather than being
    // silently dropped because the editor has no input for them.
    expect(cleanRequirements({ summary: '12th Grade', workExperience: '2 years' }))
      .toEqual({ summary: '12th Grade', workExperience: '2 years' });
  });
});
