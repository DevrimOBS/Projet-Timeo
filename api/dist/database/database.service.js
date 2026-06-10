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
const crypto_1 = require("crypto");
const pg_1 = require("pg");
const password_1 = require("../common/utils/password");
const role_enum_1 = require("../common/enums/role.enum");
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
        this.initMaxRetries = Number(process.env.DB_INIT_MAX_RETRIES ?? 20);
        this.initRetryDelayMs = Number(process.env.DB_INIT_RETRY_DELAY_MS ?? 1500);
    }
    async onModuleInit() {
        await this.ensureSchemaWithRetry();
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
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'viewer', 'agent')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,
        mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        mfa_secret TEXT,
        mfa_pending_secret TEXT,
        mfa_recovery_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
        mfa_configured_at TIMESTAMPTZ
      );
    `);
        await this.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;`);
        await this.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;`);
        await this.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_secret TEXT;`);
        await this.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes JSONB NOT NULL DEFAULT '[]'::jsonb;`);
        await this.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_configured_at TIMESTAMPTZ;`);
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
        await this.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY,
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        container_id TEXT NOT NULL,
        container_name TEXT NOT NULL,
        severity TEXT NOT NULL,
        cve TEXT NOT NULL,
        package_name TEXT NOT NULL,
        title TEXT,
        description TEXT,
        cvss NUMERIC(4,1) NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged')),
        source TEXT NOT NULL DEFAULT 'scan_ingestion',
        delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'skipped')),
        delivered_at TIMESTAMPTZ,
        acknowledged_at TIMESTAMPTZ,
        acknowledged_by TEXT,
        delivery_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (scan_id, container_id, cve)
      );
    `);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_scan_tasks_status_requested_at ON scan_tasks (status, requested_at);`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_scan_containers_scan_id ON scan_containers (scan_id);`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_vulnerabilities_container_row_id ON vulnerabilities (container_row_id);`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_alerts_status_created_at ON alerts (status, created_at DESC);`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_alerts_scan_id ON alerts (scan_id);`);
        await this.ensureDefaultUsers();
    }
    async ensureDefaultUsers() {
        const result = await this.query(`SELECT COUNT(*)::text AS count FROM users`);
        const count = Number(result.rows[0]?.count ?? "0");
        if (count > 0) {
            return;
        }
        const bootstrapUsers = [
            {
                username: process.env.ADMIN_USER ?? "admin",
                password: process.env.ADMIN_PASSWORD ?? "admin-pass",
                role: role_enum_1.Role.ADMIN
            },
            {
                username: process.env.VIEWER_USER ?? "viewer",
                password: process.env.VIEWER_PASSWORD ?? "viewer-pass",
                role: role_enum_1.Role.VIEWER
            },
            {
                username: process.env.AGENT_USER ?? "agent",
                password: process.env.AGENT_PASSWORD ?? "agent-pass",
                role: role_enum_1.Role.AGENT
            }
        ];
        for (const user of bootstrapUsers) {
            await this.query(`INSERT INTO users (id, username, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (username) DO NOTHING`, [(0, crypto_1.randomUUID)(), user.username, (0, password_1.hashPassword)(user.password), user.role]);
        }
    }
    async ensureSchemaWithRetry() {
        let lastError;
        for (let attempt = 1; attempt <= this.initMaxRetries; attempt += 1) {
            try {
                await this.ensureSchema();
                return;
            }
            catch (error) {
                lastError = error;
                const isLastAttempt = attempt === this.initMaxRetries;
                this.logger.warn(`Database initialization attempt ${attempt}/${this.initMaxRetries} failed.${isLastAttempt ? "" : ` Retrying in ${this.initRetryDelayMs}ms...`}`);
                if (!isLastAttempt) {
                    await new Promise((resolve) => setTimeout(resolve, this.initRetryDelayMs));
                }
            }
        }
        throw lastError instanceof Error ? lastError : new Error("Database initialization failed");
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = DatabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], DatabaseService);
