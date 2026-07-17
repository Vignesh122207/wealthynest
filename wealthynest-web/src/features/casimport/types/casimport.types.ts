export interface CasParsedHolding {
  rowIndex:        number;
  schemeName:      string;
  schemeCode?:     string;
  folioNumber?:    string;
  units:           number | null;
  nav:             number | null;
  currentValue:    number | null;
  investedAmount?: number | null;
  valid:           boolean;
  error?:          string;
}

export interface CasPreview {
  needsPassword: boolean;
  holdings:      CasParsedHolding[];
}

export interface CasConfirmRow {
  schemeName:      string;
  schemeCode?:     string;
  folioNumber?:    string;
  units:           number;
  nav:             number;
  currentValue:    number;
  investedAmount?: number;
}

export interface CasImportResult {
  created: number;
  failed:  number;
  errors:  string[];
}
