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

## Development

```sh
# Type-check
pnpm check

# Build
pnpm build

# Test a tool locally
ntn workers exec createInvoice
```

## License

[MIT](../../LICENSE)
