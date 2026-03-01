import type {
  MonthlyInvoiceReport,
  BillableSummary,
  OutputFormat,
} from "./types.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function secondsToHoursDecimal(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(2);
}

export function secondsToHHMMSS(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function centsToAmount(cents: number, currency: string = "USD"): string {
  const amount = cents / 100;
  const symbol = currency === "USD" ? "$" : currency;
  return `${symbol}${amount.toFixed(2)}`;
}

export function getPreviousMonth(): { month: number; year: number } {
  const now = new Date();
  let month = now.getMonth(); // 0-indexed, so current month - 1 for previous
  let year = now.getFullYear();

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return { month, year };
}

export function getMonthDateRange(
  month: number,
  year: number
): { start: string; end: string } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const formatDate = (d: Date): string => {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  };

  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
}

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] || "Unknown";
}

export function formatInvoiceReport(
  report: MonthlyInvoiceReport,
  format: OutputFormat
): string {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  if (format === "markdown") {
    return formatInvoiceAsMarkdown(report);
  }

  return formatInvoiceAsText(report);
}

function formatInvoiceAsText(report: MonthlyInvoiceReport): string {
  const lines: string[] = [];

  lines.push(`INVOICE REPORT - ${report.period.monthName} ${report.period.year}`);
  lines.push(`Workspace: ${report.workspace.name}`);
  lines.push(`Period: ${report.period.startDate} to ${report.period.endDate}`);
  lines.push("");
  lines.push("=== TOTALS ===");
  lines.push(`Total Hours: ${report.totals.totalHoursDecimal} (${report.totals.totalHoursFormatted})`);
  lines.push(`Billable Hours: ${report.totals.billableHoursDecimal} (${report.totals.billableHoursFormatted})`);
  lines.push(`Total Amount: ${report.totals.billableAmountFormatted}`);
  lines.push("");

  for (const client of report.clients) {
    lines.push(`=== ${client.clientName} ===`);
    lines.push(`  Hours: ${client.billableHoursDecimal} | Amount: ${client.billableAmountFormatted}`);
    lines.push("");

    for (const person of client.persons) {
      lines.push(`  ${person.name}`);
      lines.push(`    Hours: ${person.billableHoursDecimal} (${person.billableHoursFormatted})`);
      lines.push(`    Rate: ${person.hourlyRateFormatted}`);
      lines.push(`    Amount: ${person.billableAmountFormatted}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatInvoiceAsMarkdown(report: MonthlyInvoiceReport): string {
  const lines: string[] = [];

  lines.push(`# Invoice Report - ${report.period.monthName} ${report.period.year}`);
  lines.push("");
  lines.push(`**Workspace:** ${report.workspace.name}`);
  lines.push(`**Period:** ${report.period.startDate} to ${report.period.endDate}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total Hours | ${report.totals.totalHoursDecimal} (${report.totals.totalHoursFormatted}) |`);
  lines.push(`| Billable Hours | ${report.totals.billableHoursDecimal} (${report.totals.billableHoursFormatted}) |`);
  lines.push(`| **Total Amount** | **${report.totals.billableAmountFormatted}** |`);
  lines.push("");

  for (const client of report.clients) {
    lines.push(`## ${client.clientName}`);
    lines.push("");
    lines.push(`**Subtotal:** ${client.billableHoursDecimal} hours | ${client.billableAmountFormatted}`);
    lines.push("");
    lines.push("| Person | Hours | Hours (HH:MM:SS) | Rate | Amount |");
    lines.push("|--------|-------|------------------|------|--------|");

    for (const person of client.persons) {
      lines.push(`| ${person.name} | ${person.billableHoursDecimal} | ${person.billableHoursFormatted} | ${person.hourlyRateFormatted} | ${person.billableAmountFormatted} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatBillableSummary(
  summary: BillableSummary,
  format: OutputFormat
): string {
  if (format === "json") {
    return JSON.stringify(summary, null, 2);
  }

  const lines: string[] = [];
  lines.push(`Period: ${summary.startDate} to ${summary.endDate}`);
  lines.push(`Total Hours: ${summary.totalHoursDecimal} (${summary.totalHoursFormatted})`);
  lines.push(`Billable Hours: ${summary.billableHoursDecimal} (${summary.billableHoursFormatted})`);
  lines.push(`Total Amount: ${summary.billableAmountFormatted}`);

  return lines.join("\n");
}
