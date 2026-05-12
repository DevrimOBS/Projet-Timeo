-- database/schema.sql - Lancez en S1
CREATE TABLE containers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR,
  image VARCHAR,
  status VARCHAR,
  created_at TIMESTAMP
);

CREATE TABLE scans (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR,
  timestamp TIMESTAMP,
  type VARCHAR -- 'MANUAL_GLOBAL', 'MANUAL_TARGET', 'AUTO_CRON'
);

CREATE TABLE vulnerabilities (
  id SERIAL PRIMARY KEY,
  cve VARCHAR UNIQUE,
  cvss_score DECIMAL,
  criticite VARCHAR CHECK (criticite IN ('CRITIQUE','HAUT','MOYEN','FAIBLE')),
  remediation TEXT
);
