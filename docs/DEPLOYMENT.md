# Guide de Déploiement Production — NoviSec Docker Auditor

**Version 1.0.0**  
**Date: Mai 2026**

---

## Table des Matières

1. [Prérequis](#prérequis)
2. [Architecture Production](#architecture-production)
3. [Sécurité TLS/HTTPS](#sécurité-tlshttps)
4. [Configuration des Variables d'Environnement](#configuration-des-variables-denvironnement)
5. [Déploiement avec Docker Compose](#déploiement-avec-docker-compose)
6. [Configuration PostgreSQL](#configuration-postgresql)
7. [Monitoring et Logs](#monitoring-et-logs)
8. [Backup et Disaster Recovery](#backup-et-disaster-recovery)
9. [Troubleshooting](#troubleshooting)
10. [Checklist Pré-Lancement](#checklist-pré-lancement)

---

## Prérequis

- **Serveur Linux** (Ubuntu 20.04+, Debian 11+, ou équivalent)
- **Docker** 20.10+
- **Docker Compose** 2.0+
- **OpenSSL** pour générer les certificats
- **Certaines ports disponibles**: 80, 443, 5432 (DB interne)
- **Espace disque**: ≥ 50GB pour la base PostgreSQL + logs
- **Mémoire RAM**: ≥ 4GB pour la stack complète (agent + API + DB)

Vérification:

```bash
docker --version
docker-compose --version
openssl version
```

---

## Architecture Production

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Environment                       │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ Reverse Proxy│◄─────│   API HTTPS  │─────►│ PostgreSQL   │ │
│  │ (Nginx/HA)   │      │   Port 443   │      │   (5432)     │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
│         │                                             ▲         │
│         │ HTTP/1.1 redirect                          │         │
│         ▼                                             │         │
│      Port 80                                         │         │
│                                                      │         │
│  ┌──────────────────────────────────────────────────┴─────┐   │
│  │ Docker Network (novisec-net)                          │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │ Agent Container (Read-Only)                 │    │   │
│  │  │ - Scanne via docker.sock (:ro)              │    │   │
│  │  │ - Envoie rapports à https://api:3001        │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │ Frontend Container (React)                  │    │   │
│  │  │ - Serveur statique nginx ou vite dev        │    │   │
│  │  │ - Parle à https://api:3001 en interne       │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sécurité TLS/HTTPS

### Générer les Certificats

**Option 1: Certificat Let's Encrypt (Recommandé)**

```bash
# Installer certbot
sudo apt-get install certbot python3-certbot-dns-route53  # (ou autre DNS provider)

# Générer le certificat
sudo certbot certonly --dns-route53 \
  -d auditor.novisec.fr \
  -d "*.auditor.novisec.fr"

# Les certificats seront dans /etc/letsencrypt/live/auditor.novisec.fr/
# - fullchain.pem (certificat)
# - privkey.pem (clé privée)
```

**Option 2: Certificat Auto-Signé (Dev/Test seulement)**

```bash
# Générer clé privée et certificat
openssl genrsa -out server.key 2048
openssl req -new -x509 -key server.key -out server.crt -days 365 \
  -subj "/C=FR/ST=IDF/L=Paris/O=NoviSec/CN=auditor.novisec.fr"

# Copier les fichiers
sudo cp server.key /etc/novisec/ssl/
sudo cp server.crt /etc/novisec/ssl/
sudo chown root:root /etc/novisec/ssl/*
sudo chmod 600 /etc/novisec/ssl/server.key
```

### Activer HTTPS dans Docker Compose

Mettre à jour le `.env.prod`:

```bash
# .env.prod
HTTPS_ENABLED=true
HTTPS_KEY_FILE=/etc/novisec/ssl/server.key
HTTPS_CERT_FILE=/etc/novisec/ssl/server.crt
```

Mettre à jour [docker-compose.yml](../../docker-compose.yml):

```yaml
api:
  build: ./api
  container_name: novisec-api
  ports:
    - "80:3001"      # HTTP redirige vers HTTPS
    - "443:3002"     # HTTPS
  environment:
    - HTTPS_ENABLED=true
    - HTTPS_KEY_FILE=/run/secrets/ssl_key
    - HTTPS_CERT_FILE=/run/secrets/ssl_cert
  secrets:
    - ssl_key
    - ssl_cert

secrets:
  ssl_key:
    file: /etc/novisec/ssl/server.key
  ssl_cert:
    file: /etc/novisec/ssl/server.crt
```

---

## Configuration des Variables d'Environnement

Créer un fichier `.env.prod`:

```bash
# API
PORT=3001
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_USER=novisec
POSTGRES_PASSWORD=<GENERATE_STRONG_PASSWORD_HERE>
POSTGRES_DB=novisec_db

# Tokens d'authentification (GÉNÉRER DE NOUVEAUX TOKENS)
ADMIN_TOKEN=<GENERATE_RANDOM_TOKEN_ADMIN_MIN_32_CHARS>
VIEWER_TOKEN=<GENERATE_RANDOM_TOKEN_VIEWER_MIN_32_CHARS>
AGENT_TOKEN=<GENERATE_RANDOM_TOKEN_AGENT_MIN_32_CHARS>

# HTTPS
HTTPS_ENABLED=true
HTTPS_KEY_FILE=/run/secrets/ssl_key
HTTPS_CERT_FILE=/run/secrets/ssl_cert

# CORS (adapter selon vos domaines)
CORS_ORIGIN=https://auditor.novisec.fr,https://www.auditor.novisec.fr

# Logs
LOG_LEVEL=info
AUDIT_LOG_PATH=/var/log/novisec/audit.log

# Agent
AGENT_ID=novisec-agent-prod-001
API_URL=https://api:3001
API_TOKEN=<SAME_AS_AGENT_TOKEN>
TRIVY_ENABLED=true
SCAN_TYPE=MANUAL_GLOBAL

# CVE Updates
CVE_UPDATE_CRON=0 */6 * * *
NVD_DATA_PATH=/var/lib/novisec/nvd
```

Générer des tokens sécurisés:

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -SetSeed (Get-Random) -MinimumValue 1000000 -MaximumValue 9999999))) | ForEach-Object { $_ -replace '[^a-zA-Z0-9]', '' }
```

---

## Déploiement avec Docker Compose

### 1. Préparer le Serveur

```bash
# Créer dossiers
mkdir -p /etc/novisec/ssl
mkdir -p /var/log/novisec
mkdir -p /var/lib/novisec/nvd

# Permissions
sudo chown root:root /etc/novisec /var/log/novisec /var/lib/novisec
sudo chmod 755 /etc/novisec /var/log/novisec /var/lib/novisec
```

### 2. Copier les Fichiers

```bash
# Cloner le repo ou copier les fichiers
scp -r ./projet-timeo/* user@production-server:/opt/novisec/

cd /opt/novisec
```

### 3. Configurer les Certificats

```bash
# Copier les certificats SSL
sudo cp /chemin/vers/server.key /etc/novisec/ssl/
sudo cp /chemin/vers/server.crt /etc/novisec/ssl/

# Permissions restrictives
sudo chmod 600 /etc/novisec/ssl/server.key
```

### 4. Lancer la Stack

```bash
# Charger les variables d'env
set -a
source .env.prod
set +a

# Build et lancement
docker-compose -f docker-compose.yml --env-file .env.prod up -d

# Vérifier les services
docker-compose ps
docker-compose logs -f
```

### 5. Vérifier le Démarrage

```bash
# Health check API
curl -k https://localhost:443/api/reports/overview \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Vérifier la base de données
docker-compose exec db psql -U novisec -d novisec_db -c "SELECT COUNT(*) FROM scans;"
```

---

## Configuration PostgreSQL

### Backup Automatique

Créer un script `backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/novisec"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/novisec_db_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump la base de données
docker-compose exec -T db pg_dump -U novisec novisec_db | gzip > "$BACKUP_FILE"

# Garder seulement les 7 derniers jours
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "✅ Backup effectué: $BACKUP_FILE"
```

Ajouter au crontab:

```bash
# Backup quotidien à 2h du matin
0 2 * * * /opt/novisec/backup.sh >> /var/log/novisec/backup.log 2>&1
```

### Restaurer un Backup

```bash
# Lister les backups disponibles
ls -la /var/backups/novisec/

# Restaurer un backup spécifique
zcat /var/backups/novisec/novisec_db_20260513_020000.sql.gz | \
  docker-compose exec -T db psql -U novisec -d novisec_db
```

---

## Monitoring et Logs

### Accéder aux Logs

```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f api
docker-compose logs -f agent
docker-compose logs -f db

# Audit logs (depuis l'API)
tail -f /var/log/novisec/audit.log
```

### Monitoring Recommandé

Installer Prometheus + Grafana pour la métrique:

```bash
# Health check endpoint (à ajouter)
GET /api/health
Response: { "status": "ok", "uptime": "2h30m", "db": "connected" }
```

---

## Backup et Disaster Recovery

### Plan de Récupération

| Incident | Récupération |
|----------|-------------|
| **Conteneur API down** | `docker-compose restart api` |
| **Base de données down** | `docker-compose restart db` + `docker-compose exec db psql...` |
| **Perte totale du serveur** | Restore depuis backup + redéploiement |
| **Certificat expiré** | Renouveler cert + redéployer + restart containers |

### RTO/RPO

- **RTO** (Recovery Time Objective): < 5 minutes (redémarrage services)
- **RPO** (Recovery Point Objective): < 1 heure (backups quotidiens)

---

## Troubleshooting

### API ne démarre pas

```bash
# Vérifier les logs
docker-compose logs api

# Vérifier la connexion DB
docker-compose exec api npm run typeorm migration:run

# Redémarrer
docker-compose restart api
```

### Agent ne scanne pas

```bash
# Vérifier les logs de l'agent
docker-compose logs agent

# Vérifier le socket Docker
docker-compose exec agent ls -la /var/run/docker.sock

# Relancer l'agent
docker-compose restart agent
```

### Certificat expiré

```bash
# Renewer le certificat Let's Encrypt
sudo certbot renew

# Redéployer les certificats
docker-compose down
sudo cp /etc/letsencrypt/live/auditor.novisec.fr/* /etc/novisec/ssl/
docker-compose up -d
```

### Port déjà en utilisation

```bash
# Trouver le processus
sudo lsof -i :443

# Tuer le processus
sudo kill -9 <PID>

# Ou changer le port dans docker-compose.yml
```

---

## Checklist Pré-Lancement

Avant de passer en production:

- [ ] **Sécurité**
  - [ ] Certificats SSL valides installés
  - [ ] Tokens d'auth générés et sauvegardés securely
  - [ ] Firewall configuré (ouvrir seulement 80, 443)
  - [ ] Docker daemon sécurisé (socket en :ro)
  - [ ] `.env.prod` protégé (permissions 600)

- [ ] **Performance**
  - [ ] Test de charge avec 50+ conteneurs
  - [ ] Test de charge avec 100+ tâches de scan
  - [ ] Vérifier RAM/CPU disponibles

- [ ] **Backup/DR**
  - [ ] Backup script testé
  - [ ] Crontab configuré pour backups quotidiens
  - [ ] Restore plan documenté et testé

- [ ] **Monitoring**
  - [ ] Logs configurés (centralisé si possible)
  - [ ] Health check endpoint accessible
  - [ ] Alertes configurées (API down, DB down, etc.)

- [ ] **Documentation**
  - [ ] Tous les tokens notés et sécurisés (vault, LastPass, etc.)
  - [ ] Plan de runbook pour incidents courants
  - [ ] Contact du support documenté

---

## Contacts et Support

- **Email**: support@novisec.fr
- **Documentation**: https://docs.novisec.fr
- **Issue Tracker**: https://github.com/novisec/docker-auditor/issues

---

**Last Updated: Mai 2026**
