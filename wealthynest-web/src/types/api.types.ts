export interface ApiResponse<T> {
  success:    boolean;
  status:     number;
  message?:   string;
  data:       T;
  timestamp:  string;
}

export interface PagedResponse<T> {
  success:   boolean;
  status:    number;
  data:      T[];
  meta:      PageMeta;
  timestamp: string;
}

export interface PageMeta {
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  first:         boolean;
  last:          boolean;
}

export interface ErrorResponse {
  success:     false;
  status:      number;
  error:       string;
  message:     string;
  path:        string;
  fieldErrors?: Record<string, string>;
  timestamp:   string;
}
