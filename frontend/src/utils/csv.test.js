import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvToObjects } from './csv.js';

describe('parseCsv', () => {
  it('reads a plain grid', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  // The reason this is not split(','): course titles contain commas.
  it('keeps a comma inside a quoted field', () => {
    expect(parseCsv('title,fee\n"MSc Business, Finance and Economics",15000')).toEqual([
      ['title', 'fee'],
      ['MSc Business, Finance and Economics', '15000'],
    ]);
  });

  it('keeps a newline inside a quoted field', () => {
    const rows = parseCsv('title,notes\n"MSc","IELTS 6.5\nno band below 6.0"');
    expect(rows[1][1]).toBe('IELTS 6.5\nno band below 6.0');
    expect(rows).toHaveLength(2);
  });

  it('reads "" as one literal quote', () => {
    expect(parseCsv('a\n"He said ""hi"""')[1][0]).toBe('He said "hi"');
  });

  it('handles CRLF, which is what a Windows export writes', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps the last row when the file does not end in a newline', () => {
    expect(parseCsv('a\n1')).toHaveLength(2);
  });

  it('drops blank lines rather than emitting empty rows', () => {
    expect(parseCsv('a,b\n1,2\n\n\n')).toHaveLength(2);
  });
});

describe('parseCsvToObjects', () => {
  it('keys rows by a normalised header', () => {
    const { rows } = parseCsvToObjects('Tuition Fee,Program_Level\n15000,MASTERS');
    expect(rows[0].tuitionfee).toBe('15000');
    expect(rows[0].programlevel).toBe('MASTERS');
  });

  // Excel writes a BOM; without stripping it the first header never matches.
  it('strips a leading byte order mark', () => {
    const { headers, rows } = parseCsvToObjects('﻿title\nMSc Data Science');
    expect(headers[0]).toBe('title');
    expect(rows[0].title).toBe('MSc Data Science');
  });

  it('returns nothing for an empty file rather than throwing', () => {
    expect(parseCsvToObjects('')).toEqual({ headers: [], rows: [] });
  });
});
