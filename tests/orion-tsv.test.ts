import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseOrionCatalogTsv } from '../lib/orion-tsv';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function readFixture(name: string): Uint8Array {
  return readFileSync(path.join(fixturesDir, name));
}

describe('parseOrionCatalogTsv', () => {
  it('preserves UTF-8 text with accents without mojibake', () => {
    const result = parseOrionCatalogTsv(readFixture('orion-catalog-utf8.tsv'), {
      sourceFile: 'orion-catalog-utf8.tsv',
    });

    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({
      articleCode: 'ART-UTF8',
      shortDescription: 'Solución oral',
      statusNormalized: 'ACTIVO',
    });
    expect(result.items[0]?.shortDescription).not.toContain('SoluciÃ³n');
  });

  it('preserves cp1252 text with accents without mojibake', () => {
    const result = parseOrionCatalogTsv(readFixture('orion-catalog-cp1252.tsv'), {
      sourceFile: 'orion-catalog-cp1252.tsv',
    });

    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({
      articleCode: 'ART-001',
      shortDescription: 'Solución oral',
      statusNormalized: 'ACTIVO',
    });
    expect(result.items[0]?.shortDescription).not.toContain('SoluciÃ³n');
  });

  it('parses a valid TSV, preserves accepted statuses and warns on identical duplicates', () => {
    const result = parseOrionCatalogTsv(readFixture('orion-catalog-valid.tsv'), {
      sourceFile: 'orion-catalog-valid.tsv',
    });

    expect(result.errors).toEqual([]);
    expect(result.rowCount).toBe(4);
    expect(result.duplicateCount).toBe(1);
    expect(result.items).toHaveLength(3);
    expect(result.warnings.some((warning) => warning.code === 'DUPLICATE_IDENTICAL_ROWS')).toBe(true);
    expect(result.items.map((item) => item.statusNormalized)).toEqual(['ACTIVO', 'IC_AUTO', 'ESTADO_LIBRE']);
  });

  it('reports missing required columns', () => {
    const result = parseOrionCatalogTsv(readFixture('orion-catalog-missing-columns.tsv'), {
      sourceFile: 'orion-catalog-missing-columns.tsv',
    });

    expect(result.items).toEqual([]);
    expect(result.errors[0]?.code).toBe('MISSING_REQUIRED_COLUMNS');
  });

  it('reports ambiguous headers after normalization', () => {
    const result = parseOrionCatalogTsv(readFixture('orion-catalog-ambiguous-headers.tsv'), {
      sourceFile: 'orion-catalog-ambiguous-headers.tsv',
    });

    expect(result.items).toEqual([]);
    expect(result.errors[0]?.code).toBe('AMBIGUOUS_HEADERS');
  });

  it('aborts on conflicting duplicates for the same articleCode', () => {
    const result = parseOrionCatalogTsv(readFixture('orion-catalog-duplicate-conflict.tsv'), {
      sourceFile: 'orion-catalog-duplicate-conflict.tsv',
    });

    expect(result.items).toEqual([]);
    expect(result.duplicateCount).toBe(1);
    expect(result.errors[0]).toMatchObject({
      code: 'DUPLICATE_CONFLICT',
      rowNumbers: [2, 3],
    });
  });

  it('ignores completely empty rows and reports structural errors for incomplete rows', () => {
    const result = parseOrionCatalogTsv(readFixture('orion-catalog-row-validation.tsv'), {
      sourceFile: 'orion-catalog-row-validation.tsv',
    });

    expect(result.rowCount).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.articleCode).toBe('ART-VAL-001');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: 'INVALID_STRUCTURE',
      rowNumbers: [4],
    });
  });
});
