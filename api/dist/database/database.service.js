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
var DatabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
let DatabaseService = DatabaseService_1 = class DatabaseService {
    constructor() {
        this.logger = new common_1.Logger(DatabaseService_1.name);
        this.pool = new pg_1.Pool({
            host: process.env.POSTGRES_HOST ?? "localhost",
            port: Number(process.env.POSTGRES_PORT ?? 5432),
            user: process.env.POSTGRES_USER ?? "postgres",
            password: process.env.POSTGRES_PASSWORD ?? "postgres",
            database: process.env.POSTGRES_DB ?? "novisec"
        });
    }
    async onModuleInit() {
        await this.ensureSchema();
        this.logger.log("PostgreSQL schema ready");
    }
    async onModuleDestroy() {
        await this.pool.end();
    }
    query(text, params = []) {
        return this.pool.query(text, params);
    }
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await callback(client);
            await client.query("COMMIT");
            return result;
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async ensureSchema() {
        await this.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id UUID PRIMARY KEY,
        agent_id TEXT NOT NULL,
        scan_type TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        finished_at TIMESTAMPTZ NOT NULL,
        summary_total_containers INTEGER NOT NULL DEFAULT 0,
        summary_healthy_containers INTEGER NOT NULL DEFAULT 0,
        summary_vulnerable_containers INTEGER NOT NULL DEFAULT 0,
        summary_total_vulnerabilities INTEGER NOT NULL DEFAULT 0,
        summary_global_risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await this.query(`
      CREATE TABLE IF NOT EXISTS scan_containers (
        id BIGSERIAL PRIMARY KEY,
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        container_id TEXT NOT NULL,
        name TEXT NOT NULL,
        image TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ
      );
    `);
        await this.query(`
      CREATE TABLE IF NOT EXISTS vulnerabilities (
        id BIGSERIAL PRIMARY KEY,
        container_row_id BIGINT NOT NULL REFERENCES scan_containers(id) ON DELETE CASCADE,
        cve TEXT NOT NULL,
        cwe TEXT,
        package_name TEXT NOT NULL,
        installed_version TEXT,
        fixed_version TEXT,
        cvss NUMERIC(4,1) NOT NULL,
        severity TEXT NOT NULL,
        title TEXT,
        remediation TEXT,
        description TEXT,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await this.query(`
      CREATE TABLE IF NOT EXISTS cve_updates (
        id BIGSERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await this.query(`
      CREATE TABLE IF NOT EXISTS scan_tasks (
        id UUID PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('MANUAL_GLOBAL', 'MANUAL_TARGET', 'AUTO_CRON')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
        requested_by TEXT NOT NULL,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        claimed_by TEXT,
        claimed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
        target_container_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        message TEXT
      );
    `);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_scan_tasks_status_requested_at ON scan_tasks (status, requested_at);`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_scan_containers_scan_id ON scan_containers (scan_id);`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_vulnerabilities_container_row_id ON vulnerabilities (container_row_id);`);
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = DatabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], DatabaseService);
