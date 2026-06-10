import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class ReportsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async getOverview() {
    const latestScan = await this.db.query<{ id: string }>(
      `SELECT id FROM scans ORDER BY finished_at DESC LIMIT 1`
    );

    if (latestScan.rows.length === 0) {
      return {
        scansCount: 0,
        healthyContainers: 0,
        vulnerableContainers: 0,
        globalRiskScore: 0
      };
    }

    const scanId = latestScan.rows[0].id;

    const containerStats = await this.db.query<{
      total: string;
      vulnerable: string;
    }>(
      `SELECT
         COUNT(DISTINCT c.id)::text AS total,
         COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN c.id END)::text AS vulnerable
       FROM scan_containers c
       LEFT JOIN vulnerabilities v ON v.container_row_id = c.id
       WHERE c.scan_id = $1`,
      [scanId]
    );

    const risk = await this.db.query<{ risk: string }>(
      `SELECT
         COALESCE(ROUND((SUM(
           CASE
             WHEN v.cvss >= 9 THEN 4
             WHEN v.cvss >= 7 THEN 3
             WHEN v.cvss >= 4 THEN 2
             ELSE 1
           END
         )::numeric / NULLIF(COUNT(v.id) * 4, 0)) * 100, 2), 0)::text AS risk
       FROM vulnerabilities v
       JOIN scan_containers c ON c.id = v.container_row_id
       WHERE c.scan_id = $1`,
      [scanId]
    );

    const total = Number(containerStats.rows[0]?.total ?? 0);
    const vulnerable = Number(containerStats.rows[0]?.vulnerable ?? 0);

    return {
      scansCount: await this.getScansCount(),
      healthyContainers: Math.max(0, total - vulnerable),
      vulnerableContainers: vulnerable,
      globalRiskScore: Number(risk.rows[0]?.risk ?? 0)
    };
  }

  async getMatrix() {
    const latestScan = await this.db.query<{ id: string }>(
      `SELECT id FROM scans ORDER BY finished_at DESC LIMIT 1`
    );

    if (latestScan.rows.length === 0) {
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }

    const scanId = latestScan.rows[0].id;
    const result = await this.db.query<{ severity: string; count: string }>(
      `SELECT v.severity, COUNT(*)::text AS count
       FROM vulnerabilities v
       JOIN scan_containers c ON c.id = v.container_row_id
       WHERE c.scan_id = $1
       GROUP BY v.severity`,
      [scanId]
    );

    const matrix = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of result.rows) {
      if (row.severity in matrix) {
        matrix[row.severity as keyof typeof matrix] = Number(row.count);
      }
    }

    return matrix;
  }

  async getContainers() {
    const latestScan = await this.db.query<{ id: string }>(
      `SELECT id FROM scans ORDER BY finished_at DESC LIMIT 1`
    );

    if (latestScan.rows.length === 0) {
      return [];
    }

    const result = await this.db.query<{
      containerId: string;
      name: string;
      image: string;
      status: string;
      vulnerabilitiesCount: string;
    }>(
      `SELECT
         c.container_id AS "containerId",
         c.name,
         c.image,
         c.status,
         COUNT(v.id)::text AS "vulnerabilitiesCount"
       FROM scan_containers c
       LEFT JOIN vulnerabilities v ON v.container_row_id = c.id
       WHERE c.scan_id = $1
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [latestScan.rows[0].id]
    );

    return result.rows.map((container) => ({
      ...container,
      vulnerabilitiesCount: Number(container.vulnerabilitiesCount)
    }));
  }

  async getContainerDetails(containerId: string) {
    const containers = await this.db.query<{
      scan_id: string;
      finished_at: string;
      name: string;
      image: string;
      status: string;
      row_id: string;
    }>(
      `SELECT c.scan_id, s.finished_at, c.name, c.image, c.status, c.id::text AS row_id
       FROM scan_containers c
       JOIN scans s ON s.id = c.scan_id
       WHERE c.container_id = $1
       ORDER BY s.finished_at DESC`,
      [containerId]
    );

    if (containers.rows.length === 0) {
      throw new NotFoundException("Container not found");
    }

    const latest = containers.rows[0];
    const vulnerabilities = await this.db.query<{
      cve: string;
      cwe: string | null;
      package_name: string;
      installed_version: string | null;
      fixed_version: string | null;
      cvss: string;
      severity: string;
      title: string | null;
      remediation: string | null;
    }>(
      `SELECT cve, cwe, package_name, installed_version, fixed_version, cvss::text, severity, title, remediation
       FROM vulnerabilities
       WHERE container_row_id = $1
       ORDER BY cvss DESC`,
      [latest.row_id]
    );

    return {
      containerId,
      name: latest.name,
      image: latest.image,
      status: latest.status,
      latestScanFinishedAt: latest.finished_at,
      historyCount: containers.rows.length,
      vulnerabilities: vulnerabilities.rows
    };
  }

  async listAlerts() {
    const result = await this.db.query<{
      id: string;
      scan_id: string;
      container_id: string;
      container_name: string;
      severity: string;
      cve: string;
      package_name: string;
      title: string | null;
      description: string | null;
      cvss: string;
      status: string;
      source: string;
      delivery_status: string;
      delivered_at: string | null;
      acknowledged_at: string | null;
      acknowledged_by: string | null;
      delivery_error: string | null;
      created_at: string;
    }>(
      `SELECT id, scan_id, container_id, container_name, severity, cve, package_name, title, description,
              cvss::text, status, source, delivery_status, delivered_at, acknowledged_at, acknowledged_by,
              delivery_error, created_at
       FROM alerts
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return result.rows.map((row) => ({
      ...row,
      cvss: Number(row.cvss)
    }));
  }

  async acknowledgeAlert(alertId: string, username: string) {
    const result = await this.db.query<{
      id: string;
      scan_id: string;
      container_id: string;
      container_name: string;
      severity: string;
      cve: string;
      package_name: string;
      title: string | null;
      description: string | null;
      cvss: string;
      status: string;
      source: string;
      delivery_status: string;
      delivered_at: string | null;
      acknowledged_at: string | null;
      acknowledged_by: string | null;
      delivery_error: string | null;
      created_at: string;
    }>(
      `UPDATE alerts
       SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $2
       WHERE id = $1
       RETURNING id, scan_id, container_id, container_name, severity, cve, package_name, title, description,
                 cvss::text, status, source, delivery_status, delivered_at, acknowledged_at, acknowledged_by,
                 delivery_error, created_at`,
      [alertId, username]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Alert not found");
    }

    return {
      ...result.rows[0],
      cvss: Number(result.rows[0].cvss)
    };
  }

  private async getScansCount(): Promise<number> {
    const result = await this.db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM scans`);
    return Number(result.rows[0]?.count ?? 0);
  }
}
