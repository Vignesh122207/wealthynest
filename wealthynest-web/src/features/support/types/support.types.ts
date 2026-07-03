export type TicketStatus   = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketCategory =
  | "BUG_REPORT"
  | "FEATURE_REQUEST"
  | "ACCOUNT_ISSUE"
  | "DATA_SYNC_ISSUE"
  | "GENERAL_QUESTION";

export interface TicketReply {
  id:          string;
  message:     string;
  adminReply:  boolean;
  authorName:  string;
  createdAt:   string;
}

export interface Ticket {
  id:          string;
  subject:     string;
  category:    TicketCategory;
  description: string;
  status:      TicketStatus;
  priority:    TicketPriority;
  userName?:   string;
  userEmail?:  string;
  createdAt:   string;
  updatedAt:   string;
  replyCount:  number;
  replies?:    TicketReply[];
}

export interface CreateTicketPayload {
  subject:     string;
  category:    TicketCategory;
  description: string;
}

export interface ReplyPayload {
  message: string;
}
