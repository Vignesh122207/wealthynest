export interface RecurringGoalContribution {
  id:                    string;
  goalId:                string;
  goalName:              string;
  goalIcon?:             string;
  goalColor?:            string;
  amount:                number;
  dayOfMonth:            number;
  active:                boolean;
  lastContributedMonth?: number;
  lastContributedAt?:    string;
  createdAt:             string;
}
