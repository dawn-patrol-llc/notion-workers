# time-calc

A Notion Worker for time format conversions and billable amount calculations.

## Tools

| Tool | Description |
|------|-------------|
| `convertToDecimal` | Convert HH:MM:SS to decimal hours, optionally calculate billable amount with a rate |
| `convertToHms` | Convert decimal hours to HH:MM:SS |
| `calculateBillable` | Given decimal hours and hourly rate, return billable amount |

## Setup

No environment variables required — this worker has no external dependencies.

1. Initialize the worker:

   ```sh
   ntn workers new
   ```

2. Deploy:

   ```sh
   ntn workers deploy
   ```
