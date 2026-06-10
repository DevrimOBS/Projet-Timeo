E2E tests
---------

Run the jest e2e tests (requires dev dependencies install):

```bash
cd api
npm install
npm run test:e2e
```

Or run the smoke script (bash):

```bash
./api/tests/e2e/run-e2e-smoke.sh
```

Or PowerShell script on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\tests\e2e\run-e2e-smoke.ps1
```

# API (NestJS)

Backend central pour la reception des scans, le stockage historique PostgreSQL et l exposition des vues dashboard.

## Lancement

1. npm install
2. npm run dev

## Variables d environnement

- PORT (defaut: 3001)
- CORS_ORIGIN (defaut: *)
- ADMIN_TOKEN (defaut: admin-dev-token)
- VIEWER_TOKEN (defaut: viewer-dev-token)
- POSTGRES_HOST (defaut: localhost)
- POSTGRES_PORT (defaut: 5432)
- POSTGRES_USER (defaut: postgres)
- POSTGRES_PASSWORD (defaut: postgres)
- POSTGRES_DB (defaut: novisec)

## RBAC

- Admin: POST scans + lecture reports
- Viewer: lecture reports

Authentification: header Authorization Bearer <token>

## Comptes utilisateurs

Les comptes sont maintenant stockés en base PostgreSQL dans la table `users`.

Endpoints d'administration:

- GET /api/users
- GET /api/users/me
- POST /api/users
- PATCH /api/users/:userId
- POST /api/users/me/mfa/setup
- POST /api/users/me/mfa/enable
- POST /api/users/me/mfa/disable
- POST /api/users/me/mfa/recovery-codes
- POST /api/users/:userId/mfa/disable

Ces routes sont réservées au rôle `admin`.

Les routes `me` sont disponibles pour l'utilisateur connecté afin de provisionner et gérer sa propre MFA.

## Endpoints demandes

- POST /api/scans
- GET /api/reports/overview
- GET /api/reports/matrix
- GET /api/reports/details/:containerId
- GET /api/reports/alerts
- POST /api/reports/alerts/:alertId/ack

## Alertes critiques automatiques

Quand une vulnérabilité de sévérité `critical` est ingérée via `POST /api/scans`,
une alerte est créée automatiquement en base dans la table `alerts`.

Variables d'environnement associées:

- ALERT_WEBHOOK_URL (optionnel): URL d'un webhook HTTP recevant le lot d'alertes critiques

Comportement:

- Sans webhook configuré, l'alerte est persistée mais marquée `delivery_status=skipped`
- Si webhook configuré et succès HTTP, `delivery_status=delivered`
- Si webhook configuré et échec HTTP/réseau, `delivery_status=failed` + `delivery_error`

## CVE auto update

Un job interne planifie met a jour les metadonnees CVE toutes les 6 heures depuis le flux NVD (table cve_updates).

## Scan task scheduler metier

Un scheduler metier peut creer automatiquement des taches de scan dans `scan_tasks` (mode `AUTO_CRON`).

Variables d environnement associees:

- SCAN_TASK_SCHEDULER_ENABLED (defaut: false)
- SCAN_TASK_SCHEDULER_CRON (defaut: 0 */12 * * *)
- SCAN_TASK_SCHEDULER_TIMEZONE (optionnel, ex: Europe/Paris)
- SCAN_TASK_SCHEDULER_RUN_ON_STARTUP (defaut: false)
- SCAN_TASK_SCHEDULER_REQUESTED_BY (defaut: system:scheduler)
- SCAN_TASK_SCHEDULER_MESSAGE (defaut: Scan automatique planifie)
- SCAN_TASK_SCHEDULER_CONTAINER_IDS (optionnel, liste CSV d identifiants de conteneurs cibles)

Endpoints associes:

- GET /api/scan-tasks/scheduler-config (admin, viewer)
- POST /api/scan-tasks/scheduler-config (admin)
- POST /api/scan-tasks/scheduler-trigger (admin)
