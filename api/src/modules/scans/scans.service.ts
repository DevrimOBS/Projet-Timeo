import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DatabaseService } from "../../database/database.service";
import { CreateScanDto } from "./dto/create-scan.dto";

function severityFromCvss(cvss: number): "critical" | "high" | "medium" | "low" {
  if (cvss >= 9) return "critical";
  if (cvss >= 7) return "high";
  if (cvss >= 4) return "medium";
  return "low";
}

@Injectable()
export class ScansService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async createScan(payload: CreateScanDto): Promise<{ scanId: string }> {
    const scanId = randomUUID();
    const scanTimestamp = payload.timestamp;

    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO scans (
          id,
          agent_id,
          scan_type,
          started_at,
          finished_at,
          summary_total_containers,
          summary_healthy_containers,
          summary_vulnerable_containers,
          summary_total_vulnerabilities,
          summary_global_risk_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          scanId,
          payload.agent_id,
          payload.scan_type,
          scanTimestamp,
          scanTimestamp,
          payload.summary.total_containers,
          payload.summary.healthy_containers,
          payload.summary.vulnerable_containers,
          payload.summary.total_vulnerabilities,
          payload.summary.global_risk_score
        ]
      );

      for (const container of payload.containers) {
        const containerInsert = await client.query<{ id: string }>(
          `INSERT INTO scan_containers (scan_id, container_id, name, image, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [scanId, container.id, container.name, container.image, container.status, container.created_at ?? null]
        );

        const containerRowId = containerInsert.rows[0].id;

        for (const vuln of (container.vulnerabilities ?? [])) {
          await client.query(
            `INSERT INTO vulnerabilities
              (container_row_id, cve, cwe, package_name, installed_version, fixed_version, cvss, severity, title, remediation, description, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              containerRowId,
              vuln.cve,
              vuln.cwe ? JSON.stringify(vuln.cwe) : null,
              vuln.package_name,
              vuln.installedVersion ?? null,
              vuln.fixedVersion ?? null,
              vuln.cvss,
              severityFromCvss(vuln.cvss),
              vuln.title ?? null,
              vuln.remediation ?? null,
              vuln.description ?? null,
              vuln.source ?? null
            ]
          );
        }
      }

      return { scanId };
    });

    return { scanId };
  }
}
