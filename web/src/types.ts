export type SeverityKey = "critical" | "high" | "medium" | "low";

export interface OverviewData {
  scansCount: number;
  healthyContainers: number;
  vulnerableContainers: number;
  globalRiskScore: number;
}

export interface MatrixData {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface VulnerabilityItem {
  cve: string;
  cwe: string[] | string | null;
  package_name: string;
  installed_version: string | null;
  fixed_version: string | null;
  cvss: string;
  severity: string;
  title: string | null;
  remediation: string | null;
}

export interface ContainerDetails {
  containerId: string;
  name: string;
  image: string;
  status: string;
  latestScanFinishedAt: string;
  historyCount: number;
  vulnerabilities: VulnerabilityItem[];
}

export interface ContainerSummary {
  containerId: string;
  name: string;
  image: string;
  status: string;
  vulnerabilitiesCount: number;
}

export interface ScanTask {
  id: string;
  mode: string;
  status: string;
  requested_by: string;
  claimed_by?: string | null;
  scan_id?: string | null;
  message?: string | null;
  container_ids?: string[];
  requested_at: string;
  claimed_at?: string | null;
  completed_at?: string | null;
}

export interface CreateScanTaskPayload {
  mode: "MANUAL_GLOBAL" | "MANUAL_TARGET" | "AUTO_CRON";
  container_ids?: string[];
  message?: string;
}
