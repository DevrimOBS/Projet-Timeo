# Security Release Checklist

Checklist minimale pour valider une release "propre" avant mise en production.

## 1) Prérequis plateforme

- [ ] Docker daemon actif
- [ ] Fichier `.env`/`.env.prod` présent et non commité
- [ ] Certificats TLS disponibles dans `certs/`
- [ ] Base PostgreSQL accessible

## 2) Build et qualité de code

- [ ] API compile:

```bash
cd api
npm run build
```

- [ ] Web compile:

```bash
cd web
npm run build
```

## 3) Sécurité API

- [ ] JWT actif et `AUTH_JWT_SECRET` non défaut
- [ ] Rate limit login actif (`AUTH_LOGIN_RATE_LIMIT_*`)
- [ ] RBAC vérifié sur endpoints admin/viewer/agent
- [ ] MFA testée (setup, enable, disable, recovery code)
- [ ] Audit logging persistant activé (`AUDIT_LOG_PATH`)

## 4) TLS

- [ ] API en HTTPS (`HTTPS_ENABLED=true`)
- [ ] Certificat valide pour le host cible
- [ ] Validation CA côté clients (agent/web) sans `INSECURE_SKIP_TLS_VERIFY=true`

## 5) Exécution tests e2e sécurité

- [ ] Variables e2e renseignées (`E2E_BASE_URL`, etc.)
- [ ] Lancer la suite:

```bash
cd api
npm run test:e2e
```

- [ ] Suites attendues présentes:
  - `auth.spec.ts`
  - `auth-negative.spec.ts`
  - `rbac-security.spec.ts`
  - `rate-limit.spec.ts`
  - `tls-validation.spec.ts` (si HTTPS configuré)

## 6) Exploitation et observabilité

- [ ] Rotation certificats documentée
- [ ] Rotation secret JWT documentée
- [ ] Procédure de rollback testée
- [ ] Logs audit consultables et archivés

## 7) Critères de go/no-go

GO si:

- [ ] Builds API/Web OK
- [ ] e2e sécurité OK
- [ ] TLS validé
- [ ] Secrets non défaut

NO-GO si:

- [ ] Un test sécurité critique échoue
- [ ] JWT secret/certs manquants
- [ ] API accessible uniquement en HTTP en environnement prod