import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  buildInvoicePaymentUrl,
  createInvoice,
  listAllCustomers,
  listAllInvoices,
} from "../dist/mercury.js";

const originalFetch = globalThis.fetch;
const token = process.env.MERCURY_API_TOKEN;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (token === undefined) delete process.env.MERCURY_API_TOKEN;
  else process.env.MERCURY_API_TOKEN = token;
});
function fakeFetch(fn) {
  process.env.MERCURY_API_TOKEN = "test-only-secret";
  globalThis.fetch = fn;
}
const input = {
  invoiceNumber: "2026-10-EXAMPLE",
  customerId: "customer",
  invoiceDate: "2026-11-01",
  dueDate: "2026-11-06",
  destinationAccountId: "account",
  lineItems: [{ name: "Work", quantity: 1, unitPrice: 10 }],
  ccEmails: [],
  creditCardEnabled: false,
  achDebitEnabled: true,
  useRealAccountNumber: false,
  sendEmailOption: "DontSend",
};

test("requires a stable invoice number before performing any provider request", async () => {
  let calls = 0;
  fakeFetch(async () => {
    calls++;
    throw new Error("unexpected");
  });
  for (const invoiceNumber of [undefined, null, "", " ", " 2026-10-EXAMPLE"]) {
    await assert.rejects(createInvoice({ ...input, invoiceNumber }), /stable invoice number/);
  }
  assert.equal(calls, 0);
});

test("uses the provider's public slug for /pay links and refuses missing or malformed slugs", () => {
  assert.equal(buildInvoicePaymentUrl("public-slug"), "https://app.mercury.com/pay/public-slug");
  for (const bad of [undefined, "", "../internal", "https://other.test"])
    assert.throws(() => buildInvoicePaymentUrl(bad));
});

test("checks all invoice pages and refuses a duplicate found beyond the first 100", async () => {
  const calls = [];
  fakeFetch(async (url, init) => {
    calls.push({ url, init });
    return url.includes("start_after=")
      ? Response.json({
          invoices: [{ id: "existing", invoiceNumber: input.invoiceNumber }],
          page: { nextPage: null },
        })
      : Response.json({ invoices: [], page: { nextPage: "next-cursor" } });
  });
  await assert.rejects(createInvoice(input), /already exists/);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /start_after=next-cursor/);
  assert.ok(calls.every(({ init }) => init.method === "GET"));
});

test("fails on incomplete pagination and scans every customer page", async () => {
  fakeFetch(async () => Response.json({ invoices: [], page: { nextPage: "repeated" } }));
  await assert.rejects(listAllInvoices(), /pagination is incomplete/);
  let count = 0;
  fakeFetch(async () =>
    Response.json({
      customers: [{ id: String(++count) }],
      page: { nextPage: count === 1 ? "next" : null },
    }),
  );
  assert.equal((await listAllCustomers()).length, 2);
});

test("forces DontSend at the provider boundary and never retries an ambiguous POST", async () => {
  let posts = 0;
  fakeFetch(async (_url, init) => {
    if (init.method === "GET") return Response.json({ invoices: [], page: { nextPage: null } });
    posts++;
    assert.equal(JSON.parse(init.body).sendEmailOption, "DontSend");
    assert.equal(init.redirect, "error");
    throw new Error("test-only-secret");
  });
  await assert.rejects(createInvoice({ ...input, sendEmailOption: "SendNow" }), (error) => {
    assert.match(error.message, /unknown outcome/);
    assert.doesNotMatch(error.message, /test-only-secret/);
    return true;
  });
  assert.equal(posts, 1);
});
