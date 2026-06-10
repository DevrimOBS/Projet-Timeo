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
var ScansService_1;
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
let ScansService = ScansService_1 = class ScansService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(ScansService_1.name);
    }
    async createScan(payload) {
        const scanId = (0, crypto_1.randomUUID)();
        const scanTimestamp = payload.timestamp;
        const criticalAlerts = [];
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
                    const severity = severityFromCvss(vuln.cvss);
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
                        severity,
                        vuln.title ?? null,
                        vuln.remediation ?? null,
                        vuln.description ?? null,
                        vuln.source ?? null
                    ]);
                    if (severity === "critical") {
                        const alertId = (0, crypto_1.randomUUID)();
                        criticalAlerts.push({
                            id: alertId,
                            scanId,
                            containerId: container.id,
                            containerName: container.name,
                            severity,
                            cve: vuln.cve,
                            packageName: vuln.package_name,
                            title: vuln.title ?? null,
                            description: vuln.description ?? null,
                            cvss: vuln.cvss
                        });
                        await client.query(`INSERT INTO alerts (
                id, scan_id, container_id, container_name, severity, cve, package_name, title, description, cvss, status, source, delivery_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', 'scan_ingestion', 'pending')
              ON CONFLICT (scan_id, container_id, cve) DO NOTHING`, [
                            alertId,
                            scanId,
                            container.id,
                            container.name,
                            severity,
                            vuln.cve,
                            vuln.package_name,
                            vuln.title ?? null,
                            vuln.description ?? null,
                            vuln.cvss
                        ]);
                    }
                }
            }
            return { scanId };
        });
        await this.dispatchCriticalAlerts(criticalAlerts);
        return { scanId };
    }
    async dispatchCriticalAlerts(alerts) {
        if (alerts.length === 0) {
            return;
        }
        const webhookUrl = (process.env.ALERT_WEBHOOK_URL ?? "").trim();
        if (!webhookUrl) {
            await this.db.query(`UPDATE alerts SET delivery_status = 'skipped', delivery_error = $2 WHERE id = ANY($1::uuid[])`, [alerts.map((alert) => alert.id), "ALERT_WEBHOOK_URL not configured"]);
            this.logger.warn(`Critical alerts created (${alerts.length}) but no ALERT_WEBHOOK_URL configured`);
            return;
        }
        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source: "novisec-docker-auditor",
                    severity: "critical",
                    alertCount: alerts.length,
                    generatedAt: new Date().toISOString(),
                    alerts: alerts.map((alert) => ({
                        id: alert.id,
                        scanId: alert.scanId,
                        containerId: alert.containerId,
                        containerName: alert.containerName,
                        cve: alert.cve,
                        packageName: alert.packageName,
                        title: alert.title,
                        cvss: alert.cvss
                    }))
                })
            });
            if (!response.ok) {
                const body = await response.text();
                throw new Error(body || `Webhook responded with status ${response.status}`);
            }
            await this.db.query(`UPDATE alerts
         SET delivery_status = 'delivered', delivered_at = NOW(), delivery_error = NULL
         WHERE id = ANY($1::uuid[])`, [alerts.map((alert) => alert.id)]);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "unknown delivery error";
            await this.db.query(`UPDATE alerts
         SET delivery_status = 'failed', delivery_error = $2
         WHERE id = ANY($1::uuid[])`, [alerts.map((alert) => alert.id), message]);
            this.logger.error(`Critical alert webhook delivery failed: ${message}`);
        }
    }
};
exports.ScansService = ScansService;
exports.ScansService = ScansService = ScansService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ScansService);
