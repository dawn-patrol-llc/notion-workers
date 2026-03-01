import type {
  MercuryCreateInvoiceRequest,
  MercuryCustomerListResponse,
  MercuryInvoiceListResponse,
  MercuryInvoiceResponse,
} from "./types.js";

const MERCURY_API_BASE = "https://api.mercury.com/api/v1";

function getHeaders(): Record<string, string> {
  const token = process.env.MERCURY_API_TOKEN;
  if (!token) {
    throw new Error("MERCURY_API_TOKEN is not set");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function listCustomers(
  limit?: number
): Promise<MercuryCustomerListResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));

  const response = await fetch(
    `${MERCURY_API_BASE}/ar/customers?${params.toString()}`,
    { method: "GET", headers: getHeaders() }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mercury API error (${response.status}): ${body}`);
  }

  return response.json() as Promise<MercuryCustomerListResponse>;
}

export async function listInvoices(opts?: {
  limit?: number;
  startAfter?: string;
}): Promise<MercuryInvoiceListResponse> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.startAfter) params.set("start_after", opts.startAfter);

  const response = await fetch(
    `${MERCURY_API_BASE}/ar/invoices?${params.toString()}`,
    { method: "GET", headers: getHeaders() }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mercury API error (${response.status}): ${body}`);
  }

  return response.json() as Promise<MercuryInvoiceListResponse>;
}

export async function createInvoice(
  request: MercuryCreateInvoiceRequest
): Promise<MercuryInvoiceResponse> {
  const response = await fetch(`${MERCURY_API_BASE}/ar/invoices`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Mercury API error (${response.status}): ${body}`
    );
  }

  return response.json() as Promise<MercuryInvoiceResponse>;
}

export async function getInvoice(
  invoiceId: string
): Promise<MercuryInvoiceResponse> {
  const response = await fetch(
    `${MERCURY_API_BASE}/ar/invoices/${invoiceId}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Mercury API error (${response.status}): ${body}`
    );
  }

  return response.json() as Promise<MercuryInvoiceResponse>;
}

export function buildInvoicePaymentUrl(slug: string): string {
  return `https://app.mercury.com/invoices/${slug}`;
}
