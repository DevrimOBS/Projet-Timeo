import { ContainerDetails, ContainerSummary, CreateScanTaskPayload, MatrixData, OverviewData, ScanTask } from "../types";

function normalizeApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

const fallbackApiUrl = normalizeApiUrl(import.meta.env.VITE_API_URL ?? "");

function shouldUseLocalProxy(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname;
  return (host === "localhost" || host === "127.0.0.1") && window.location.port === "5173";
}

function mapLocalhostApiToProxy(value: string): string {
  if (!value || !shouldUseLocalProxy()) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const isKnownApiPort = parsed.port === "3000" || parsed.port === "3001" || parsed.port === "3002";

    if (!isLocalhost || !isKnownApiPort) {
      return value;
    }

    return "";
  } catch {
    return value;
  }
}

function repairApiUrlForSecurePage(value: string): string {
  if (typeof window === "undefined" || window.location.protocol !== "https:") {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:") {
      return value;
    }

    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (!isLocalhost) {
      return value;
    }

    parsed.protocol = "https:";
    if (parsed.port === "3000") {
      parsed.port = "3002";
    }

    return normalizeApiUrl(parsed.toString());
  } catch {
    return value;
  }
}

function getApiBaseUrl(): string {
  const normalizedFallback = mapLocalhostApiToProxy(fallbackApiUrl);

  if (typeof window === "undefined") {
    return normalizedFallback;
  }

  const rawApiUrl = window.localStorage.getItem("novisec-api-url") ?? normalizedFallback;
  const normalizedApiUrl = normalizeApiUrl(rawApiUrl);
  const repairedApiUrl = mapLocalhostApiToProxy(repairApiUrlForSecurePage(normalizedApiUrl));

  if (repairedApiUrl !== rawApiUrl) {
    window.localStorage.setItem("novisec-api-url", repairedApiUrl);
  }

  return repairedApiUrl;
}

function getToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("novisec-token") ?? "admin-dev-token";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Impossible de joindre l'API (${baseUrl || "proxy /api"}). Verifie l'URL API, le protocole HTTPS et le certificat.`);
    }
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("404") || error.message.includes("Not Found") || error.message.includes("Cannot GET");
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
  async containers(): Promise<ContainerSummary[]> {
    try {
      return await request<ContainerSummary[]>("/api/reports/containers");
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  },
  async containerDetails(containerId: string): Promise<ContainerDetails | null> {
    try {
      return await request<ContainerDetails>(`/api/reports/details/${encodeURIComponent(containerId)}`);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
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

    const normalizedApiUrl = mapLocalhostApiToProxy(repairApiUrlForSecurePage(normalizeApiUrl(apiUrl)));
    window.localStorage.setItem("novisec-api-url", normalizedApiUrl);
    window.localStorage.setItem("novisec-token", token);
  }
};
