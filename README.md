# Notion Workers

A monorepo of [Notion Workers](https://github.com/makenotion/workers-template) that extend Notion agents with third-party API integrations.

Each worker in the `workers/` directory is a standalone Notion Worker that can be deployed independently to give your Notion agents new capabilities.

## Workers

| Worker | Description |
|--------|-------------|
| [mercury-invoices](./workers/mercury-invoices/) | Create and manage invoices through the Mercury banking API |
| [toggl-time](./workers/toggl-time/) | Toggl time tracking, billable hours reporting, and invoice generation |
| [time-calc](./workers/time-calc/) | Time format conversions (HH:MM:SS / decimal) and billable amount calculations |

## Prerequisites

- Node.js >= 22
- [pnpm](https://pnpm.io/) (v10+)
- [Notion CLI (`ntn`)](https://www.npmjs.com/package/ntn) installed globally

## Getting Started

1. Clone the repository:

   ```sh
   git clone https://github.com/dawn-patrol-llc/notion-workers.git
   cd notion-workers
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Pick a worker from the table above and follow its README for configuration and deployment.

## Monorepo Structure

```
notion-workers/
├── package.json            # Root workspace config
├── pnpm-workspace.yaml     # Defines workers/* as workspace packages
├── tsconfig.base.json      # Shared TypeScript configuration
└── workers/
    ├── mercury-invoices/   # Mercury invoicing worker
    ├── toggl-time/         # Toggl time tracking worker
    └── time-calc/          # Time calculation utilities worker
```

## Adding a New Worker

1. Scaffold a new worker:

   ```sh
   cd workers
   ntn workers new
   ```

2. The CLI creates a new directory with a `workers.json`, `package.json`, and `src/index.ts`.

3. Add your tools to `src/index.ts` following the pattern in existing workers.

4. Deploy:

   ```sh
   cd workers/your-new-worker
   ntn workers deploy
   ```

## Development

```sh
# Type-check all workers
pnpm check

# Build all workers
pnpm build
```

## License

[MIT](./LICENSE)
