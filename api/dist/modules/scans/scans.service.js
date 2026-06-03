"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScansService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_service_1 = require("../../database/database.service");
function severityFromCvss(cvss) {
    if (cvss >= 9)
        return "critical";
    if (cvss >= 7)
        return "high";
    if (cvss >= 4)
        return "medium";
    return "low";
}
let ScansService = class ScansService {
    constructor(db) {
        this.db = db;
    }
    async createScan(payload) {
        const scanId = (0, crypto_1.randomUUID)();
        const scanTimestamp = payload.timestamp;
        await this.db.transaction(async (client) => {
            await client.query(`INSERT INTO scans (
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
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
            ]);
            for (const container of payload.containers) {
                const containerInsert = await client.query(`INSERT INTO scan_containers (scan_id, container_id, name, image, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`, [scanId, container.id, container.name, container.image, container.status, container.created_at ?? null]);
                const containerRowId = containerInsert.rows[0].id;
                for (const vuln of (container.vulnerabilities ?? [])) {
                    await client.query(`INSERT INTO vulnerabilities
              (container_row_id, cve, cwe, package_name, installed_version, fixed_version, cvss, severity, title, remediation, description, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
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
                    ]);
                }
            }
            return { scanId };
        });
        return { scanId };
    }
};
exports.ScansService = ScansService;
exports.ScansService = ScansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ScansService);
