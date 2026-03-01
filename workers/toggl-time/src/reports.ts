import type {
  TogglReportTimeEntry,
  MonthlyInvoiceReport,
  BillableSummary,
  ClientBillingSummary,
  PersonBillingSummary,
} from "./types.js";
import {
  secondsToHoursDecimal,
  secondsToHHMMSS,
  centsToAmount,
} from "./formatters.js";

/** Extract seconds from an entry, handling different Toggl API field names */
export function getEntrySeconds(entry: TogglReportTimeEntry): number {
  if (typeof entry.seconds === "number") return entry.seconds;

  if (typeof entry.duration === "number") return entry.duration;

  if (entry.time_entries && Array.isArray(entry.time_entries)) {
    return entry.time_entries.reduce((sum, te) => {
      return sum + (te.seconds ?? te.duration ?? 0);
    }, 0);
  }

  if (entry.billable_amount_in_cents && entry.hourly_rate_in_cents) {
    const hours = entry.billable_amount_in_cents / entry.hourly_rate_in_cents;
    return Math.round(hours * 3600);
  }

  return 0;
}

/** Build a monthly invoice report from time entries */
export function buildInvoiceReport(
  entries: TogglReportTimeEntry[],
  period: MonthlyInvoiceReport["period"],
  workspace: MonthlyInvoiceReport["workspace"],
  userMap: Map<number, string>,
  clientMap: Map<number, string>,
  projectToClientMap: Map<number, number | null>
): MonthlyInvoiceReport {
  interface PersonData {
    totalSeconds: number;
    billableSeconds: number;
    billableAmountCents: number;
    hourlyRateCents: number | null;
  }

  interface ClientData {
    persons: Map<number, PersonData>;
  }

  const clientGroups = new Map<number | null, ClientData>();

  for (const entry of entries) {
    const clientId = entry.project_id
      ? projectToClientMap.get(entry.project_id) ?? null
      : null;

    if (!clientGroups.has(clientId)) {
      clientGroups.set(clientId, { persons: new Map() });
    }

    const clientData = clientGroups.get(clientId)!;

    if (!clientData.persons.has(entry.user_id)) {
      clientData.persons.set(entry.user_id, {
        totalSeconds: 0,
        billableSeconds: 0,
        billableAmountCents: 0,
        hourlyRateCents: null,
      });
    }

    const personData = clientData.persons.get(entry.user_id)!;
    const entrySeconds = getEntrySeconds(entry);
    personData.totalSeconds += entrySeconds;

    if (entry.billable) {
      personData.billableSeconds += entrySeconds;
      personData.billableAmountCents += entry.billable_amount_in_cents ?? 0;
      if (entry.hourly_rate_in_cents !== null) {
        personData.hourlyRateCents = entry.hourly_rate_in_cents;
      }
    }
  }

  const clients: ClientBillingSummary[] = [];
  let totalSeconds = 0;
  let totalBillableSeconds = 0;
  let totalBillableAmountCents = 0;

  for (const [clientId, clientData] of clientGroups) {
    const persons: PersonBillingSummary[] = [];
    let clientTotalSeconds = 0;
    let clientBillableSeconds = 0;
    let clientBillableAmountCents = 0;

    for (const [userId, personData] of clientData.persons) {
      const person: PersonBillingSummary = {
        userId,
        name: userMap.get(userId) ?? `User ${userId}`,
        totalSeconds: personData.totalSeconds,
        totalHoursDecimal: secondsToHoursDecimal(personData.totalSeconds),
        totalHoursFormatted: secondsToHHMMSS(personData.totalSeconds),
        billableSeconds: personData.billableSeconds,
        billableHoursDecimal: secondsToHoursDecimal(personData.billableSeconds),
        billableHoursFormatted: secondsToHHMMSS(personData.billableSeconds),
        hourlyRateCents: personData.hourlyRateCents,
        hourlyRateFormatted: personData.hourlyRateCents
          ? centsToAmount(personData.hourlyRateCents, workspace.currency) + "/hr"
          : "N/A",
        billableAmountCents: personData.billableAmountCents,
        billableAmountFormatted: centsToAmount(
          personData.billableAmountCents,
          workspace.currency
        ),
      };

      persons.push(person);
      clientTotalSeconds += personData.totalSeconds;
      clientBillableSeconds += personData.billableSeconds;
      clientBillableAmountCents += personData.billableAmountCents;
    }

    persons.sort((a, b) => a.name.localeCompare(b.name));

    clients.push({
      clientId,
      clientName: clientId ? clientMap.get(clientId) ?? `Client ${clientId}` : "No Client",
      totalSeconds: clientTotalSeconds,
      totalHoursDecimal: secondsToHoursDecimal(clientTotalSeconds),
      totalHoursFormatted: secondsToHHMMSS(clientTotalSeconds),
      billableSeconds: clientBillableSeconds,
      billableHoursDecimal: secondsToHoursDecimal(clientBillableSeconds),
      billableHoursFormatted: secondsToHHMMSS(clientBillableSeconds),
      billableAmountCents: clientBillableAmountCents,
      billableAmountFormatted: centsToAmount(
        clientBillableAmountCents,
        workspace.currency
      ),
      persons,
    });

    totalSeconds += clientTotalSeconds;
    totalBillableSeconds += clientBillableSeconds;
    totalBillableAmountCents += clientBillableAmountCents;
  }

  clients.sort((a, b) => {
    if (a.clientId === null) return 1;
    if (b.clientId === null) return -1;
    return a.clientName.localeCompare(b.clientName);
  });

  return {
    period,
    workspace,
    totals: {
      totalSeconds,
      totalHoursDecimal: secondsToHoursDecimal(totalSeconds),
      totalHoursFormatted: secondsToHHMMSS(totalSeconds),
      billableSeconds: totalBillableSeconds,
      billableHoursDecimal: secondsToHoursDecimal(totalBillableSeconds),
      billableHoursFormatted: secondsToHHMMSS(totalBillableSeconds),
      billableAmountCents: totalBillableAmountCents,
      billableAmountFormatted: centsToAmount(
        totalBillableAmountCents,
        workspace.currency
      ),
    },
    clients,
  };
}

/** Build a quick billable summary from time entries */
export function buildBillableSummary(
  entries: TogglReportTimeEntry[],
  startDate: string,
  endDate: string,
  currency: string
): BillableSummary {
  let totalSeconds = 0;
  let billableSeconds = 0;
  let billableAmountCents = 0;

  for (const entry of entries) {
    const entrySeconds = getEntrySeconds(entry);
    totalSeconds += entrySeconds;
    if (entry.billable) {
      billableSeconds += entrySeconds;
      billableAmountCents += entry.billable_amount_in_cents ?? 0;
    }
  }

  return {
    startDate,
    endDate,
    totalSeconds,
    totalHoursDecimal: secondsToHoursDecimal(totalSeconds),
    totalHoursFormatted: secondsToHHMMSS(totalSeconds),
    billableSeconds,
    billableHoursDecimal: secondsToHoursDecimal(billableSeconds),
    billableHoursFormatted: secondsToHHMMSS(billableSeconds),
    billableAmountCents,
    billableAmountFormatted: centsToAmount(billableAmountCents, currency),
  };
}
