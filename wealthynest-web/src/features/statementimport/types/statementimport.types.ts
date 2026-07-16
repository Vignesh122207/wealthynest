export interface ParsedRow {
  rowIndex:              number;
  date:                  string | null;
  description:           string | null;
  amount:                number | null;
  type:                  "DEBIT" | "CREDIT" | null;
  suggestedCategoryId?:  string;
  suggestedCategoryName?: string;
  valid:                 boolean;
  error?:                string;
}

export interface ColumnMapping {
  dateColumn?:        number;
  descriptionColumn?: number;
  debitColumn?:        number;
  creditColumn?:       number;
  amountColumn?:       number;
}

export interface StatementPreview {
  needsMapping:  boolean;
  needsPassword: boolean;
  headers:       string[];
  sampleRows:    string[][];
  rows:          ParsedRow[];
}

export interface ConfirmRow {
  date:          string;
  description?:  string;
  amount:        number;
  type:          "DEBIT" | "CREDIT";
  categoryId?:   string;
  incomeSource?: string;
}

export interface ImportResult {
  created: number;
  failed:  number;
  errors:  string[];
}
