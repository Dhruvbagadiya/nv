import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCUMENT_KINDS, DOCUMENT_KIND_LABEL, searchDocumentKinds } from './documentKinds.js';

/**
 * Two lists have to agree and live in different languages: the Prisma enum,
 * which decides what the column will store, and this catalogue, which decides
 * what a human sees. Nothing connects them at build time.
 *
 * Drift is silent in the direction that matters. A kind in the database with no
 * entry here renders as its raw enum name — "BANK_BALANCE_CERTIFICATE" in the
 * middle of a sentence — and a kind here that the database does not have is a
 * picker option whose only outcome is a 400.
 */
const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, '..', '..', '..', 'backend', 'prisma', 'schema.prisma'), 'utf8');

const prismaKinds = (() => {
  const block = schema.match(/enum ApplicationDocumentKind \{([\s\S]*?)\}/);
  return block[1]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => /^[A-Z][A-Z0-9_]*$/.test(l));
})();

describe('the document-kind catalogue matches the database enum', () => {
  it('found both lists, so a broken parse cannot pass this file', () => {
    expect(prismaKinds.length).toBeGreaterThan(40);
    expect(DOCUMENT_KINDS.length).toBe(prismaKinds.length);
  });

  it.each(prismaKinds)('%s has a human label', (kind) => {
    expect(DOCUMENT_KIND_LABEL[kind], `${kind} would render as its raw enum name`).toBeTruthy();
  });

  it('offers no kind the database would reject', () => {
    const extra = DOCUMENT_KINDS.map((k) => k.value).filter((v) => !prismaKinds.includes(v));
    expect(extra, 'these are picker options that can only produce a 400').toEqual([]);
  });

  // Renaming a value would silently drop rows in the migration's USING cast, so
  // the list only ever grows. These eight existed before the catalogue did.
  it.each([
    'PASSPORT', 'ACADEMIC_TRANSCRIPT', 'ENGLISH_TEST', 'STATEMENT_OF_PURPOSE',
    'LETTER_OF_RECOMMENDATION', 'DECLARATION_FORM', 'FINANCIAL', 'OTHER',
  ])('still carries the original value %s', (kind) => {
    expect(prismaKinds).toContain(kind);
  });

  it('has no duplicates', () => {
    const values = DOCUMENT_KINDS.map((k) => k.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('searching the catalogue', () => {
  it('returns everything for an empty term', () => {
    expect(searchDocumentKinds('  ')).toHaveLength(DOCUMENT_KINDS.length);
  });

  it('matches on the label', () => {
    expect(searchDocumentKinds('bank').map((k) => k.value)).toContain('BANK_STATEMENT');
  });

  // The group is searchable too, so an agent who knows the category but not the
  // exact name still lands on it.
  it('matches on the group', () => {
    const hits = searchDocumentKinds('financial').map((k) => k.value);
    expect(hits).toContain('LOAN_SANCTION_LETTER');
  });

  // An admin reading a database export knows it as CAS_LETTER.
  it('matches on the enum name, underscores and all', () => {
    expect(searchDocumentKinds('cas letter').map((k) => k.value)).toContain('CAS_LETTER');
  });

  it('finds nothing for a term that matches nothing', () => {
    expect(searchDocumentKinds('zzzzz')).toEqual([]);
  });
});
