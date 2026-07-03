export interface Family {
  id:         string;
  name:       string;
  inviteCode: string;
  createdAt:  string;
}

export interface FamilyMember {
  id:       string;
  fullName: string;
  email:    string;
  role:     "ADMIN" | "FAMILY_ADMIN" | "MEMBER";
}

export interface FamilyMonthlyStats {
  totalIncome:          number;
  totalExpense:         number;
  savings:              number;
  highestSpenderName:   string | null;
  highestSpenderAmount: number | null;
}
