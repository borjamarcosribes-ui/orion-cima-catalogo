import {
  buildMedicineSnapshotWithConflicts,
  diffSnapshots,
  type MedicineSnapshotRecord,
  type ParsedImportRow,
} from '@/lib/orion';
import { cimaIntegrationChecklist } from '@/lib/cima';

export const importConfigTemplate = {
  codeColumn: 'Código Orion',
  descriptionColumn: 'Descripción',
  sheetName: 'Hoja1',
};

export const sampleRows: ParsedImportRow[] = [
  {
    rowNumber: 2,
    raw: { 'Código Orion': '123456.CNA', Descripción: 'Paracetamol 1 g IV' },
    orionCode: '123456.CNA',
    description: 'Paracetamol 1 g IV',
    isValidMedicine: true,
    nationalCode: '123456',
    discardReason: null,
  },
  {
    rowNumber: 3,
    raw: { 'Código Orion': '123456.CNA', Descripción: 'Paracetamol 1 g IV duplicado en el batch' },
    orionCode: '123456.CNA',
    description: 'Paracetamol 1 g IV duplicado en el batch',
    isValidMedicine: true,
    nationalCode: '123456',
    discardReason: null,
  },
  {
    rowNumber: 4,
    raw: { 'Código Orion': '654321.CNA', Descripción: 'Amoxicilina 500 mg' },
    orionCode: '654321.CNA',
    description: 'Amoxicilina 500 mg',
    isValidMedicine: true,
    nationalCode: '654321',
    discardReason: null,
  },
  {
    rowNumber: 5,
    raw: { 'Código Orion': 'ABC123', Descripción: 'Producto sanitario' },
    orionCode: 'ABC123',
    description: 'Producto sanitario',
    isValidMedicine: false,
    nationalCode: null,
    discardReason: 'Registro descartado: no contiene el sufijo .CNA y se trata como no medicamentoso.',
  },
  {
    rowNumber: 6,
    raw: { 'Código Orion': '12345.CNA', Descripción: 'Código incompleto' },
    orionCode: '12345.CNA',
    description: 'Código incompleto',
    isValidMedicine: false,
    nationalCode: null,
    discardReason: 'Registro descartado: el código no cumple el patrón exacto ^\\d{6}\\.CNA$.',
  },
];

const currentSnapshotBuild = buildMedicineSnapshotWithConflicts('batch-current', sampleRows);
export const currentSnapshot = currentSnapshotBuild.snapshot;
export const currentDuplicateConflicts = currentSnapshotBuild.duplicateConflicts;

const previousRows: ParsedImportRow[] = [
  {
    rowNumber: 2,
    raw: { 'Código Orion': '123456.CNA', Descripción: 'Paracetamol 1 g IV' },
    orionCode: '123456.CNA',
    description: 'Paracetamol 1 g IV',
    isValidMedicine: true,
    nationalCode: '123456',
    discardReason: null,
  },
  {
    rowNumber: 3,
    raw: { 'Código Orion': '888888.CNA', Descripción: 'Ibuprofeno 600 mg' },
    orionCode: '888888.CNA',
    description: 'Ibuprofeno 600 mg',
    isValidMedicine: true,
    nationalCode: '888888',
    discardReason: null,
  },
];

const previousSnapshotBuild = buildMedicineSnapshotWithConflicts('batch-previous', previousRows);
export const previousSnapshot: MedicineSnapshotRecord[] = previousSnapshotBuild.snapshot;
export const snapshotDiff = diffSnapshots(previousSnapshot, currentSnapshot);

export const dashboardMetrics = {
  importBatches: 2,
  latestValidRows: sampleRows.filter((row) => row.isValidMedicine).length,
  latestUniqueNationalCodes: currentSnapshot.length,
  latestDiscardedRows: sampleRows.filter((row) => !row.isValidMedicine).length,
  duplicateNationalCodes: currentDuplicateConflicts.length,
  duplicateValidRowsCollapsed: currentDuplicateConflicts.reduce(
    (total, conflict) => total + conflict.discardedRowNumbers.length,
    0,
  ),
  activeCimaRecords: 0,
};

export const catalogDemoRows = [
  {
    nationalCode: '123456',
    preferredLabel: 'Paracetamol 1 g IV',
    latestOrionCode: '123456.CNA',
    latestSnapshotLabel: 'Snapshot 2026-03-19',
    cimaEnrichmentStatus: 'Pendiente de enriquecer',
  },
  {
    nationalCode: '654321',
    preferredLabel: 'Amoxicilina 500 mg',
    latestOrionCode: '654321.CNA',
    latestSnapshotLabel: 'Snapshot 2026-03-19',
    cimaEnrichmentStatus: 'Pendiente de enriquecer',
  },
];

export { cimaIntegrationChecklist };
