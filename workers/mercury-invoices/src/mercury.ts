import type {
  MercuryCreateInvoiceRequest,
  MercuryCustomer,
  MercuryCustomerListResponse,
  MercuryInvoiceListResponse,
  MercuryInvoiceResponse,
} from "./types.js";

const MERCURY_API_BASE = "https://api.mercury.com/api/v1";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const token = process.env.MERCURY_API_TOKEN;
  if (!token) throw new Error("MERCURY_API_TOKEN is not set");
  let response: Response;
  try {
    response = await fetch(`${MERCURY_API_BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      body
        ? "Mercury invoice creation has an unknown outcome. Reconcile all invoices by invoice number before retrying; never create another invoice with a fresh number."
        : "Mercury did not return a complete result. Stop dependent invoice creation and try the read again later.",
    );
  }
  if (!response.ok) {
    // Provider bodies can contain financial data. Never return them to agent logs.
    throw new Error(
      `Mercury request failed (${response.status}). Reconcile existing invoices before any creation retry.`,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      "Mercury returned an invalid response. Reconcile invoices by invoice number before any creation retry.",
    );
  }
}

export function listCustomers(
  limit?: number,
  startAfter?: string,
): Promise<MercuryCustomerListResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (startAfter) params.set("start_after", startAfter);
  return request(`/ar/customers?${params}`);
}

export function listInvoices(opts?: {
  limit?: number;
  startAfter?: string;
}): Promise<MercuryInvoiceListResponse> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.startAfter) params.set("start_after", opts.startAfter);
  return request(`/ar/invoices?${params}`);
}

export async function createInvoice(
  input: MercuryCreateInvoiceRequest,
): Promise<MercuryInvoiceResponse> {
  if (!input.invoiceNumber?.trim() || input.invoiceNumber !== input.invoiceNumber.trim()) {
    throw new Error(
      "An explicit, stable invoice number is required. Never use provider-generated numbering for retried operations.",
    );
  }
  // A preflight protects sequential retries; callers must not overlap runs of the same invoice.
  const existing = (await listAllInvoices()).filter(
    (invoice) => invoice.invoiceNumber === input.invoiceNumber,
  );
  if (existing.length) {
    throw new Error(
      "This invoice number already exists. Fetch and reconcile the existing invoice; do not create a second invoice or change the number to retry.",
    );
  }
  // Keep sending prohibited even if a future caller supplies a different option.
  return request("/ar/invoices", { ...input, sendEmailOption: "DontSend" });
}

export function getInvoice(invoiceId: string): Promise<MercuryInvoiceResponse> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) {
    throw new Error("A valid Mercury invoice UUID is required.");
  }
  return request(`/ar/invoices/${invoiceId}`);
}

export function buildInvoicePaymentUrl(slug: string): string {
  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    throw new Error(
      "Mercury did not return a valid public invoice slug. Fetch the invoice before using a payment link; never substitute its invoice UUID.",
    );
  }
  return `https://app.mercury.com/pay/${slug}`;
}

async function allPages<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; next: string | null }>,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await fetchPage(cursor);
    items.push(...result.items);
    if (result.next === null) return items;
    if (!result.next || seen.has(result.next))
      throw new Error(
        "Mercury pagination is incomplete. Stop invoice creation and reconcile in Mercury.",
      );
    seen.add(result.next);
    cursor = result.next;
  }
  throw new Error(
    "Mercury pagination exceeded the limit. Stop invoice creation; no complete search is available.",
  );
}

export function listAllInvoices(): Promise<MercuryInvoiceResponse[]> {
  return allPages(async (cursor) => {
    const response = await listInvoices({ limit: 100, startAfter: cursor });
    return { items: response.invoices, next: response.page.nextPage };
  });
}

export function listAllCustomers(): Promise<MercuryCustomer[]> {
  return allPages(async (cursor) => {
    const response = await listCustomers(100, cursor);
    return { items: response.customers, next: response.page.nextPage };
  });
}
