# Mini rapport projet

## État actuel
Le projet démarre maintenant correctement avec `docker compose up -d --build`.

## Ce qui a été corrigé
- L’agent Docker est bien en lecture seule côté socket Docker.
- Les fichiers sensibles et les certificats sont ignorés dans `.gitignore`.
- Un rapport d’exploitation pour les certificats et secrets a été ajouté.
- Un écran de connexion minimal a été ajouté au frontend.
- Le build de l’agent Docker est corrigé.
- L’API accepte maintenant un certificat HTTPS au format `PFX`.
- Le service `cve-updater` a été corrigé pour lancer correctement `trivy`.

## Ce qui reste à faire
- Remettre un vrai scan Trivy stable côté agent si on veut une conformité complète.
- Ajouter une vraie gestion des comptes utilisateurs en base.
- Rendre le MFA plus complet et administrable.
- Ajouter des alertes automatiques sur les vulnérabilités critiques.
- Finaliser la documentation de production.

## Résumé simple
La base technique fonctionne. Le projet est utilisable pour une démonstration et un lancement local. Il reste surtout à terminer la partie production et sécurité avancée.
