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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../database/database.service");
let ReportsService = class ReportsService {
    constructor(db) {
        this.db = db;
    }
    async getOverview() {
        const latestScan = await this.db.query(`SELECT id FROM scans ORDER BY finished_at DESC LIMIT 1`);
        if (latestScan.rows.length === 0) {
            return {
                scansCount: 0,
                healthyContainers: 0,
                vulnerableContainers: 0,
                globalRiskScore: 0
            };
        }
        const scanId = latestScan.rows[0].id;
        const containerStats = await this.db.query(`SELECT
         COUNT(DISTINCT c.id)::text AS total,
         COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN c.id END)::text AS vulnerable
       FROM scan_containers c
       LEFT JOIN vulnerabilities v ON v.container_row_id = c.id
       WHERE c.scan_id = $1`, [scanId]);
        const risk = await this.db.query(`SELECT
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
       WHERE c.scan_id = $1`, [scanId]);
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
        const latestScan = await this.db.query(`SELECT id FROM scans ORDER BY finished_at DESC LIMIT 1`);
        if (latestScan.rows.length === 0) {
            return { critical: 0, high: 0, medium: 0, low: 0 };
        }
        const scanId = latestScan.rows[0].id;
        const result = await this.db.query(`SELECT v.severity, COUNT(*)::text AS count
       FROM vulnerabilities v
       JOIN scan_containers c ON c.id = v.container_row_id
       WHERE c.scan_id = $1
       GROUP BY v.severity`, [scanId]);
        const matrix = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const row of result.rows) {
            if (row.severity in matrix) {
                matrix[row.severity] = Number(row.count);
            }
        }
        return matrix;
    }
    async getContainerDetails(containerId) {
        const containers = await this.db.query(`SELECT c.scan_id, s.finished_at, c.name, c.image, c.status, c.id::text AS row_id
       FROM scan_containers c
       JOIN scans s ON s.id = c.scan_id
       WHERE c.container_id = $1
       ORDER BY s.finished_at DESC`, [containerId]);
        if (containers.rows.length === 0) {
            throw new common_1.NotFoundException("Container not found");
        }
        const latest = containers.rows[0];
        const vulnerabilities = await this.db.query(`SELECT cve, cwe, package_name, installed_version, fixed_version, cvss::text, severity, title, remediation
       FROM vulnerabilities
       WHERE container_row_id = $1
       ORDER BY cvss DESC`, [latest.row_id]);
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
    async getScansCount() {
        const result = await this.db.query(`SELECT COUNT(*)::text AS count FROM scans`);
        return Number(result.rows[0]?.count ?? 0);
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ReportsService);
