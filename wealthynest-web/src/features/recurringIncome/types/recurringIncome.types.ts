export interface RecurringIncome {
  id:                 string;
  accountId:          string;
  accountName:        string;
  source:             string;
  amount:             number;
  description?:       string;
  dayOfMonth:         number;
  active:             boolean;
  lastCreditedMonth?: number;
  lastCreditedAt?:    string;
  createdAt:          string;
}
