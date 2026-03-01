export interface MercuryCustomerAddress {
  address1: string;
  address2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface MercuryCustomer {
  id: string;
  name: string;
  email: string;
  address: MercuryCustomerAddress | null;
  deletedAt: string | null;
}

export interface MercuryPaginationPage {
  nextPage: string | null;
  previousPage: string | null;
}

export interface MercuryCustomerListResponse {
  customers: MercuryCustomer[];
  page: MercuryPaginationPage;
}

export interface MercuryInvoiceListResponse {
  invoices: MercuryInvoiceResponse[];
  page: MercuryPaginationPage;
}

export interface MercuryLineItem {
  name: string;
  unitPrice: number;
  quantity: number;
  salesTaxRate?: number;
}

export interface MercuryCreateInvoiceRequest {
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate: string;
  customerId: string;
  destinationAccountId: string;
  lineItems: MercuryLineItem[];
  ccEmails: string[];
  creditCardEnabled: boolean;
  achDebitEnabled: boolean;
  useRealAccountNumber: boolean;
  payerMemo?: string;
  internalNote?: string;
  poNumber?: string;
  servicePeriodStartDate?: string;
  servicePeriodEndDate?: string;
  sendEmailOption: "DontSend" | "SendNow";
}

export type MercuryInvoiceStatus =
  | "Unpaid"
  | "Paid"
  | "Cancelled"
  | "Processing";

export interface MercuryInvoiceResponse {
  id: string;
  invoiceNumber: string;
  status: MercuryInvoiceStatus;
  amount: number;
  customerId: string;
  dueDate: string;
  invoiceDate: string;
  slug: string;
  creditCardEnabled: boolean;
  achDebitEnabled: boolean;
  useRealAccountNumber: boolean;
  destinationAccountId: string;
  lineItems: MercuryLineItem[];
  ccEmails: string[];
  createdAt: string;
  updatedAt: string;
  canceledAt: string | null;
  payerMemo?: string;
  internalNote?: string;
  poNumber?: string;
  servicePeriodStartDate?: string;
  servicePeriodEndDate?: string;
}
