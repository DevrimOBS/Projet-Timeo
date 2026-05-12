import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, QueryResult } from "pg";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "postgres",
      database: process.env.POSTGRES_DB ?? "novisec"
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
    this.logger.log("PostgreSQL schema ready");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  private async ensureSchema(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id UUID PRIMARY KEY,
        agent_id TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        finished_at TIMESTAMPTZ NOT NULL,
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
        status TEXT NOT NULL
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
  }
}
