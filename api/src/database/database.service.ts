import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  private readonly initMaxRetries: number;
  private readonly initRetryDelayMs: number;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "postgres",
      database: process.env.POSTGRES_DB ?? "novisec"
    });
    this.initMaxRetries = Number(process.env.DB_INIT_MAX_RETRIES ?? 20);
    this.initRetryDelayMs = Number(process.env.DB_INIT_RETRY_DELAY_MS ?? 1500);
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchemaWithRetry();
    this.logger.log("PostgreSQL schema ready");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureSchema(): Promise<void> {
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

  private async ensureSchemaWithRetry(): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.initMaxRetries; attempt += 1) {
      try {
        await this.ensureSchema();
        return;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.initMaxRetries;
        this.logger.warn(
          `Database initialization attempt ${attempt}/${this.initMaxRetries} failed.${isLastAttempt ? "" : ` Retrying in ${this.initRetryDelayMs}ms...`}`
        );
        if (!isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, this.initRetryDelayMs));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Database initialization failed");
  }
}
