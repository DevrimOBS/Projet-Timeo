import { ContainerDetails, CreateScanTaskPayload, MatrixData, OverviewData, ScanTask } from "../types";

const fallbackApiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return fallbackApiUrl;
  }

  return window.localStorage.getItem("novisec-api-url") ?? fallbackApiUrl;
}

function getToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("novisec-token") ?? "admin-dev-token";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getApiBaseUrl,
  getToken,
  async overview(): Promise<OverviewData> {
    return request<OverviewData>("/api/reports/overview");
  },
  async matrix(): Promise<MatrixData> {
    return request<MatrixData>("/api/reports/matrix");
  },
  async containerDetails(containerId: string): Promise<ContainerDetails> {
    return request<ContainerDetails>(`/api/reports/details/${encodeURIComponent(containerId)}`);
  },
  async listTasks(): Promise<ScanTask[]> {
    return request<ScanTask[]>("/api/scan-tasks");
  },
  async createTask(payload: CreateScanTaskPayload): Promise<ScanTask> {
    return request<ScanTask>("/api/scan-tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async login(username: string, password: string, otp?: string): Promise<{ token: string; expiresIn: string }> {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, otp })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `${response.status} ${response.statusText}`);
    }

    return response.json();
  },
  saveConnectionSettings(apiUrl: string, token: string): void {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("novisec-api-url", apiUrl);
    window.localStorage.setItem("novisec-token", token);
  }
};
