// Toggl API Response Types

export interface TogglWorkspace {
  id: number;
  name: string;
  default_currency: string;
  default_hourly_rate: number | null;
}

export interface TogglClient {
  id: number;
  name: string;
  wid: number;
  archived: boolean;
}

export interface TogglProject {
  id: number;
  name: string;
  wid: number;
  cid: number | null;
  client_id: number | null;
  billable: boolean;
  rate: number | null;
}

export interface TogglWorkspaceUser {
  id: number;
  user_id: number;
  name: string;
  email: string;
  hourly_rate: number | null;
}

// Reports API v3 response types
export interface TogglReportTimeEntry {
  id: number;
  seconds?: number;
  duration?: number;
  time_entries?: Array<{ seconds?: number; duration?: number }>;
  start: string;
  stop: string;
  at: string;
  user_id: number;
  username: string;
  project_id: number | null;
  billable: boolean;
  description: string | null;
  billable_amount_in_cents: number | null;
  hourly_rate_in_cents: number | null;
}

// Invoice Report Types

export interface PersonBillingSummary {
  userId: number;
  name: string;
  totalSeconds: number;
  totalHoursDecimal: string;
  totalHoursFormatted: string;
  billableSeconds: number;
  billableHoursDecimal: string;
  billableHoursFormatted: string;
  hourlyRateCents: number | null;
  hourlyRateFormatted: string;
  billableAmountCents: number;
  billableAmountFormatted: string;
}

export interface ClientBillingSummary {
  clientId: number | null;
  clientName: string;
  totalSeconds: number;
  totalHoursDecimal: string;
  totalHoursFormatted: string;
  billableSeconds: number;
  billableHoursDecimal: string;
  billableHoursFormatted: string;
  billableAmountCents: number;
  billableAmountFormatted: string;
  persons: PersonBillingSummary[];
}

export interface MonthlyInvoiceReport {
  period: {
    month: number;
    year: number;
    monthName: string;
    startDate: string;
    endDate: string;
  };
  workspace: {
    id: number;
    name: string;
    currency: string;
  };
  totals: {
    totalSeconds: number;
    totalHoursDecimal: string;
    totalHoursFormatted: string;
    billableSeconds: number;
    billableHoursDecimal: string;
    billableHoursFormatted: string;
    billableAmountCents: number;
    billableAmountFormatted: string;
  };
  clients: ClientBillingSummary[];
}

export interface BillableSummary {
  startDate: string;
  endDate: string;
  totalSeconds: number;
  totalHoursDecimal: string;
  totalHoursFormatted: string;
  billableSeconds: number;
  billableHoursDecimal: string;
  billableHoursFormatted: string;
  billableAmountCents: number;
  billableAmountFormatted: string;
}

export type OutputFormat = "json" | "text" | "markdown";

// API Client params
export interface DetailedReportParams {
  startDate: string;
  endDate: string;
  clientIds?: number[];
}
