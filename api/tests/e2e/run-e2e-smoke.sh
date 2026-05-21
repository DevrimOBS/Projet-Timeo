#!/usr/bin/env bash
set -eu

BASE=${E2E_BASE_URL:-http://localhost:3000}
ADMIN_TOKEN=${E2E_ADMIN_TOKEN:-admin-dev-token}
AGENT_TOKEN=${E2E_AGENT_TOKEN:-agent-dev-token}

echo "[e2e] Starting smoke test against $BASE"

create() {
  curl -s -X POST "$BASE/api/scan-tasks" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"mode":"MANUAL_GLOBAL"}'
}

claim() {
  curl -s -X POST "$BASE/api/scan-tasks/claim" -H "Authorization: Bearer $AGENT_TOKEN"
}

postscan() {
  curl -s -X POST "$BASE/api/scans" -H "Authorization: Bearer $AGENT_TOKEN" -H 'Content-Type: application/json' -d '{"agent_id":"agent-e2e","timestamp":"'"$(date -Iseconds)"'","scan_type":"docker","containers":[],"summary":{"total_containers":0,"healthy_containers":0,"vulnerable_containers":0,"total_vulnerabilities":0,"global_risk_score":0}}'
}

echo "Creating task..."
TASK=$(create)
echo "Create response: $TASK"

echo "Claiming..."
CLAIM=$(claim)
echo "Claim response: $CLAIM"

echo "Posting scan..."
SCAN=$(postscan)
echo "Scan response: $SCAN"

echo "Fetching tasks list..."
LIST=$(curl -s -X GET "$BASE/api/scan-tasks" -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Tasks: $LIST"

echo "[e2e] Smoke script finished"
