# Projet-Timeo

Projet simple pour détecter des **CVE** dans des environnements **Docker**.

## Objectif (MVP)

Construire une première version avec 2 composants :

1. **Dashboard**
   - Affiche les résultats des scans (image, conteneur, sévérité, CVE).
   - Permet une lecture rapide des vulnérabilités détectées.

2. **Agent d’audit**
   - Scanne les images/conteneurs Docker.
   - Remonte une liste simple de CVE au Dashboard.

## Portée de la première version

- Audit basique des images Docker locales.
- Restitution simple des résultats (sans fonctionnalités avancées).
- Base de travail pour itérer ensuite avec l’équipe.
