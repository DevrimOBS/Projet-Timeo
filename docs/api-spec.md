# API Spec

Spécification des endpoints principaux, des contraintes de sécurité et des formats JSON.

## Base URL

- HTTP local: `http://localhost:3001`
- HTTPS local (TLS activé): `https://localhost:3002`

## Authentification et rôles

- Header attendu: `Authorization: Bearer <token>`
- Tokens supportés:
	- JWT (prioritaire)
	- Tokens legacy statiques (compatibilité)
- Rôles applicatifs:
	- `admin`
	- `viewer`
	- `agent`

## Sécurité transversale

- Validation globale NestJS:
	- `whitelist: true`
	- `forbidNonWhitelisted: true`
	- `transform: true`
- Rate limiting:
	- Guard global via `@nestjs/throttler`
	- Limite renforcée sur `POST /api/auth/login`
- Audit logging:
	- Logs d'audit en mémoire + persistance fichier si `AUDIT_LOG_PATH` défini
	- Champs sensibles du body supprimés (`password`, `token`, `secret`, etc.)

## Endpoints principaux

### Auth

#### `POST /api/auth/login`

- Accès: public
- Body:

```json
{
	"username": "admin",
	"password": "admin-pass",
	"otp": "123456",
	"recoveryCode": "ABCDEF1234"
}
```

- Réponse 200:

```json
{
	"token": "<jwt>",
	"expiresIn": "8h"
}
```

- Erreurs:
	- `400` payload invalide
	- `401` credentials/OTP invalides
	- `429` trop de tentatives

### Reports

#### `GET /api/reports/overview`

- Accès: `admin`, `viewer`
- Réponse 200:

```json
{
	"scansCount": 12,
	"healthyContainers": 4,
	"vulnerableContainers": 7,
	"globalRiskScore": 63.5
}
```

#### `GET /api/reports/matrix`

- Accès: `admin`, `viewer`
- Réponse 200:

```json
{
	"critical": 3,
	"high": 10,
	"medium": 22,
	"low": 9
}
```

#### `GET /api/reports/containers`

- Accès: `admin`, `viewer`

#### `GET /api/reports/details/:containerId`

- Accès: `admin`, `viewer`

#### `GET /api/reports/alerts`

- Accès: `admin`, `viewer`

#### `POST /api/reports/alerts/:alertId/ack`

- Accès: `admin`

### Scans

#### `POST /api/scans`

- Accès: `admin`, `agent`
- Rôle: ingestion des rapports de scan agent

### Scan tasks (orchestration)

#### `POST /api/scan-tasks`

- Accès: `admin`
- Body:

```json
{
	"mode": "MANUAL_GLOBAL",
	"container_ids": [],
	"message": "Audit manuel"
}
```

#### `GET /api/scan-tasks`

- Accès: `admin`, `viewer`

#### `POST /api/scan-tasks/claim`

- Accès: `agent`

#### `POST /api/scan-tasks/:taskId/complete`

- Accès: `agent`

#### `GET /api/scan-tasks/scheduler-config`

- Accès: `admin`, `viewer`

#### `POST /api/scan-tasks/scheduler-config`

- Accès: `admin`

#### `POST /api/scan-tasks/scheduler-trigger`

- Accès: `admin`

### Users et MFA

#### `GET /api/users`

- Accès: `admin`

#### `GET /api/users/me`

- Accès: `admin`, `viewer`, `agent`

#### `POST /api/users`

- Accès: `admin`

#### `PATCH /api/users/:userId`

- Accès: `admin`

#### `POST /api/users/me/mfa/setup`

- Accès: `admin`, `viewer`, `agent`

#### `POST /api/users/me/mfa/enable`

- Accès: `admin`, `viewer`, `agent`

#### `POST /api/users/me/mfa/disable`

- Accès: `admin`, `viewer`, `agent`

#### `POST /api/users/me/mfa/recovery-codes`

- Accès: `admin`, `viewer`, `agent`

#### `POST /api/users/:userId/mfa/disable`

- Accès: `admin`

## Variables d'environnement sécurité

- JWT/MFA:
	- `AUTH_JWT_SECRET`
	- `AUTH_JWT_EXPIRES_IN`
- Rate limiting:
	- `AUTH_RATE_LIMIT_TTL_MS`
	- `AUTH_RATE_LIMIT_GLOBAL_LIMIT`
	- `AUTH_LOGIN_RATE_LIMIT_TTL_MS`
	- `AUTH_LOGIN_RATE_LIMIT_LIMIT`
- TLS API:
	- `HTTPS_ENABLED`
	- `HTTPS_PFX_FILE` ou (`HTTPS_KEY_FILE` + `HTTPS_CERT_FILE`)
	- `HTTPS_PFX_PASSPHRASE`
- Audit:
	- `AUDIT_LOG_PATH`
	- `AUDIT_LOG_MAX_IN_MEMORY`

## Tests de sécurité e2e

Suites disponibles dans `api/tests/e2e`:

- `auth.spec.ts`
- `auth-negative.spec.ts`
- `rbac-security.spec.ts`
- `rate-limit.spec.ts`
- `tls-validation.spec.ts`

Variables utiles pour l'exécution:

- `E2E_BASE_URL`
- `E2E_HTTPS_BASE_URL`
- `E2E_CA_CERT_FILE`
- `E2E_BAD_CA_CERT_FILE`
