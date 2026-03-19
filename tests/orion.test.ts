import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import {
  buildMedicineSnapshotWithConflicts,
  diffSnapshots,
  parseWorkbook,
  validateOrionMedicineCode,
  type ParsedImportRow,
} from '../lib/orion';

function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function makeWorkbook(rows: Record<string, string>[], sheetName = 'Hoja1'): ArrayBuffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbookToArrayBuffer(workbook);
}

describe('validateOrionMedicineCode', () => {
  it('accepts a valid Orion medicine code and extracts the CN', () => {
    expect(validateOrionMedicineCode('123456.CNA')).toEqual({
      isValid: true,
      nationalCode: '123456',
      discardReason: null,
    });
  });

  it('rejects codes without .CNA', () => {
    expect(validateOrionMedicineCode('ABC123')).toEqual({
      isValid: false,
      nationalCode: null,
      discardReason: 'Registro descartado: no contiene el sufijo .CNA y se trata como no medicamentoso.',
    });
  });

  it('rejects codes that do not match the exact regex', () => {
    expect(validateOrionMedicineCode('12345.CNA')).toEqual({
      isValid: false,
      nationalCode: null,
      discardReason: 'Registro descartado: el código no cumple el patrón exacto ^\\d{6}\\.CNA$.',
    });
  });
});

describe('parseWorkbook', () => {
  it('parses a valid workbook, counts duplicates and exposes duplicate conflicts', () => {
    const buffer = makeWorkbook([
      { 'Código Orion': '123456.CNA', Descripción: 'Paracetamol' },
      { 'Código Orion': '123456.CNA', Descripción: 'Paracetamol duplicado' },
      { 'Código Orion': '654321.CNA', Descripción: 'Amoxicilina' },
      { 'Código Orion': 'ABC123', Descripción: 'Producto sanitario' },
    ]);

    const result = parseWorkbook(buffer, {
      sheetName: 'Hoja1',
      codeColumn: 'Código Orion',
      descriptionColumn: 'Descripción',
    });

    expect(result.summary).toEqual({
      totalRows: 4,
      validRows: 3,
      discardedRows: 1,
      uniqueNationalCodes: 2,
      duplicateNationalCodes: 1,
      duplicateValidRows: 1,
    });

    expect(result.duplicateConflicts).toEqual([
      {
        nationalCode: '123456',
        keptRowNumber: 2,
        discardedRowNumbers: [3],
        allRowNumbers: [2, 3],
        keptOrionCode: '123456.CNA',
        keptLocalDescription: 'Paracetamol',
      },
    ]);
  });

  it('throws an explicit error if the sheet does not exist', () => {
    const buffer = makeWorkbook([{ 'Código Orion': '123456.CNA', Descripción: 'Paracetamol' }], 'HojaReal');

    expect(() =>
      parseWorkbook(buffer, {
        sheetName: 'HojaQueNoExiste',
        codeColumn: 'Código Orion',
        descriptionColumn: 'Descripción',
      }),
    ).toThrow('La hoja "HojaQueNoExiste" no existe en el fichero importado.');
  });


  it('uses the same normalized strategy for header validation and row reads', () => {
    const buffer = makeWorkbook([
      { ' Código Orion ': '123456.CNA', ' Descripción ': 'Paracetamol con espacios en cabecera' },
    ]);

    const result = parseWorkbook(buffer, {
      sheetName: 'Hoja1',
      codeColumn: 'Código Orion',
      descriptionColumn: 'Descripción',
    });

    expect(result.rows[0]).toMatchObject({
      orionCode: '123456.CNA',
      description: 'Paracetamol con espacios en cabecera',
      isValidMedicine: true,
      nationalCode: '123456',
    });
  });
  it('throws an explicit error if mapped columns are missing', () => {
    const buffer = makeWorkbook([{ Codigo: '123456.CNA', Nombre: 'Paracetamol' }]);

    expect(() =>
      parseWorkbook(buffer, {
        sheetName: 'Hoja1',
        codeColumn: 'Código Orion',
        descriptionColumn: 'Descripción',
      }),
    ).toThrow('El mapeo no coincide con el Excel.');
  });
});

describe('buildMedicineSnapshotWithConflicts', () => {
  it('deduplicates repeated valid CNs keeping the first valid row', () => {
    const rows: ParsedImportRow[] = [
      {
        rowNumber: 2,
        raw: {},
        orionCode: '123456.CNA',
        description: 'Fila ganadora',
        isValidMedicine: true,
        nationalCode: '123456',
        discardReason: null,
      },
      {
        rowNumber: 3,
        raw: {},
        orionCode: '123456.CNA',
        description: 'Fila descartada por duplicado',
        isValidMedicine: true,
        nationalCode: '123456',
        discardReason: null,
      },
    ];

    const result = buildMedicineSnapshotWithConflicts('batch-test', rows);

    expect(result.snapshot).toEqual([
      {
        importBatchId: 'batch-test',
        nationalCode: '123456',
        orionCode: '123456.CNA',
        localDescription: 'Fila ganadora',
        sourceRowNumber: 2,
      },
    ]);

    expect(result.duplicateConflicts).toEqual([
      {
        nationalCode: '123456',
        keptRowNumber: 2,
        discardedRowNumbers: [3],
        allRowNumbers: [2, 3],
        keptOrionCode: '123456.CNA',
        keptLocalDescription: 'Fila ganadora',
      },
    ]);
  });
});

describe('diffSnapshots', () => {
  it('detects added, removed and unchanged CNs', () => {
    const previous = [
      {
        importBatchId: 'previous',
        nationalCode: '123456',
        orionCode: '123456.CNA',
        localDescription: 'Paracetamol',
        sourceRowNumber: 2,
      },
      {
        importBatchId: 'previous',
        nationalCode: '888888',
        orionCode: '888888.CNA',
        localDescription: 'Ibuprofeno',
        sourceRowNumber: 3,
      },
    ];

    const current = [
      {
        importBatchId: 'current',
        nationalCode: '123456',
        orionCode: '123456.CNA',
        localDescription: 'Paracetamol',
        sourceRowNumber: 2,
      },
      {
        importBatchId: 'current',
        nationalCode: '654321',
        orionCode: '654321.CNA',
        localDescription: 'Amoxicilina',
        sourceRowNumber: 4,
      },
    ];

    expect(diffSnapshots(previous, current)).toEqual({
      added: ['654321'],
      removed: ['888888'],
      unchanged: ['123456'],
    });
  });
});
