export interface ExpenseSplit {
  id:                string;
  expenseId:         string;
  expenseDescription?: string;
  categoryName?:     string;
  expenseDate?:      string;
  payerUserId:       string;
  payerName:         string;
  participantUserId: string;
  participantName:   string;
  shareAmount:       number;
  status:            "PENDING" | "SETTLED";
  settledAt?:        string;
}

export interface SplitBalance {
  counterpartUserId: string;
  counterpartName:   string;
  /** Positive = counterpart owes the current user; negative = current user owes counterpart. */
  netAmount:          number;
}

export interface MySplits {
  balances: SplitBalance[];
  pending:  ExpenseSplit[];
}

export interface SplitParticipantPayload {
  userId:      string;
  shareAmount: number;
}
