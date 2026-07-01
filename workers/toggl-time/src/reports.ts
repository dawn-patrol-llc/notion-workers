import type {
  TogglReportTimeEntry,
  MonthlyInvoiceReport,
  BillableSummary,
  ClientBillingSummary,
  ProjectBillingSummary,
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
  projectToClientMap: Map<number, number | null>,
  projectMap: Map<number, string>
): MonthlyInvoiceReport {
  interface PersonData {
    totalSeconds: number;
    billableSeconds: number;
    billableAmountCents: number;
    hourlyRateCents: number | null;
  }

  interface ProjectData {
    persons: Map<number, PersonData>;
  }

  interface ClientData {
    projects: Map<number | null, ProjectData>;
  }

  const clientGroups = new Map<number | null, ClientData>();

  for (const entry of entries) {
    const projectId = entry.project_id ?? null;
    const clientId =
      projectId !== null ? projectToClientMap.get(projectId) ?? null : null;

    if (!clientGroups.has(clientId)) {
      clientGroups.set(clientId, { projects: new Map() });
    }

    const clientData = clientGroups.get(clientId)!;

    if (!clientData.projects.has(projectId)) {
      clientData.projects.set(projectId, { persons: new Map() });
    }

    const projectData = clientData.projects.get(projectId)!;

    if (!projectData.persons.has(entry.user_id)) {
      projectData.persons.set(entry.user_id, {
        totalSeconds: 0,
        billableSeconds: 0,
        billableAmountCents: 0,
        hourlyRateCents: null,
      });
    }

    const personData = projectData.persons.get(entry.user_id)!;
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

  const buildPerson = (
    userId: number,
    personData: PersonData
  ): PersonBillingSummary => ({
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
  });

  const clients: ClientBillingSummary[] = [];
  let totalSeconds = 0;
  let totalBillableSeconds = 0;
  let totalBillableAmountCents = 0;

  for (const [clientId, clientData] of clientGroups) {
    const projects: ProjectBillingSummary[] = [];
    // Aggregate person totals across all projects for the client-level rollup.
    const clientPersons = new Map<number, PersonData>();
    let clientTotalSeconds = 0;
    let clientBillableSeconds = 0;
    let clientBillableAmountCents = 0;

    for (const [projectId, projectData] of clientData.projects) {
      const persons: PersonBillingSummary[] = [];
      let projectTotalSeconds = 0;
      let projectBillableSeconds = 0;
      let projectBillableAmountCents = 0;

      for (const [userId, personData] of projectData.persons) {
        persons.push(buildPerson(userId, personData));
        projectTotalSeconds += personData.totalSeconds;
        projectBillableSeconds += personData.billableSeconds;
        projectBillableAmountCents += personData.billableAmountCents;

        const rollup = clientPersons.get(userId) ?? {
          totalSeconds: 0,
          billableSeconds: 0,
          billableAmountCents: 0,
          hourlyRateCents: null,
        };
        rollup.totalSeconds += personData.totalSeconds;
        rollup.billableSeconds += personData.billableSeconds;
        rollup.billableAmountCents += personData.billableAmountCents;
        if (personData.hourlyRateCents !== null) {
          rollup.hourlyRateCents = personData.hourlyRateCents;
        }
        clientPersons.set(userId, rollup);
      }

      persons.sort((a, b) => a.name.localeCompare(b.name));

      projects.push({
        projectId,
        projectName:
          projectId !== null
            ? projectMap.get(projectId) ?? `Project ${projectId}`
            : "No Project",
        totalSeconds: projectTotalSeconds,
        totalHoursDecimal: secondsToHoursDecimal(projectTotalSeconds),
        totalHoursFormatted: secondsToHHMMSS(projectTotalSeconds),
        billableSeconds: projectBillableSeconds,
        billableHoursDecimal: secondsToHoursDecimal(projectBillableSeconds),
        billableHoursFormatted: secondsToHHMMSS(projectBillableSeconds),
        billableAmountCents: projectBillableAmountCents,
        billableAmountFormatted: centsToAmount(
          projectBillableAmountCents,
          workspace.currency
        ),
        persons,
      });

      clientTotalSeconds += projectTotalSeconds;
      clientBillableSeconds += projectBillableSeconds;
      clientBillableAmountCents += projectBillableAmountCents;
    }

    projects.sort((a, b) => {
      if (a.projectId === null) return 1;
      if (b.projectId === null) return -1;
      return a.projectName.localeCompare(b.projectName);
    });

    const persons: PersonBillingSummary[] = [];
    for (const [userId, personData] of clientPersons) {
      persons.push(buildPerson(userId, personData));
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
      projects,
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
