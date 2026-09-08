import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROGRAM_LEVELS, programLevelLabel } from './referenceData.js';

// The browser cannot import Prisma's generated enum, so this reads the schema
// the database is built from and compares directly. It exists because the two
// lists silently diverged: nine here against seventeen in the database, which
// made 4,907 courses unfilterable and let the admin editor save a doctorate as
// a master's degree.
function levelsInSchema() {
  // Resolved from the working directory, not import.meta.url: Vite rewrites
  // module URLs to a non-file scheme, which readFileSync rejects.
  const schema = readFileSync(resolve(process.cwd(), '../backend/prisma/schema.prisma'), 'utf8');
  const block = schema.match(/enum ProgramLevel \{([^}]*)\}/);
  if (!block) throw new Error('enum ProgramLevel not found in schema.prisma');
  return block[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
}

describe('PROGRAM_LEVELS', () => {
  it('offers exactly the levels the database defines', () => {
    expect(new Set(PROGRAM_LEVELS.map((l) => l.value))).toEqual(new Set(levelsInSchema()));
  });

  it('gives every level a label that is not its raw enum value', () => {
    for (const { value, label } of PROGRAM_LEVELS) {
      expect(label, `${value} has no human label`).not.toBe(value);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('falls back to something readable for an unknown value', () => {
    // Better a raw enum name than a blank cell if a level is ever added to the
    // database before this list catches up.
    expect(programLevelLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(programLevelLabel(undefined)).toBe('—');
  });
});
