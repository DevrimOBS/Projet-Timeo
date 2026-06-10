# Security Validation Report - 2026-06-10

## Scope

Validation of API security controls and end-to-end flows:

- Authentication (JWT + legacy compatibility)
- Negative auth scenarios
- RBAC authorization rules
- Login rate limiting / brute-force mitigation
- Agent to API secure flow
- TLS validation (trusted and untrusted CA paths)

## Environment

- Stack started with Docker Compose
- API endpoint used for tests: `https://localhost:3002`
- Test command executed from `api/`:

```powershell
$env:E2E_BASE_URL='https://localhost:3002'
$env:E2E_HTTPS_BASE_URL='https://localhost:3002'
$env:E2E_CA_CERT_FILE='C:\Users\nicog\Desktop\Projet-Timeo\certs\ca.crt'
$env:E2E_BAD_CA_CERT_FILE='C:\Users\nicog\Desktop\Projet-Timeo\certs\ca.key'
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'
npm run test:e2e
```

Note: `NODE_TLS_REJECT_UNAUTHORIZED=0` is used only in local e2e context. It must not be used in production.

## Final Results

Jest summary:

- Test Suites: 6 passed, 6 total
- Tests: 16 passed, 16 total
- Snapshots: 0 total
- Run date: 2026-06-10

Suites executed:

- `tests/e2e/auth.spec.ts`
- `tests/e2e/auth-negative.spec.ts`
- `tests/e2e/rbac-security.spec.ts`
- `tests/e2e/rate-limit.spec.ts`
- `tests/e2e/agent-flow.spec.ts`
- `tests/e2e/tls-validation.spec.ts`

## Fixes Applied During Validation

- Runtime DI fix in auth controller to prevent 500 on `/api/auth/login`.
- Login throttling tracker refined to avoid cross-test collisions.
- Explicit login payload hardening to reject unexpected fields.
- TLS negative test hardened to enforce strict certificate validation path.

## Go / No-Go Decision

- Decision: GO
- Rationale: all targeted e2e security suites pass on the running stack.

## Remaining Recommendations

- Add CI pipeline step to run these e2e suites automatically.
- Keep TLS suite enabled in CI using dedicated test cert material.
- Add load/intrusion scenarios from CDC phase 4 as separate test jobs.
