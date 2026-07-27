export interface Goal {
  id:            string;
  name:          string;
  icon?:         string;
  color?:        string;
  targetAmount:  number;
  savedAmount:   number;
  targetDate?:   string;
  percentSaved:  number;
  createdAt:     string;
  accountId?:    string;
  accountName?:  string;
  paused?:       boolean;
  shared?:       boolean;
}

export interface CreateGoalPayload {
  name:           string;
  icon?:          string;
  color?:         string;
  targetAmount:   number;
  savedAmount?:   number;
  targetDate?:    string;
  accountId?:     string;
  unlinkAccount?: boolean;
  paused?:        boolean;
}
