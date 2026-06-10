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

export interface ContainerSeverityData {
  containerId: string;
  name: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
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

export interface ScanSchedulerConfig {
  enabled: boolean;
  cron: string;
  timezone: string | null;
  run_on_startup: boolean;
  requested_by: string;
  message: string;
  container_ids: string[];
}

export interface UpdateScanSchedulerPayload {
  enabled?: boolean;
  cron?: string;
  timezone?: string;
  run_on_startup?: boolean;
  requested_by?: string;
  message?: string;
  container_ids?: string[];
}

export interface UserAccount {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
  mfaConfiguredAt: string | null;
}

export interface MfaSetupData {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export interface SecurityAlert {
  id: string;
  scan_id: string;
  container_id: string;
  container_name: string;
  severity: string;
  cve: string;
  package_name: string;
  title: string | null;
  description: string | null;
  cvss: number;
  status: "open" | "acknowledged";
  source: string;
  delivery_status: "pending" | "delivered" | "failed" | "skipped";
  delivered_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  delivery_error: string | null;
  created_at: string;
}
