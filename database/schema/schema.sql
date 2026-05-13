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

CREATE TABLE IF NOT EXISTS scan_containers (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  container_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id BIGSERIAL PRIMARY KEY,
  container_row_id BIGINT NOT NULL REFERENCES scan_containers(id) ON DELETE CASCADE,
  cve TEXT NOT NULL,
  cwe JSONB,
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

CREATE TABLE IF NOT EXISTS cve_updates (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
