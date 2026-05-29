# Rapport des modifications — NoviSec Docker Auditor

Date : 2026-05-28
Auteur : GitHub Copilot (agent)

## Objectif
Ce rapport documente toutes les modifications apportées au dépôt pour rapprocher le projet du cahier des charges : mise à jour CVE/Trivy, HTTPS dev, installation Trivy dans l'agent, job d'update automatique, authentification JWT, MFA optionnelle et tests e2e.

---

## Résumé des changements

- Ajout d'une mise à jour automatique de la DB Trivy dans l'agent et au niveau infra.
- Installation du binaire `trivy` dans l'image `agent`.
- Ajout d'un service `cve-updater` dans `docker-compose.yml` pour exécuter `trivy db update` périodiquement.
- Activation TLS DEV pour l'API (montage des certificats et variables d'environment).
- Implémentation d'une authentification JWT : endpoint `POST /api/auth/login` + génération et vérification JWT.
- Support optionnel de MFA (TOTP) via `speakeasy` (activable par `AUTH_MFA_ENABLED=true`).
- Adaptation du `BasicAuthGuard` : priorité JWT, fallback tokens statiques pour rétrocompatibilité.
- Ajout de tests e2e pour l'authentification (`api/tests/e2e/auth.spec.ts`).
- Scripts/variables d'environnement de configuration ajoutés/actualisés.

---

## Fichiers créés ou modifiés (liste principale)

- Agent
  - `agent/src/scanner/trivy.go` : ajout de `UpdateDB(ctx, trivyPath)`.
  - `agent/src/main.go` : appel de `scanner.UpdateDB()` au démarrage si `TRIVY_ENABLED=true`.
  - `agent/Dockerfile` : installation binaire `trivy` dans l'image.

- Infra / orchestration
  - `infra/scripts/update-cve-db.sh` : script pour `trivy db update`.
  - `docker-compose.yml` : montage `./certs` et variables HTTPS ; ajout du service `cve-updater` ; ajout des variables d'utilisateurs/mots de passe et secret JWT.

- API
  - `api/package.json` : ajout des dépendances `jsonwebtoken` et `speakeasy`.
  - `api/src/common/utils/jwt.ts` : helpers `signToken`/`verifyToken`.
  - `api/src/common/guards/basic-auth.guard.ts` : vérification JWT d'abord, fallback tokens statiques.
  - `api/src/modules/auth/auth.controller.ts` : `POST /api/auth/login` (émission JWT, MFA optionnelle).
  - `api/src/modules/auth/dto/login.dto.ts` : champ `otp` optionnel.
  - `api/src/modules/auth/auth.module.ts` : enregistrement du contrôleur.

- Tests
  - `api/tests/e2e/auth.spec.ts` : tests e2e login JWT et compatibilité token legacy.

- Divers
  - `infra/scripts/update-cve-db.sh` (mis à jour)
  - `REPORT_MODIFICATIONS.md` (ce fichier)

---

## Détails techniques et flux

### Mise à jour Trivy (agent)
- Au démarrage, l'agent exécute `scanner.UpdateDB(ctx, trivyPath)` si `TRIVY_ENABLED=true`.
- `UpdateDB` appelle la commande `trivy db update` via `exec.CommandContext`.
- L'image `agent` contient désormais le binaire `trivy` installé lors du build (`agent/Dockerfile`).

### Service de mise à jour CVE (infra)
- Le service `cve-updater` utilise l'image officielle `aquasec/trivy` et exécute en boucle :
  - `trivy db update` puis `sleep 21600` (6 heures).
- Option alternative : exécuter `infra/scripts/update-cve-db.sh` via crontab/CI.

### HTTPS (développement)
- `docker-compose.yml` monte `./certs` dans `/certs` du conteneur API.
- Variables prises en charge : `HTTPS_ENABLED`, `HTTPS_KEY_FILE`, `HTTPS_CERT_FILE`.
- Pour générer des certificats dev : `./generate-certs.sh`.

### Authentification JWT + MFA
- Endpoint : `POST /api/auth/login` — body `{ username, password, otp? }`.
- Si identifiants valides (définis par les variables d'environnement), le serveur renvoie `{ token, expiresIn }`.
- JWT signé avec `AUTH_JWT_SECRET` (changer en production).
- `BasicAuthGuard` vérifie d'abord `Authorization: Bearer <jwt>` via `verifyToken`; s'il échoue, il vérifie les tokens legacy (`ADMIN_TOKEN`, etc.).
- MFA TOTP (optionnel) : définir `AUTH_MFA_ENABLED=true` et fournir `*_MFA_SECRET` en base32. Le `otp` du login sera vérifié via `speakeasy`.

### Tests e2e
- Fichier : `api/tests/e2e/auth.spec.ts`.
- Nécessite l'API en fonctionnement et `npm` pour exécuter la suite.

---

## Variables d'environnement importantes

- Auth
  - `ADMIN_USER`, `ADMIN_PASSWORD`
  - `VIEWER_USER`, `VIEWER_PASSWORD`
  - `AGENT_USER`, `AGENT_PASSWORD`
  - `ADMIN_TOKEN`, `VIEWER_TOKEN`, `AGENT_TOKEN` (legacy)
- JWT & MFA
  - `AUTH_JWT_SECRET` — secret de signature JWT (ex. `change-me-in-prod`)
  - `AUTH_JWT_EXPIRES_IN` — ex. `8h`
  - `AUTH_MFA_ENABLED` — `true` pour activer MFA
  - `ADMIN_MFA_SECRET`, `VIEWER_MFA_SECRET`, `AGENT_MFA_SECRET` — secrets TOTP base32
- Agent / Trivy
  - `TRIVY_ENABLED=true`
  - `TRIVY_PATH` (optionnel)
- HTTPS
  - `HTTPS_ENABLED`, `HTTPS_KEY_FILE`, `HTTPS_CERT_FILE`

---

## Commandes d'utilisation

1. Générer les certificats dev :

```bash
./generate-certs.sh
```

2. Démarrer la stack (build + run) :

```bash
docker compose up --build
```

3. Exemple de login et utilisation du JWT :

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin-pass"}'

# Utilisation du token obtenu
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/reports/overview
```

4. Lancer les tests e2e (local) :

```bash
cd api
npm ci
npm run test:e2e
```

(Remarque : l'exécution des tests nécessite `npm`/`node` et une instance API en fonctionnement.)

---

## Recommandations de sécurité & production

- Stocker `AUTH_JWT_SECRET` et mots de passe dans un gestionnaire de secrets (Vault, etc.).
- Utiliser des certificats TLS valides en production (Let’s Encrypt ou PKI interne).
- Remplacer progressivement `API_TOKEN` par un flux d'authentification JWT pour l'agent ; retirer tokens legacy après migration.
- Mettre en place une rotation des secrets et un audit des accès.
- Ajouter monitoring/alerting autour des runs `trivy db update` et des échecs d'auth.

---

## Prochaines étapes proposées (priorisées)

1. Modifier l'`agent` pour effectuer un `POST /api/auth/login` et utiliser JWT au lieu d'`API_TOKEN` (sécurité renforcée).
2. Provisionner secrets via un secret manager.
3. Ajouter CI (GitHub Actions) pour : construire images, exécuter `trivy db update`, lancer tests e2e contre une stack ephemeral.
4. Ajouter UI pour provisionnement MFA (affichage QR code et enregistrement du secret TOTP).

---

## Contact / support

Si vous le souhaitez, je peux implémenter la migration complète de l'agent pour l'auth JWT (étape 1 ci‑dessus), ajouter le job CI (étape 3) ou générer la page UI de provisionnement MFA (étape 4). Indiquez la priorité et je m'en occupe.


---

*Fin du rapport*
