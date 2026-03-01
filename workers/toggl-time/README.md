# toggl-time

A Notion Worker that integrates with [Toggl Track](https://toggl.com/) for time tracking, billable hours reporting, and invoice generation.

## Tools

| Tool | Description |
|------|-------------|
| `listWorkspaces` | List available Toggl workspaces (id, name, currency) |
| `listClients` | List non-archived clients in a workspace |
| `monthlyInvoice` | Generate a monthly invoice report with billable hours, rates, and amounts broken down by client and person |
| `billableSummary` | Get a quick billable summary for any date range |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TOGGL_API_KEY` | Toggl API token (from https://track.toggl.com/profile) |

## Setup

1. Copy the environment template and fill in your values:

   ```sh
   cp .env.example .env
   ```

2. Initialize the worker:

   ```sh
   ntn workers new
   ```

3. Deploy:

   ```sh
   ntn workers deploy
   ```

4. Push secrets:

   ```sh
   ntn workers env push
   ```
