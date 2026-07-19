export interface RecurringTransfer {
  id:                    string;
  fromAccountId:         string;
  fromAccountName:       string;
  toAccountId:           string;
  toAccountName:         string;
  amount:                number;
  description?:          string;
  dayOfMonth:            number;
  active:                boolean;
  lastTransferredMonth?: number;
  lastTransferredAt?:    string;
  createdAt:             string;
}
