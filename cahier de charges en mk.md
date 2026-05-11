# NoviSec — Docker Auditor

## Cahier des Charges

**Spécifications fonctionnelles et techniques pour le déploiement d'une solution d'audit de sécurité des environnements Docker — Détection CVE/CWE, scoring CVSS v3 et monitoring continu.**

* **Projet :** Audit & Sécurité Docker
* **Version :** 1.0.0
* **Date :** Mai 2026
* **Confidentialité :** Confidentiel
* **Site web :** [https://novisec.fr/auditor](https://novisec.fr/auditor)

---

# 1. Contexte et Objectifs

Dans un contexte où les infrastructures conteneurisées sont devenues la norme, la surface d'attaque s'est considérablement élargie. Les conteneurs embarquent souvent des dépendances obsolètes ou vulnérables (CVE — Common Vulnerabilities and Exposures) qui peuvent compromettre l'ensemble du système d'information.

Le projet **Novisec Docker Auditor** vise à fournir une solution clé en main, non intrusive et hautement automatisée pour la détection de vulnérabilités au sein d'environnements Docker.

## Objectif principal

Déployer un agent passif (**lecture seule**) capable de cartographier et d'analyser l'intégralité d'un réseau Docker local afin de remonter les failles de sécurité vers un panneau de contrôle (**Dashboard**) centralisé.

---

# 2. Description Générale de la Solution

La solution se divise en deux composants architecturaux majeurs, pensés pour garantir à la fois la sécurité de l'hôte et la facilité de consultation des résultats.

## 2.1 Agent d'Audit (Image Docker)

Un conteneur déployé avec des privilèges stricts de lecture seule. Il s'interface avec le socket Docker de l'hôte de manière sécurisée afin d'analyser les images et les conteneurs en cours d'exécution sans jamais interférer avec la production.

## 2.2 Panneau de Contrôle Web (Dashboard)

Une interface centralisée permettant aux administrateurs systèmes et aux équipes SecOps de :

* Visualiser l'état de sécurité du parc Docker
* Lancer des analyses
* Consulter des rapports détaillés
* Suivre les vulnérabilités détectées

---

# 3. Spécifications Fonctionnelles

## 3.1 Agent d'Audit (Scanner)

### Principe de moindre privilège

L'image s'exécute en mode **Read-Only**.

Elle ne peut :

* Modifier les conteneurs
* Altérer les services
* Arrêter les conteneurs

### Périmètre d'analyse

Détection automatique :

* De tous les conteneurs du réseau Docker cible
* Des images sous-jacentes associées

### Moteur de détection

Identification des :

* Paquets OS (Debian, Alpine, Ubuntu, etc.)
* Dépendances applicatives (npm, pip, maven, etc.)

Croisement des données avec la base :

* **NVD** (National Vulnerability Database)

### Transmission sécurisée

Envoi des résultats des scans vers le Dashboard via :

* API REST sécurisée
* TLS 1.3

---

## 3.2 Panneau de Contrôle Web (Dashboard)

Le dashboard constitue le centre névralgique de la solution.

### Fonctionnalités principales

#### Vue d'ensemble (Overview)

* Graphiques synthétiques
* Nombre de conteneurs sains vs vulnérables
* Score de risque global de l'infrastructure

#### Matrice de criticité

Tri et filtrage des CVE selon le score **CVSS v3** :

* Critique
* Haut
* Moyen
* Faible

#### Fiche détaillée par conteneur

Informations disponibles :

* ID du conteneur
* Nom
* Image
* Statut

Liste exhaustive des failles détectées avec recommandations de remédiation.

Exemple :

> Mettre à jour la librairie log4j vers la version 2.17.1

---

## 3.3 Gestion et Programmation des Analyses

L'outil doit offrir une flexibilité totale concernant le déclenchement des audits de sécurité afin de s'adapter aux processus DevSecOps.

| Mode de déclenchement      | Description                                                        | Cas d'usage typique                                      |
| -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Analyse manuelle globale   | Scan immédiat de l'ensemble du parc Docker connecté à l'agent      | Audit ponctuel de conformité ou réponse à incident       |
| Analyse manuelle ciblée    | Scan d'un ou plusieurs conteneurs sélectionnés depuis le dashboard | Vérification post-déploiement d'un nouveau micro-service |
| Analyse automatique (CRON) | Programmation récurrente (quotidienne, hebdomadaire, etc.)         | Supervision continue et détection des failles Zero-Day   |

---

# 4. Spécifications Techniques et Sécurité

## 4.1 Architecture Technologique (Recommandée)

### Agent Scanner

Développé en :

* Go (recommandé pour la légèreté et les performances)
* ou Python

Intégration possible :

* Trivy
* Clair

Déploiement via :

* `docker-compose.yml`

### Backend Dashboard

API développée avec :

* Node.js (NestJS)
* ou Python (FastAPI)

### Frontend Dashboard

Framework recommandé :

* Vue.js
* React.js

### Design System

* Interface orientée Dark Mode
* Aspect cybersécurité
* Reprise du logo blanc NoviSec

### Base de données

Utilisation de :

* PostgreSQL

Pour :

* Le stockage des résultats de scan
* L'historique des remédiations

---

## 4.2 Exigences de Sécurité

### Sécurisation du socket Docker

L'agent nécessite un accès au socket :

```bash
/var/run/docker.sock
```

Le montage doit impérativement être effectué en lecture seule :

```yaml
:ro
```

Objectif :

* Interdire toute création de conteneur
* Interdire toute modification
* Interdire toute suppression

### Authentification Dashboard

Accès protégé via :

* Authentification forte
* MFA fortement recommandé
* Gestion RBAC

Rôles :

* Admin
* Viewer

### Mise à jour de la base CVE

Le scanner doit mettre à jour automatiquement sa base de vulnérabilités avant chaque scan depuis un flux réseau sortant sécurisé.

---

# 5. Planning Prévisionnel

Le développement et la mise en production s'articulent autour de 4 phases distinctes.

| Phase                                | Description                                                  | Durée estimée |
| ------------------------------------ | ------------------------------------------------------------ | ------------- |
| Phase 1 — Architecture & Maquettage  | Validation de l'architecture et maquettes UI/UX du Dashboard | 2 semaines    |
| Phase 2 — Développement Agent Docker | Agent Read-Only opérationnel et remontée des premiers scans  | 3 semaines    |
| Phase 3 — Développement Dashboard    | API Backend, interface Web complète et gestion des alertes   | 4 semaines    |
| Phase 4 — Intégration & Tests        | Tests d'intrusion et vérification de la charge réseau        | 2 semaines    |

---

# Conclusion

Le projet **NoviSec Docker Auditor** a pour objectif de fournir une solution robuste, sécurisée et automatisée de surveillance des vulnérabilités Docker.

La plateforme doit permettre :

* Une analyse passive et sécurisée
* Une visualisation centralisée des risques
* Une intégration simple dans les environnements DevSecOps
* Une supervision continue des vulnérabilités critiques
