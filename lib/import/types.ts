export type NormalizedHeader = {
  raw: string;
  normalized: string;
};

export type ParseWarning = {
  code:
    | 'DUPLICATE_IDENTICAL_ROWS'
    | 'IGNORED_COLUMN'
    | 'UNNAMED_COLUMN_IGNORED'
    | 'DECODING_FALLBACK_USED';
  message: string;
  rowNumbers?: number[];
  context?: Record<string, string | number | string[] | number[] | null>;
};

export type ParseError = {
  code:
    | 'MISSING_REQUIRED_COLUMNS'
    | 'AMBIGUOUS_HEADERS'
    | 'DUPLICATE_CONFLICT'
    | 'EMPTY_INPUT'
    | 'INVALID_STRUCTURE';
  message: string;
  rowNumbers?: number[];
  context?: Record<string, string | number | string[] | number[] | null>;
};

export type ParseResult<TItem> = {
  headers: NormalizedHeader[];
  items: TItem[];
  warnings: ParseWarning[];
  errors: ParseError[];
  rowCount: number;
  duplicateCount: number;
};

export type OrionCatalogItem = {
  articleCode: string;
  shortDescription: string;
  longDescription: string | null;
  unit: string | null;
  statusOriginal: string;
  statusNormalized: string;
  sourceFile: string;
  rowNumber: number;
};
