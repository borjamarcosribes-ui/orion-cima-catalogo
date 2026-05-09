import type { OrionCatalogItem, ParseError, ParseResult, ParseWarning } from '@/lib/import/types';

export type PersistedTsvImportHistoryEntry = {
  id: string;
  fileName: string;
  importedAt: string;
  rowCount: number;
  validItems: number;
  duplicateCount: number;
  warningCount: number;
  errorCount: number;
};

export type PersistedTsvImportPreview = {
  id: string;
  fileName: string;
  importedAt: string;
  result: ParseResult<OrionCatalogItem>;
};

export type SaveTsvImportPayload = {
  fileName: string;
  rowCount: number;
  duplicateCount: number;
  warnings: ParseWarning[];
  errors: ParseError[];
  items: OrionCatalogItem[];
};

export type SaveTsvImportResult =
  | {
      ok: true;
      savedImport: PersistedTsvImportHistoryEntry;
      history: PersistedTsvImportHistoryEntry[];
    }
  | {
      ok: false;
      message: string;
      history: PersistedTsvImportHistoryEntry[];
    };