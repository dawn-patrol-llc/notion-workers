import { Worker } from "@notionhq/workers";
import { TogglAPIClient } from "./toggl.js";
import type { OutputFormat, TogglClient, TogglWorkspace } from "./types.js";
import {
  getPreviousMonth,
  getMonthDateRange,
  getMonthName,
  formatInvoiceReport,
  formatBillableSummary,
} from "./formatters.js";
import { buildInvoiceReport, buildBillableSummary } from "./reports.js";

const worker = new Worker();
export default worker;

worker.tool<Record<string, never>, string>("listWorkspaces", {
  title: "List Toggl Workspaces",
  description:
    "List available Toggl workspaces to get workspace IDs for other tools",
  schema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: async () => {
    const client = new TogglAPIClient();
    const workspaces = await client.getWorkspaces();

    const result = workspaces.map((ws: TogglWorkspace) => ({
      id: ws.id,
      name: ws.name,
      currency: ws.default_currency,
    }));

    return JSON.stringify(result, null, 2);
  },
});

worker.tool("listClients", {
  title: "List Toggl Clients",
  description: "List clients in a Toggl workspace for filtering invoice reports",
  schema: {
    type: "object",
    properties: {
      workspaceId: {
        type: "number",
        description: "The workspace ID",
      },
    },
    required: ["workspaceId"],
    additionalProperties: false,
  },
  execute: async ({ workspaceId }: { workspaceId: number }) => {
    const client = new TogglAPIClient();
    const clients = await client.getWorkspaceClients(workspaceId);

    const result = clients
      .filter((c: TogglClient) => !c.archived)
      .map((c: TogglClient) => ({
        id: c.id,
        name: c.name,
      }));

    return JSON.stringify(result, null, 2);
  },
});

worker.tool("monthlyInvoice", {
  title: "Monthly Invoice Report",
  description:
    "Generate a monthly invoice report with billable hours, rates, and amounts broken down by client and person",
  schema: {
    type: "object",
    properties: {
      workspaceId: {
        type: "number",
        description: "The workspace ID",
      },
      month: {
        anyOf: [{ type: "number" }, { type: "null" }],
        description:
          "Month number (1-12). Defaults to previous month. Pass null for default.",
      },
      year: {
        anyOf: [{ type: "number" }, { type: "null" }],
        description:
          "Year (2000-2100). Defaults to current year (or previous year if previous month is December). Pass null for default.",
      },
      clientIds: {
        anyOf: [
          { type: "array", items: { type: "number" } },
          { type: "null" },
        ],
        description:
          "Optional array of client IDs to filter by. Pass null for all clients.",
      },
      format: {
        anyOf: [
          { type: "string", enum: ["json", "text", "markdown"] },
          { type: "null" },
        ],
        description:
          "Output format: json, text, or markdown. Default: text. Pass null for default.",
      },
    },
    required: ["workspaceId", "month", "year", "clientIds", "format"],
    additionalProperties: false,
  },
  execute: async ({
    workspaceId,
    month,
    year,
    clientIds,
    format,
  }: {
    workspaceId: number;
    month: number | null;
    year: number | null;
    clientIds: number[] | null;
    format: string | null;
  }) => {
    const client = new TogglAPIClient();

    const defaultPeriod = getPreviousMonth();
    const targetMonth = month ?? defaultPeriod.month;
    const targetYear = year ?? defaultPeriod.year;
    const outputFormat = (format ?? "text") as OutputFormat;

    const { start, end } = getMonthDateRange(targetMonth, targetYear);

    const [workspace, entries, workspaceUsers, projects] = await Promise.all([
      client.getWorkspace(workspaceId),
      client.getDetailedReport(workspaceId, {
        startDate: start,
        endDate: end,
        clientIds: clientIds ?? undefined,
      }),
      client.getWorkspaceUsers(workspaceId),
      client.getWorkspaceProjects(workspaceId),
    ]);

    const userMap = new Map<number, string>();
    for (const user of workspaceUsers) {
      userMap.set(user.user_id, user.name);
    }

    const projectToClientMap = new Map<number, number | null>();
    for (const project of projects) {
      projectToClientMap.set(project.id, project.client_id ?? project.cid);
    }

    const allClients = await client.getWorkspaceClients(workspaceId);
    const clientMap = new Map<number, string>();
    for (const c of allClients) {
      clientMap.set(c.id, c.name);
    }

    const report = buildInvoiceReport(
      entries,
      {
        month: targetMonth,
        year: targetYear,
        monthName: getMonthName(targetMonth),
        startDate: start,
        endDate: end,
      },
      {
        id: workspace.id,
        name: workspace.name,
        currency: workspace.default_currency,
      },
      userMap,
      clientMap,
      projectToClientMap
    );

    return formatInvoiceReport(report, outputFormat);
  },
});

worker.tool("billableSummary", {
  title: "Billable Summary",
  description: "Get a quick billable summary for any date range",
  schema: {
    type: "object",
    properties: {
      workspaceId: {
        type: "number",
        description: "The workspace ID",
      },
      startDate: {
        type: "string",
        description: "Start date in YYYY-MM-DD format",
      },
      endDate: {
        type: "string",
        description: "End date in YYYY-MM-DD format",
      },
      clientIds: {
        anyOf: [
          { type: "array", items: { type: "number" } },
          { type: "null" },
        ],
        description:
          "Optional array of client IDs to filter by. Pass null for all clients.",
      },
      format: {
        anyOf: [
          { type: "string", enum: ["json", "text"] },
          { type: "null" },
        ],
        description:
          "Output format: json or text. Default: text. Pass null for default.",
      },
    },
    required: ["workspaceId", "startDate", "endDate", "clientIds", "format"],
    additionalProperties: false,
  },
  execute: async ({
    workspaceId,
    startDate,
    endDate,
    clientIds,
    format,
  }: {
    workspaceId: number;
    startDate: string;
    endDate: string;
    clientIds: number[] | null;
    format: string | null;
  }) => {
    const client = new TogglAPIClient();
    const outputFormat = (format ?? "text") as OutputFormat;

    const [workspace, entries] = await Promise.all([
      client.getWorkspace(workspaceId),
      client.getDetailedReport(workspaceId, {
        startDate,
        endDate,
        clientIds: clientIds ?? undefined,
      }),
    ]);

    const summary = buildBillableSummary(
      entries,
      startDate,
      endDate,
      workspace.default_currency
    );

    return formatBillableSummary(summary, outputFormat);
  },
});
