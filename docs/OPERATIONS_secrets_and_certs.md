# Rotation des certificats TLS et gestion des secrets

Objectif : procédures courtes et reproductibles pour la rotation des certificats HTTPS et des secrets (JWT, mots de passe, tokens) en production.

Principes généraux
- Ne jamais committer les certificats privés, clés ou fichiers `.env` dans le dépôt (ils sont déjà ignorés dans `.gitignore`).
- Stocker les secrets dans un coffre (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault) pour les environnements prod.
- Automatiser la rotation (cron ou pipeline CI/CD) et documenter la fenêtre de maintenance.

Rotation d'un certificat HTTPS (procédure rapide)
1. Générer/obtenir le nouveau couple clé/certificat (ex. via votre CA ou `generate-certs.sh`).

Exemple local rapide :
```bash
# génère server.key et server.crt dans ./certs
./generate-certs.sh --output ./certs
```

2. Vérifier les fichiers et permissions :
```bash
ls -l certs/server.*
chmod 640 certs/server.key
chown root:root certs/server.*
```

3. Déployer le certificat dans le chemin attendu par le container API (`./certs` monté en `:ro` dans `docker-compose.yml`).

4. Redémarrer uniquement le service API pour prise en compte :
```bash
docker compose up -d --no-deps --force-recreate api
```

5. Valider HTTPS :
```bash
curl -v --tlsv1.3 https://localhost:3002  # ou l'URL exposée
```

Rotation du secret JWT / mots de passe
1. Préparer le nouveau secret dans le coffre ou `.env` temporaire (ne pas committer).
2. Mettre à jour la variable d'environnement `AUTH_JWT_SECRET` pour le service `api` (dans le déploiement orchestré via secret store ou CI/CD).
3. Révoquer/expirer les tokens si nécessaire (implémenter token blacklisting ou diminuer `AUTH_JWT_EXPIRES_IN` temporairement).
4. Redémarrer le service API :
```bash
docker compose up -d --no-deps --force-recreate api
```

Recommandations opérationnelles
- Automatiser la mise à jour via pipeline CI (récupérer secrets depuis coffre, déployer, redémarrer service en rolling).
- Maintenir une courte fenêtre d'expiration des tokens et prévoir un mécanisme de révocation pour incident.
- Journaliser chaque rotation (source, opérateur, horaire, checksum du certificat) dans un fichier d'audit sécurisé.
- Tester le processus dans un environnement staging avant prod.

Annexes
- Script d'aide : `generate-certs.sh` et `generate-certs.ps1` fournis au repo.
- Fichier à protéger : `certs/server.key`, `certs/server.crt`, `.env*`.

Fin.
