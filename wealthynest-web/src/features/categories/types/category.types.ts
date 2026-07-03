export interface Category {
  id:       string;
  name:     string;
  icon?:    string;
  color?:   string;
  type:     "EXPENSE" | "INCOME" | "TRANSFER";
  isSystem: boolean;
  userId?:  string;
}
