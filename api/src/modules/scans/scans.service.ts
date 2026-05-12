import { Injectable } from "@nestjs/common";
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
  constructor(private readonly db: DatabaseService) {}

  async createScan(payload: CreateScanDto): Promise<{ scanId: string }> {
    const scanId = randomUUID();

    await this.db.query("BEGIN");
    try {
      await this.db.query(
        `INSERT INTO scans (id, agent_id, started_at, finished_at) VALUES ($1, $2, $3, $4)`,
        [scanId, payload.agentId, payload.startedAt, payload.finishedAt]
      );

      for (const container of payload.containers) {
        const containerInsert = await this.db.query<{ id: string }>(
          `INSERT INTO scan_containers (scan_id, container_id, name, image, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [scanId, container.containerId, container.name, container.image, container.status]
        );

        const containerRowId = containerInsert.rows[0].id;

        for (const vuln of container.vulnerabilities) {
          await this.db.query(
            `INSERT INTO vulnerabilities
              (container_row_id, cve, cwe, package_name, installed_version, fixed_version, cvss, severity, title, remediation)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              containerRowId,
              vuln.cve,
              vuln.cwe ?? null,
              vuln.packageName,
              vuln.installedVersion ?? null,
              vuln.fixedVersion ?? null,
              vuln.cvss,
              severityFromCvss(vuln.cvss),
              vuln.title ?? null,
              vuln.remediation ?? null
            ]
          );
        }
      }

      await this.db.query("COMMIT");
      return { scanId };
    } catch (error) {
      await this.db.query("ROLLBACK");
      throw error;
    }
  }
}
