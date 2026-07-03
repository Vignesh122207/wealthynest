export interface Asset {
  id:             string;
  name:           string;
  assetType:      string;
  currentValue:   number;
  currency:       string;
  institution?:   string;
  accountNumber?: string;
  notes?:         string;
  active:         boolean;
  asOfDate:       string;
  createdAt:      string;
  updatedAt:      string;
}

export interface CreateAssetPayload {
  name:           string;
  assetType:      string;
  currentValue:   number;
  institution?:   string;
  accountNumber?: string;
  notes?:         string;
  asOfDate?:      string;
}
