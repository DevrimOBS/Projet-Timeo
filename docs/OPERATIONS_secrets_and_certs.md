# Rotation des certificats TLS et gestion des secrets

Objectif : procedures courtes et reproductibles pour la rotation des certificats HTTPS et des secrets en production.

## TLS local avec Docker Compose

La stack Docker locale utilise :

- API HTTP interne/exposee : `http://localhost:3000` vers le port container `3001`
- API HTTPS : `https://localhost:3002` vers le port container `3002`
- Agent vers API : `https://api:3002`
- CA agent : `/certs/ca.crt`

Le dossier `./certs` est monte en lecture seule dans `api` et `agent`.

## Generer les certificats locaux

Windows PowerShell :

```powershell
.\generate-certs.ps1
```

Linux/macOS/Git Bash :

```bash
./generate-certs.sh
```

Les scripts generent :

- `certs/ca.crt` : certificat de CA locale a faire confiance cote client
- `certs/ca.key` : cle privee de CA, a proteger
- `certs/server.crt` : certificat serveur API
- `certs/server.key` : cle privee serveur API
- `certs/server.pfx` : format PKCS12 optionnel, mot de passe `novisec-secure-pass`

Le certificat serveur est valide pour `localhost`, `127.0.0.1`, `api` et `*.novisec.local`.

## Activer TLS dans Compose

Les variables attendues dans `docker-compose.yml` sont :

```yaml
api:
  environment:
    - HTTPS_ENABLED=true
    - HTTPS_KEY_FILE=/certs/server.key
    - HTTPS_CERT_FILE=/certs/server.crt
  volumes:
    - ./certs:/certs:ro

agent:
  environment:
    - API_URL=https://api:3002
    - API_CA_CERT_FILE=/certs/ca.crt
    - INSECURE_SKIP_TLS_VERIFY=false
  volumes:
    - ./certs:/certs:ro

frontend:
  environment:
    - VITE_API_URL=https://localhost:3002
```

## Rotation d'un certificat HTTPS

1. Generer ou obtenir le nouveau couple cle/certificat.

```bash
./generate-certs.sh
```

2. Verifier les fichiers :

```bash
ls -l certs/ca.crt certs/server.crt certs/server.key
```

3. Redemarrer les services qui lisent les certificats :

```bash
docker compose up -d --no-deps --force-recreate api agent frontend
```

4. Valider HTTPS :

```bash
curl --cacert certs/ca.crt --tlsv1.3 https://localhost:3002/api/reports/overview \
  -H "Authorization: Bearer admin-dev-token"
```

Dans un navigateur, importer `certs/ca.crt` comme autorite locale si le certificat auto-signe n'est pas accepte.

## Rotation du secret JWT / mots de passe

1. Preparer le nouveau secret dans le coffre ou dans un `.env` temporaire non committe.
2. Mettre a jour `AUTH_JWT_SECRET` pour le service `api`.
3. Revoquer ou expirer les tokens si necessaire.
4. Redemarrer l'API :

```bash
docker compose up -d --no-deps --force-recreate api
```

## Recommandations operationnelles

- Ne jamais committer les certificats prives, cles ou fichiers `.env`.
- Stocker les secrets dans un coffre pour les environnements de production.
- Utiliser une CA publique ou interne en production au lieu de la CA locale de developpement.
- Journaliser chaque rotation avec l'operateur, l'heure et le checksum du certificat.
