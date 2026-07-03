export type LiabilityType =
  | "HOME_LOAN" | "CAR_LOAN" | "PERSONAL_LOAN"
  | "CREDIT_CARD" | "EDUCATION_LOAN" | "BUSINESS_LOAN" | "OTHER";

export interface Liability {
  id:                string;
  name:              string;
  liabilityType:     LiabilityType;
  principalAmount:   number;
  outstandingAmount: number;
  interestRate?:     number;
  lenderName?:       string;
  emiAmount?:        number;
  startDate?:        string;
  endDate?:          string;
  notes?:            string;
  active:            boolean;
  createdAt:         string;
  updatedAt:         string;
}

export interface CreateLiabilityPayload {
  name:              string;
  liabilityType:     LiabilityType;
  principalAmount:   number;
  outstandingAmount: number;
  interestRate?:     number;
  lenderName?:       string;
  emiAmount?:        number;
  startDate?:        string;
  endDate?:          string;
  notes?:            string;
}
