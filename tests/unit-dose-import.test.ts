import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  isUnitDoseValue,
  mapUnitDoseRow,
  normalizeHeader,
  normalizeNationalCode,
} = require('../lib/unit-dose-import.cjs');

describe('SCMFH unit dose import helpers', () => {
  it('interprets SI and SIPEX as unit dose values', () => {
    expect(isUnitDoseValue('SI')).toBe(true);
    expect(isUnitDoseValue('SIPEX')).toBe(true);
  });

  it('treats any other unit dose value as not available', () => {
    expect(isUnitDoseValue('0')).toBe(false);
    expect(isUnitDoseValue('')).toBe(false);
    expect(isUnitDoseValue(null)).toBe(false);
  });

  it('normalizes national codes to six digits when possible', () => {
    expect(normalizeNationalCode('123456')).toBe('123456');
    expect(normalizeNationalCode(12345)).toBe('012345');
    expect(normalizeNationalCode('12345.0')).toBe('012345');
    expect(normalizeNationalCode('1234567')).toBeNull();
    expect(normalizeNationalCode('ABC123')).toBeNull();
  });

  it('normalizes Excel headers with namespaces and accents', () => {
    expect(normalizeHeader('ns1:cod_nacion')).toBe('ns1_cod_nacion');
    expect(normalizeHeader('Laboratorio titular')).toBe('laboratorio_titular');
    expect(normalizeHeader('Presentación')).toBe('presentacion');
  });

  it('maps a row using expected SCMFH columns and preserves raw payload', () => {
    const mapped = mapUnitDoseRow(
      {
        'ns1:cod_nacion': '123456',
        'ns1:des_prese': 'PARACETAMOL 1 G COMPRIMIDOS',
        dcp: 'N02BE01',
        'Final atc': 'N02BE',
        'Laboratorio titular': 'LAB TEST',
        unidosis: ' SIPEX ',
        cantidad: 30,
        detectado: '2026-05-11',
      },
      'MEDICAMENTOSACTIVOS.xls',
    );

    expect(mapped.discarded).toBe(false);
    expect(mapped.data).toMatchObject({
      cn: '123456',
      presentation: 'PARACETAMOL 1 G COMPRIMIDOS',
      dcp: 'N02BE01',
      atcCode: 'N02BE',
      laboratory: 'LAB TEST',
      unitDoseRaw: 'SIPEX',
      isUnitDose: true,
      quantity: '30',
      sourceFileName: 'MEDICAMENTOSACTIVOS.xls',
    });
    expect(JSON.parse(mapped.data.rawPayload)).toMatchObject({ unidosis: ' SIPEX ' });
    expect(mapped.data.detectedAt).toBeInstanceOf(Date);
  });

  it('discards rows without a valid CN', () => {
    expect(mapUnitDoseRow({ 'ns1:cod_nacion': 'ABC123', unidosis: 'SI' })).toMatchObject({
      discarded: true,
      reason: 'CN inválido o ausente',
    });
  });
});
