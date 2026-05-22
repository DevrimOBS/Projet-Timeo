import { randomUUID } from "crypto";

type VulnerabilitySeverity = "critical" | "high" | "medium" | "low";

interface Vulnerability {
  severity: VulnerabilitySeverity;
  cve: string;
  cwe?: string | null;
  package_name: string;
  installedVersion?: string | null;
  fixedVersion?: string | null;
  cvss: number;
  title?: string | null;
  remediation?: string | null;
  description?: string | null;
  source?: string | null;
}

interface ScanContainer {
  containerId: string;
  vulnerabilities: Vulnerability[];
}

interface ScanReport {
  scanId: string;
  containers: ScanContainer[];
}

interface ScheduledAudit {
  id: string;
  createdAt: string;
}

interface TriggerRequest {
  id: string;
  mode: "global" | "targeted";
  containerIds: string[];
  createdAt: string;
  status: "queued" | "done";
}

interface InMemoryStore {
  scans: ScanReport[];
  schedules: ScheduledAudit[];
  triggers: TriggerRequest[];
}

export const store: InMemoryStore = {
  scans: [],
  schedules: [],
  triggers: []
};

export function addScan(scan: Omit<ScanReport, "scanId"> & { scanId?: string }): ScanReport {
  const item: ScanReport = {
    ...scan,
    scanId: scan.scanId ?? randomUUID()
  };
  store.scans.unshift(item);
  return item;
}

export function queueTrigger(mode: "global" | "targeted", containerIds: string[]): TriggerRequest {
  const trigger: TriggerRequest = {
    id: randomUUID(),
    mode,
    containerIds,
    createdAt: new Date().toISOString(),
    status: "queued"
  };
  store.triggers.unshift(trigger);
  return trigger;
}

export function markTriggerDone(id: string): void {
  const target = store.triggers.find((item) => item.id === id);
  if (target) {
    target.status = "done";
  }
}

export function upsertSchedule(schedule: Omit<ScheduledAudit, "id" | "createdAt">): ScheduledAudit {
  const created: ScheduledAudit = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...schedule
  };
  store.schedules.unshift(created);
  return created;
}

export function listVulnerabilities(containerId?: string, severity?: VulnerabilitySeverity): Vulnerability[] {
  const vulnerabilities = store.scans.flatMap((scan) =>
    scan.containers.flatMap((container) =>
      container.vulnerabilities
        .filter((vuln) => (severity ? vuln.severity === severity : true))
        .filter(() => (containerId ? container.containerId === containerId : true))
    )
  );

  return vulnerabilities;
}
