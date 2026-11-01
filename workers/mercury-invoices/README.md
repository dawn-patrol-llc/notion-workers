# Mercury Invoices Worker

A Notion Worker that integrates with the [Mercury Accounts Receivable API](https://docs.mercury.com/reference/accounts-receivable) to create and manage invoices directly from Notion agents.

## Tools

| Tool | Description |
|------|-------------|
| `createInvoice` | Creates a draft invoice in Mercury with line items, due dates, and service periods. Returns an invoice ID and payment link. |
| `getInvoice` | Retrieves an existing invoice by ID, including status, line items, and payment link. |
| `listCustomers` | Lists Mercury customers with optional name search. Use to find customer UUIDs before creating invoices. |
| `listInvoices` | Lists invoices with optional filtering by customer name and status (Unpaid, Paid, Cancelled, Processing). |

## Prerequisites

- A [Mercury](https://mercury.com) account with API access
- A Mercury API token with accounts receivable permissions
- The Notion CLI (`ntn`) installed globally: `npm i -g ntn`

## Setup

1. **Install dependencies** (from the repo root):

   ```sh
   pnpm install
   ```

2. **Initialize the worker with Notion:**

   ```sh
   ntn workers new
   ```

   This generates a `workers.json` file linking the worker to your Notion workspace. This file is gitignored since it contains deployment-specific IDs.

3. **Configure environment variables:**

   Copy the example env file and fill in your credentials:

   ```sh
   cp .env.example .env
   ```

   | Variable | Description |
   |----------|-------------|
   | `MERCURY_API_TOKEN` | Your Mercury API token |
   | `MERCURY_ACCOUNT_ID` | The UUID of the Mercury account to receive payments |

   For deployed workers, set secrets via the CLI:

   ```sh
   ntn workers env set MERCURY_API_TOKEN=your-token
   ntn workers env set MERCURY_ACCOUNT_ID=your-account-id
   ```

4. **Deploy:**

   ```sh
   ntn workers deploy
   ```

5. **Add to your Notion agent** by opening your agent's settings in Notion and adding the deployed worker's tools.

## How It Works

The worker wraps Mercury's [Accounts Receivable API](https://docs.mercury.com/reference/accounts-receivable):

- **`src/index.ts`** — Tool definitions using the `@notionhq/workers` framework. Each tool defines a JSON Schema for inputs and an `execute` function.
- **`src/mercury.ts`** — HTTP client for the Mercury API. Handles bearer token auth and provides typed functions for each endpoint.
- **`src/types.ts`** — TypeScript interfaces for Mercury API request and response shapes.

All secrets are read from environment variables at runtime. No credentials are stored in source code.

## Invoice review and safe retries

Invoices are always created with `sendEmailOption: "DontSend"`, enforced in the API client as well as the tool. This worker has no send tool. Automated reminders, recurrence, and the one-time payment control are not exposed; the create result lists these for manual verification. Do not claim they were configured.

Customer and invoice searches follow every page, with a bounded loop that fails on repeated or incomplete cursors. Before creating an invoice, the client searches all invoices for the exact invoice number and refuses a duplicate, including cancelled or paid invoices. Fetch and compare an existing invoice's customer, amount, period, and memo before reusing it. This preflight protects sequential retries; it does not lock out simultaneous runs. Do not overlap runs for the same billing period.

Creation now requires an explicit, stable `invoiceNumber`; null or implicit per-day/provider numbering is no longer supported. Mercury's [invoicing guide](https://docs.mercury.com/docs/invoicing) additionally documents duplicate-number rejection. Keep the preflight and reconcile uncertain responses. The worker still has no durable operation ledger or concurrency lock; it must not be enabled on a dry-run agent. A future authorized writer should enforce fixed billing policy and durable reservations before calling this adapter.

Timeouts and failed creation responses require reconciliation before retrying. The client never retries a POST automatically, never includes provider bodies in errors, and refuses credential-bearing redirects. Public payment links use the provider-returned `slug` at `https://app.mercury.com/pay/{slug}`. Missing or malformed slugs are an error; internal invoice UUIDs are never used as a fallback.

Client-specific rates, customer IDs, recipients, and agent instructions belong in the private Notion agent, outside this public repository.

## Development

```sh
# Type-check
pnpm check

# Build
pnpm build

# Offline HTTP-fixture tests (no real invoices or secrets)
pnpm test

# Test a tool locally
ntn workers exec createInvoice
```

## License

[MIT](../../LICENSE)
