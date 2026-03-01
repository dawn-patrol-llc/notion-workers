import type {
  TogglWorkspace,
  TogglClient,
  TogglWorkspaceUser,
  TogglProject,
  TogglReportTimeEntry,
  DetailedReportParams,
} from "./types.js";

const TOGGL_API_BASE = "https://api.track.toggl.com/api/v9";
const TOGGL_REPORTS_BASE = "https://api.track.toggl.com/reports/api/v3";

export class TogglAPIClient {
  private authHeader: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.TOGGL_API_KEY;
    if (!key) {
      throw new Error(
        "TOGGL_API_KEY environment variable is required. Get your API token from https://track.toggl.com/profile"
      );
    }
    this.authHeader = `Basic ${Buffer.from(`${key}:api_token`).toString("base64")}`;
  }

  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Toggl API error (${response.status}): ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getWorkspaces(): Promise<TogglWorkspace[]> {
    return this.request<TogglWorkspace[]>(`${TOGGL_API_BASE}/workspaces`);
  }

  async getWorkspace(workspaceId: number): Promise<TogglWorkspace> {
    return this.request<TogglWorkspace>(
      `${TOGGL_API_BASE}/workspaces/${workspaceId}`
    );
  }

  async getWorkspaceClients(workspaceId: number): Promise<TogglClient[]> {
    const clients = await this.request<TogglClient[] | null>(
      `${TOGGL_API_BASE}/workspaces/${workspaceId}/clients`
    );
    return clients || [];
  }

  async getWorkspaceUsers(workspaceId: number): Promise<TogglWorkspaceUser[]> {
    return this.request<TogglWorkspaceUser[]>(
      `${TOGGL_API_BASE}/workspaces/${workspaceId}/users`
    );
  }

  async getWorkspaceProjects(workspaceId: number): Promise<TogglProject[]> {
    const projects = await this.request<TogglProject[] | null>(
      `${TOGGL_API_BASE}/workspaces/${workspaceId}/projects`
    );
    return projects || [];
  }

  async getDetailedReport(
    workspaceId: number,
    params: DetailedReportParams
  ): Promise<TogglReportTimeEntry[]> {
    const allEntries: TogglReportTimeEntry[] = [];
    let firstRowNumber = 1;
    const pageSize = 50;

    const buildRequestBody = () => {
      const body: Record<string, unknown> = {
        start_date: params.startDate,
        end_date: params.endDate,
        first_row_number: firstRowNumber,
        page_size: pageSize,
      };

      if (params.clientIds && params.clientIds.length > 0) {
        body.client_ids = params.clientIds;
      }

      return body;
    };

    while (true) {
      const response = await this.request<TogglReportTimeEntry[]>(
        `${TOGGL_REPORTS_BASE}/workspace/${workspaceId}/search/time_entries`,
        {
          method: "POST",
          body: JSON.stringify(buildRequestBody()),
        }
      );

      if (!response || response.length === 0) {
        break;
      }

      allEntries.push(...response);

      if (response.length < pageSize) {
        break;
      }

      firstRowNumber += pageSize;
    }

    return allEntries;
  }
}
