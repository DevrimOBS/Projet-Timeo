code API NestJS.  
Je vais te faire le breakdown complet de ce `main.ts`, avec :

***

# Breakdown de `main.ts`

## Vue d’ensemble

Ce fichier est le **point d’entrée** de l’API NestJS. Il démarre l’application, active CORS, configure une validation globale des requêtes, lit le port depuis les variables d’environnement, puis démarre le serveur en HTTP seul ou en HTTP + HTTPS selon la configuration. Nest démarre une application via `NestFactory.create(AppModule)`, et `enableCors()` active CORS au niveau global. [docs.nestjs](https://docs.nestjs.com/security/cors)

***

## Imports

```ts
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import 'reflect-metadata';
import * as fs from 'fs';
import * as https from 'https';
```

### `ValidationPipe`

- Importé depuis `@nestjs/common`.
- Sert à valider automatiquement les données entrantes, généralement les DTOs envoyés dans les requêtes HTTP. Nest documente `ValidationPipe` comme le mécanisme standard pour valider, filtrer et transformer les payloads. [docs.nestjs](https://docs.nestjs.com/techniques/validation)

### `NestFactory`

- Importé depuis `@nestjs/core`.
- Sert à créer l’application NestJS à partir du module racine. Nest recommande `NestFactory.create(AppModule)` pour bootstrap l’application. [docs.nestjs](https://docs.nestjs.com/security/cors)

### `AppModule`

- Module racine de ton application.
- Il regroupe probablement les controllers, services, providers et autres modules.

### `reflect-metadata`

- Charge le support des métadonnées utilisé par TypeScript, NestJS et des libs comme `class-validator` / `class-transformer`.
- Très souvent nécessaire dans les projets NestJS basés sur décorateurs.

### `fs`

- Module natif Node.js pour manipuler le système de fichiers.
- Ici utilisé pour :
  - vérifier si les certificats existent,
  - lire le contenu des fichiers clé/certificat. `fs.existsSync()` vérifie l’existence d’un fichier et `fs.readFileSync()` lit le contenu de manière synchrone. [memberstack](https://www.memberstack.com/blog/reading-files-in-node-js)

### `https`

- Module natif Node.js pour créer un serveur HTTPS.
- Ici utilisé pour démarrer un second serveur TLS avec `https.createServer(...)`. Le module HTTPS Node permet bien de créer un serveur à partir d’une clé et d’un certificat. [nodejs](https://nodejs.org/api/https.html)

***

## Fonction `bootstrap`

```ts
async function bootstrap(): Promise<void> {
```

### Rôle

- Fonction principale de démarrage de l’API.
- Elle centralise toute l’initialisation de l’application avant son lancement.

### Type de retour

- `Promise<void>` : la fonction est asynchrone et ne retourne pas de valeur utile, seulement une promesse résolue quand l’initialisation est finie.

***

## Création de l’application

```ts
const app = await NestFactory.create(AppModule);
```

### Variable

- `app` : instance de l’application NestJS.

### Rôle

- Créer l’application à partir de `AppModule`.
- C’est l’objet principal qui permet ensuite :
  - d’activer CORS,
  - d’ajouter des pipes,
  - de démarrer le serveur HTTP. `NestFactory.create()` est la méthode standard de bootstrap NestJS. [docs.nestjs](https://docs.nestjs.com/security/cors)

***

## Activation de CORS

```ts
app.enableCors({ origin: process.env.CORS_ORIGIN ?? "*" });
```

### Variable utilisée

- `process.env.CORS_ORIGIN` : variable d’environnement définissant l’origine autorisée.
- `?? "*"` : si la variable est `null` ou `undefined`, l’origine autorisée devient `"*"`.

### Rôle

- Autoriser les requêtes cross-origin depuis le front ou d’autres clients.
- Si `CORS_ORIGIN` n’est pas défini, l’API accepte toutes les origines.

### Explication

Nest permet d’activer CORS avec `enableCors()`, et l’option `origin` contrôle quelles origines sont autorisées. [docs.nest-js](https://docs.nest-js.fr/security/cors)

### Exemple

- `CORS_ORIGIN=http://localhost:3000` → seul ce front peut appeler l’API depuis un navigateur.
- absence de variable → toutes les origines sont autorisées via `*`.

### Point de sécurité

- `*` est pratique en développement.
- En production, il est souvent préférable de limiter explicitement l’origine.

***

## Validation globale des requêtes

```ts
app.useGlobalPipes(
    new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    })
);
```

### Rôle

- Installer un pipe global qui s’applique à toutes les routes de l’application.
- Ce pipe valide les objets entrants selon les DTOs et décorateurs de validation.

### `ValidationPipe`

Nest documente plusieurs options importantes du `ValidationPipe`, notamment `transform`, `whitelist` et `forbidNonWhitelisted`. [docs.nest-js](https://docs.nest-js.fr/techniques/validation)

#### `whitelist: true`

- Supprime les propriétés qui ne sont pas définies dans le DTO.
- Cela évite que des champs inattendus traversent la validation. [stackoverflow](https://stackoverflow.com/questions/55414165/why-does-whitelist-dont-get-error-with-wrong-model-nestjs)

#### `forbidNonWhitelisted: true`

- Au lieu de simplement supprimer les champs inconnus, déclenche une erreur.
- Cela rend le contrat d’entrée plus strict. [docs.nestjs](https://docs.nestjs.com/techniques/validation)

#### `transform: true`

- Transforme automatiquement les payloads en instances typées des DTOs.
- Peut aussi convertir certains types primitifs selon les décorateurs et types attendus. [docs.nest-js](https://docs.nest-js.fr/techniques/validation)

### Exemple logique

Si ton DTO attend :

```ts
class CreateUserDto {
  name: string;
}
```

et que le client envoie :

```json
{
  "name": "Nico",
  "admin": true
}
```

alors :

- avec `whitelist: true` seul `name` est retenu,
- avec `forbidNonWhitelisted: true` l’API peut répondre par une erreur au lieu d’ignorer `admin`. [stackoverflow](https://stackoverflow.com/questions/55414165/why-does-whitelist-dont-get-error-with-wrong-model-nestjs)

### Intérêt

- Sécurité,
- cohérence des entrées,
- réduction des comportements inattendus côté backend.

***

## Lecture du port

```ts
const port = Number(process.env.PORT ?? 3001);
```

### Variable

- `port` (`number`) : port principal HTTP de l’application.

### Rôle

- Lire le port depuis l’environnement.
- Si `PORT` n’est pas défini, utiliser `3001`.

### Détail

- `process.env.PORT` est une chaîne ou `undefined`.
- `Number(...)` convertit cette valeur en nombre.
- `?? 3001` fournit une valeur par défaut.

### Exemple

- `PORT=8080` → `port = 8080`
- pas de variable → `port = 3001`

***

## Bloc de commentaire

```ts
// HTTPS support (optional, for production)
```

### Rôle

- Indiquer qu’un mode HTTPS optionnel existe.
- Le commentaire suggère que HTTPS est destiné aux environnements de production, ou au moins à des environnements sécurisés.

***

## Activation conditionnelle du HTTPS

```ts
const useHttps = process.env.HTTPS_ENABLED === 'true';
```

### Variable

- `useHttps` (`boolean`) : indique si le mode HTTPS doit être activé.

### Rôle

- Lire un flag d’environnement.
- Si `HTTPS_ENABLED` vaut exactement la chaîne `'true'`, alors HTTPS est activé.

### Exemple

- `HTTPS_ENABLED=true` → `useHttps = true`
- `HTTPS_ENABLED=false` ou absent → `useHttps = false`

***

## Bloc `if (useHttps)`

```ts
if (useHttps) {
```

### Rôle

- Séparer le démarrage en deux modes :
  - mode mixte HTTP + HTTPS,
  - mode HTTP simple.

***

## Lecture des chemins de certificats

```ts
const keyPath = process.env.HTTPS_KEY_FILE;
const certPath = process.env.HTTPS_CERT_FILE;
```

### Variables

- `keyPath` : chemin du fichier de clé privée.
- `certPath` : chemin du fichier de certificat public.

### Rôle

- Lire les variables nécessaires pour construire un serveur HTTPS Node.js.
- Un serveur TLS Node a besoin d’une clé privée et d’un certificat. `https.createServer()` accepte justement des options comme `key` et `cert`. [community.letsencrypt](https://community.letsencrypt.org/t/node-js-configuration/5175)

***

## Vérification de présence des variables

```ts
if (!keyPath || !certPath) {
    throw new Error('HTTPS_ENABLED=true but HTTPS_KEY_FILE or HTTPS_CERT_FILE not set');
}
```

### Rôle

- Empêcher un démarrage HTTPS incomplet.
- Si HTTPS est activé mais qu’un chemin de fichier manque, l’application lève une erreur immédiatement.

### Intérêt

- Éviter un démarrage silencieusement incorrect.
- Forcer une configuration explicite.

***

## Vérification de l’existence des fichiers

```ts
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error(`HTTPS certificate files not found: ${keyPath} or ${certPath}`);
}
```

### Rôle

- Vérifier que les fichiers réellement pointés existent sur le disque.
- `fs.existsSync()` renvoie un booléen selon l’existence du fichier. [memberstack](https://www.memberstack.com/blog/reading-files-in-node-js)

### Intérêt

- Détecter une mauvaise config avant le lancement du serveur.
- Éviter de planter plus loin pendant la lecture du certificat.

***

## Construction des options HTTPS

```ts
const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
};
```

### Variable

- `httpsOptions` : objet de configuration passé au serveur HTTPS.

### Rôle

- Charger en mémoire :
  - la clé privée,
  - le certificat.

### Explication

Node.js attend un objet d’options contenant typiquement `key` et `cert`, alimentés par `fs.readFileSync(...)`. C’est un pattern standard dans la doc HTTPS Node. [nodejs](https://nodejs.org/api/https.html)

### Remarque

- `readFileSync()` bloque le thread pendant la lecture.
- Ici c’est acceptable car ça se produit une seule fois au démarrage.

***

## Démarrage du serveur HTTP local

```ts
await app.listen(port, 'localhost');
```

### Rôle

- Démarrer le serveur HTTP géré par Nest sur `localhost:port`.
- En mode HTTPS, ce serveur HTTP reste actif en parallèle.

### Effet

- Le serveur HTTP de l’application écoute sur l’adresse locale.
- Il n’est donc pas exposé sur toutes les interfaces si l’hôte est explicitement `localhost`.

### Point intéressant

En mode HTTPS, ton code démarre **d’abord** l’app Nest en HTTP, puis crée un serveur HTTPS séparé au-dessus de `app.getHttpServer()`.

***

## Création du serveur HTTPS

```ts
const server = https.createServer(httpsOptions, app.getHttpServer());
```

### Variable

- `server` : instance du serveur HTTPS Node.js.

### Rôle

- Construire un serveur HTTPS en réutilisant le serveur HTTP interne de Nest comme handler.
- `https.createServer(options, requestListener)` est la forme standard Node pour créer un serveur TLS. [nodejs](https://nodejs.org/api/https.html)

### Détail

- `app.getHttpServer()` renvoie le serveur HTTP sous-jacent ou le handler exploitable par Nest.
- Tu ajoutes donc une couche TLS autour du serveur existant.

***

## Lancement du serveur HTTPS

```ts
server.listen(port + 1, () => {
    console.log(`🔒 HTTPS server running on https://localhost:${port + 1}`);
});
```

### Rôle

- Démarrer le serveur HTTPS sur un port distinct.
- Ici, si HTTP est sur `3001`, HTTPS sera sur `3002`.

### Variables implicites

- `port + 1` : port HTTPS.
- callback `() => { ... }` : exécutée une fois le serveur prêt.

### Comportement

- HTTP écoute sur `port`
- HTTPS écoute sur `port + 1`

### Remarque d’architecture

Ce choix est simple et pratique en dev ou en environnement de test, mais en production on voit souvent :

- HTTP sur 80 et HTTPS sur 443,
- ou bien uniquement HTTPS derrière un reverse proxy.

***

## Log HTTP complémentaire

```ts
console.log(`✅ HTTP server running on http://localhost:${port}`);
```

### Rôle

- Afficher clairement que le serveur HTTP est aussi actif.
- Utile car en mode HTTPS, l’application ne coupe pas HTTP.

***

## Bloc `else` : mode HTTP simple

```ts
} else {
    await app.listen(port);
    console.log(`✅ API server running on http://localhost:${port}`);
}
```

### Rôle

- Cas sans HTTPS.
- L’application écoute directement sur le port défini, probablement sur toutes les interfaces par défaut selon le driver HTTP utilisé.

### Détail

- `await app.listen(port)` démarre le serveur Nest.
- Le log confirme l’URL d’accès attendue.

Nest documente bien `app.listen(...)` comme le mécanisme standard de démarrage du serveur. [docs.nest-js](https://docs.nest-js.fr/security/cors)

***

## Lancement final

```ts
void bootstrap();
```

### Rôle

- Appeler la fonction `bootstrap()` sans attendre explicitement son résultat.
- Le mot-clé `void` ici signale qu’on ignore volontairement la promesse retournée.

### Pourquoi c’est utilisé

- Pour éviter certains warnings TypeScript / linters liés aux promesses non attendues.
- C’est une manière explicite de dire : “je lance cette fonction async, son résultat n’est pas utilisé ici”.

***

# Résumé du flux complet

Le déroulé complet du fichier est :

1. Créer l’application Nest avec `AppModule`. [docs.nestjs](https://docs.nestjs.com/security/cors)
2. Activer CORS avec une origine configurable. [docs.nest-js](https://docs.nest-js.fr/security/cors)
3. Installer un `ValidationPipe` global pour nettoyer, bloquer et transformer les entrées. [docs.nestjs](https://docs.nestjs.com/techniques/validation)
4. Lire le port principal depuis `PORT`.  
5. Lire `HTTPS_ENABLED`.  
6. Si HTTPS est activé :
   - lire les chemins de certificats,
   - vérifier qu’ils existent,
   - charger leur contenu,
   - démarrer HTTP sur `port`,
   - démarrer HTTPS sur `port + 1` avec `https.createServer(...)`. [community.letsencrypt](https://community.letsencrypt.org/t/node-js-configuration/5175)
7. Sinon :
   - démarrer seulement HTTP sur `port`. [docs.nestjs](https://docs.nestjs.com/security/cors)
8. Lancer `bootstrap()`.

***

# Ce que fait chaque variable

| Variable | Type logique | Rôle |
|---|---|---|
| `app` | application Nest | instance principale de l’API |
| `port` | `number` | port HTTP principal |
| `useHttps` | `boolean` | active ou non le mode HTTPS |
| `keyPath` | `string \| undefined` | chemin de la clé privée TLS |
| `certPath` | `string \| undefined` | chemin du certificat TLS |
| `httpsOptions` | objet | options passées au serveur HTTPS Node |
| `server` | serveur HTTPS | second serveur sécurisé |
| `process.env.CORS_ORIGIN` | `string \| undefined` | origine CORS autorisée |
| `process.env.PORT` | `string \| undefined` | port configuré |
| `process.env.HTTPS_ENABLED` | `string \| undefined` | flag d’activation HTTPS |
| `process.env.HTTPS_KEY_FILE` | `string \| undefined` | chemin de la clé |
| `process.env.HTTPS_CERT_FILE` | `string \| undefined` | chemin du certificat |

***

# Points d’architecture intéressants

## 1. Validation stricte

Le trio :

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

forme une configuration assez propre pour une API robuste, car elle force les payloads à respecter les DTOs et rejette les champs non attendus. Nest recommande explicitement ces options dans sa doc de validation. [docs.nest-js](https://docs.nest-js.fr/techniques/validation)

## 2. CORS configurable

Le fait d’utiliser `process.env.CORS_ORIGIN ?? "*"` permet :

- souplesse en développement,
- configuration simple en production,
- mais nécessite de bien verrouiller la variable en environnement réel. [docs.nest-js](https://docs.nest-js.fr/security/cors)

## 3. Double exposition HTTP + HTTPS

Ton code ne remplace pas HTTP par HTTPS : il garde les deux en parallèle, avec HTTPS sur `port + 1`. C’est simple à comprendre, mais ce n’est pas forcément le schéma final le plus classique en production, où l’on place souvent TLS devant l’application via reverse proxy ou load balancer. [community.letsencrypt](https://community.letsencrypt.org/t/node-js-configuration/5175)

## 4. Vérifications explicites de config

Le code échoue vite si :

- les variables TLS sont absentes,
- les fichiers certificats n’existent pas.

C’est un bon point, car ça évite les démarrages “cassés mais silencieux”.

***

# Exemple de comportement selon l’environnement

## Cas 1 : développement simple

```env
PORT=3001
CORS_ORIGIN=*
HTTPS_ENABLED=false
```

Résultat :

- API disponible sur `http://localhost:3001`

## Cas 2 : développement sécurisé / test TLS

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
HTTPS_ENABLED=true
HTTPS_KEY_FILE=./certs/key.pem
HTTPS_CERT_FILE=./certs/cert.pem
```

Résultat :

- HTTP sur `http://localhost:3001`
- HTTPS sur `https://localhost:3002`

***

# Conclusion technique du fichier

Ce `main.ts` est un bootstrap NestJS assez propre et lisible :

- création de l’application,
- sécurisation des entrées avec `ValidationPipe`,
- ouverture contrôlée du CORS,
- support HTTP seul ou HTTP + HTTPS,
- validation explicite de la configuration TLS. [docs.nestjs](https://docs.nestjs.com/techniques/validation)

***
***

# Breakdown de `app.module.ts`

## Vue d’ensemble

Ce fichier définit le **module racine** de l’application NestJS, nommé `AppModule`. Dans Nest, chaque application a au moins un module racine, et ce module sert de point de départ pour construire le graphe global des dépendances et des relations entre modules, contrôleurs et providers. [docs.nestjs](https://docs.nestjs.com/modules)

Ici, `AppModule` :

- importe les grands modules fonctionnels de l’API,
- enregistre un **interceptor global** via `APP_INTERCEPTOR`,
- sert de point d’entrée logique de toute l’application.

***

## Imports

```ts
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ScansModule } from "./modules/scans/scans.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
```

***

## `Module`

- Importé depuis `@nestjs/common`.
- `@Module()` est le décorateur utilisé pour déclarer un module NestJS.
- Nest utilise les métadonnées fournies à `@Module()` pour organiser la structure de l’application. [nestjs](https://nestjs.fr/modules/)

### Rôle

Le décorateur `@Module()` permet de définir :

- les `imports`,
- les `providers`,
- les `controllers`,
- les `exports`.

Dans ce fichier, seuls `imports` et `providers` sont utilisés. [docs.nestjs](https://docs.nestjs.com/modules)

***

## `APP_INTERCEPTOR`

- Importé depuis `@nestjs/core`.
- C’est un token spécial fourni par NestJS pour enregistrer un interceptor **global** dans le conteneur d’injection de dépendances. Les providers `APP_*` servent justement à enregistrer des enhancers globaux comme des interceptors, pipes, guards ou filters. [github](https://github.com/grammyjs/nestjs/issues/16)

### Rôle

Quand tu écris :

```ts
{
  provide: APP_INTERCEPTOR,
  useClass: AuditInterceptor,
}
```

tu dis à Nest :

- “instancie `AuditInterceptor` comme provider”,
- “et applique-le globalement à toute l’application”.

Cela évite d’ajouter `@UseInterceptors(AuditInterceptor)` sur chaque controller ou chaque route. Un `APP_INTERCEPTOR` agit globalement sur toute l’application. [docs.nestjs](https://docs.nestjs.com/interceptors)

***

## `AuthModule`

```ts
import { AuthModule } from "./modules/auth/auth.module";
```

### Rôle

- Module lié à l’authentification.
- Il contient probablement :
  - des controllers d’auth,
  - des services de login / validation,
  - des stratégies JWT ou autres mécanismes d’accès.

### Pourquoi il est importé ici

- Parce que `AppModule` agrège les grandes briques fonctionnelles de l’application.
- En important `AuthModule`, le module racine permet à Nest de l’intégrer au graphe global des modules. [nestjs](https://nestjs.fr/modules/)

***

## `DatabaseModule`

```ts
import { DatabaseModule } from "./database/database.module";
```

### Rôle

- Module chargé de la couche base de données.
- Il peut contenir :
  - connexion Prisma / TypeORM / Sequelize / autre,
  - providers liés aux repositories,
  - initialisation de la DB.

### Pourquoi il est importé

- Pour que les autres modules puissent dépendre d’une configuration DB centralisée.
- Dans Nest, un module peut encapsuler des providers et les exporter vers les autres modules. [docs.nestjs](https://docs.nestjs.com/providers)

***

## `ReportsModule`

```ts
import { ReportsModule } from "./modules/reports/reports.module";
```

### Rôle

- Module métier autour des rapports.
- Il doit probablement gérer :
  - lecture / écriture des rapports,
  - contrôleurs `/reports`,
  - logique de traitement liée aux résultats d’audit.

***

## `ScansModule`

```ts
import { ScansModule } from "./modules/scans/scans.module";
```

### Rôle

- Module métier autour des scans.
- Il contient probablement :
  - endpoints de création ou récupération de scans,
  - services métier liés à l’état des scans,
  - logique de corrélation avec les agents.

***

## `SchedulingModule`

```ts
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
```

### Rôle

- Module autour de la planification.
- Il peut gérer :
  - tâches planifiées,
  - scans programmés,
  - cron jobs,
  - orchestration temporelle.

***

## `AuditInterceptor`

```ts
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
```

### Rôle

- Interceptor personnalisé de l’application.
- Vu son nom, il sert probablement à :
  - journaliser les actions,
  - enregistrer des métadonnées d’audit,
  - suivre les requêtes/réponses,
  - tracer qui fait quoi.

### Ce qu’est un interceptor dans Nest

Les interceptors s’exécutent dans le cycle requête/réponse, entre l’entrée de la requête et la sortie de la réponse. Ils peuvent :

- intercepter l’exécution d’un handler,
- transformer la réponse,
- loguer,
- mesurer le temps d’exécution,
- faire de l’audit,
- appliquer de la logique transverse. [dev](https://dev.to/nurulislamrimon/enhancing-api-responses-with-a-global-response-interceptor-in-nestjs-124i)

***

# Le décorateur `@Module(...)`

```ts
@Module({
  imports: [DatabaseModule, AuthModule, ScansModule, ReportsModule, SchedulingModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
```

C’est le cœur du fichier.

***

## Propriété `imports`

```ts
imports: [DatabaseModule, AuthModule, ScansModule, ReportsModule, SchedulingModule]
```

### Rôle

- Déclarer les autres modules dont `AppModule` dépend directement.
- Cela permet à Nest de construire le graphe d’application, c’est-à-dire la structure qui relie les modules et leurs dépendances. Le module racine est précisément le point de départ de ce graphe. [docs.nestjs](https://docs.nestjs.com/modules)

### Ce que ça implique

En important ces modules :

- leurs controllers deviennent pris en compte,
- leurs providers peuvent être résolus selon les exports,
- leurs services peuvent être injectés dans d’autres zones du système si correctement exposés.

### Ordre logique

Ici, on voit une architecture modulaire assez propre :

- `DatabaseModule` pour l’infrastructure,
- `AuthModule` pour la sécurité,
- `ScansModule` et `ReportsModule` pour le métier principal,
- `SchedulingModule` pour l’orchestration/planification.

### Point important

Un module Nest encapsule ses providers par défaut : un provider n’est pas automatiquement accessible partout, sauf s’il est exporté puis importé ailleurs. [stackoverflow](https://stackoverflow.com/questions/75732520/nestjs-use-service-from-another-module-in-interceptor)

***

## Propriété `providers`

```ts
providers: [
  {
    provide: APP_INTERCEPTOR,
    useClass: AuditInterceptor,
  },
],
```

### Rôle

- Déclarer les providers propres à `AppModule`.
- Ici, ce n’est pas un provider métier classique, mais un **provider spécial global**.

### Décomposition de l’objet provider

#### `provide: APP_INTERCEPTOR`

- indique le token d’injection utilisé par Nest.
- ici, ce token représente “un interceptor global d’application”. [github](https://github.com/nestjs/nest/issues/4053)

#### `useClass: AuditInterceptor`

- indique quelle classe Nest doit instancier pour ce token.
- Nest va donc créer `AuditInterceptor` et l’utiliser comme interceptor global. [docs.nestjs](https://docs.nestjs.com/interceptors)

### Effet concret

Toutes les requêtes qui passent par l’application seront interceptées par `AuditInterceptor`, sans avoir besoin de le déclarer manuellement sur chaque controller ou route. Un interceptor global agit sur toute l’application. [github](https://github.com/nestjs/nest/issues/1521)

### Architecture

C’est une très bonne place pour une logique transverse, comme :

- audit,
- logs,
- mesure de performance,
- enveloppe de réponse,
- enrichissement contextuel.

***

# Classe `AppModule`

```ts
export class AppModule {}
```

### Rôle

- Définir la classe du module racine.
- Le décorateur `@Module(...)` au-dessus attache à cette classe toutes les métadonnées nécessaires.

### Pourquoi elle est vide

En Nest, la logique d’un module n’est généralement pas dans le corps de la classe elle-même, mais dans les métadonnées du décorateur `@Module`. [nestjs](https://nestjs.fr/modules/)

La classe `AppModule` sert donc surtout de support structurel pour :

- les imports,
- les providers,
- les contrôleurs éventuels,
- les exports éventuels.

***

# Ce que fait ce fichier globalement

Ce fichier dit à Nest :

1. **Voici le module racine** de l’application. [docs.nestjs](https://docs.nestjs.com/modules)
2. **Voici les modules fonctionnels** qui composent l’API :
   - base de données,
   - authentification,
   - scans,
   - rapports,
   - scheduling.  
3. **Voici un interceptor global** à appliquer à toutes les requêtes :
   - `AuditInterceptor`. [dev](https://dev.to/nurulislamrimon/enhancing-api-responses-with-a-global-response-interceptor-in-nestjs-124i)

***

# Variables / éléments importants

Même si ce fichier contient peu de “variables” au sens strict, voici les éléments structurants.

| Élément | Type logique | Rôle |
|---|---|---|
| `Module` | décorateur Nest | déclare un module |
| `APP_INTERCEPTOR` | token spécial Nest | enregistre un interceptor global |
| `AuthModule` | module Nest | gère l’authentification |
| `DatabaseModule` | module Nest | gère l’accès à la base |
| `ReportsModule` | module Nest | gère les rapports |
| `ScansModule` | module Nest | gère les scans |
| `SchedulingModule` | module Nest | gère la planification |
| `AuditInterceptor` | interceptor Nest | logique transverse d’audit |
| `AppModule` | classe module racine | point d’entrée modulaire de l’application |

***

# Lecture architecturale

## 1. Module racine

`AppModule` est le **root module**. Nest s’appuie dessus pour assembler toute l’application. [nestjs](https://nestjs.fr/modules/)

## 2. Architecture modulaire

Le projet semble découpé en domaines clairs :

- auth,
- scans,
- reports,
- scheduling,
- database.

C’est typique d’une architecture NestJS bien organisée.

## 3. Interceptor global

L’utilisation de `APP_INTERCEPTOR` montre qu’il existe une logique transverse commune à toute l’API. C’est souvent plus propre que de répéter les décorateurs route par route. [github](https://github.com/nestjs/nest/issues/4053)

## 4. Séparation infra / métier

- `DatabaseModule` = infrastructure
- `AuthModule`, `ScansModule`, `ReportsModule`, `SchedulingModule` = couches fonctionnelles / métier

C’est un bon signe de séparation des responsabilités.

***

# Exemple conceptuel du comportement

Si un client appelle :

```http
GET /scans
```

le flux logique pourrait être :

1. La requête arrive dans l’application Nest.  
2. Le module racine connaît `ScansModule`, donc les routes de ce module sont actives. [docs.nestjs](https://docs.nestjs.com/modules)
3. Avant/après le handler du controller, `AuditInterceptor` peut intercepter la requête. [oneuptime](https://oneuptime.com/blog/post/2026-02-03-nestjs-interceptors/view)
4. Le controller du module `ScansModule` exécute sa logique via ses services.  
5. Une réponse est renvoyée.

***

# Conclusion technique du fichier

`app.module.ts` est un fichier de **composition de l’application** :

- il assemble les modules principaux,
- il définit la structure racine du projet,
- il ajoute un interceptor global pour l’audit ou une logique transverse. [docs.nestjs](https://docs.nestjs.com/interceptors)

Autrement dit, ce fichier ne contient pas la logique métier, mais il dit **comment les grandes briques du projet sont branchées ensemble**.

On peut continuer pareil avec :

- `database.module.ts`,
- `auth.module.ts`,
- `audit.interceptor.ts`,
- un controller,
- un service,
- ou un DTO.
***

***

# Breakdown de `role.decorator.ts`

## Vue d’ensemble

Ce fichier définit un **décorateur personnalisé** pour attacher des rôles à une classe ou à une méthode via des métadonnées. En NestJS, les décorateurs personnalisés servent souvent à annoter les handlers avec des informations comme des rôles, puis un guard ou un interceptor lit ensuite cette metadata pour appliquer une règle de sécurité. La documentation Nest donne justement `@Roles()` comme exemple classique de décorateur d’autorisation basé sur des métadonnées. [docs.nestjs](https://docs.nestjs.com/custom-decorators)

Autrement dit, ce fichier ne fait pas lui-même le contrôle d’accès : il **déclare** les rôles requis sur une route ou une classe, et une autre pièce du système lira cette information plus tard.

***

## Import

```ts
import { Role } from "../enums/role.enum";
```

### `Role`

- `Role` est un enum défini ailleurs dans le projet.
- Il représente probablement les rôles applicatifs possibles, par exemple :
  - `ADMIN`
  - `USER`
  - `AGENT`
  - `AUDITOR`

### Rôle

- Permet de typer proprement les rôles passés au décorateur.
- Cela évite d’utiliser des chaînes arbitraires comme `"admin"` ou `"user"` partout dans le code.

### Intérêt

Utiliser un enum pour les rôles rend le code plus sûr et plus cohérent, ce qui est aussi l’approche recommandée dans les exemples d’autorisation Nest. [docs.nestjs](https://docs.nestjs.com/security/authorization)

***

# Fonction utilitaire `SetMetadata`

```ts
const SetMetadata = <K = string, V = unknown>(metadataKey: K, metadataValue: V) => {
    return (
        target: object,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor,
    ) => {
        const metadataTarget = descriptor?.value ?? target;
        (Reflect as any).defineMetadata(metadataKey, metadataValue, metadataTarget);
    };
};
```

Cette partie est le cœur technique du fichier.

***

## Vue d’ensemble de `SetMetadata`

### Rôle

- Créer une **fabrique de décorateurs**.
- Elle prend une clé de metadata et une valeur, puis retourne un décorateur qui stockera cette metadata sur la cible décorée.

C’est exactement le principe de `SetMetadata` utilisé dans NestJS pour les décorateurs personnalisés : associer une clé/valeur à une classe ou une méthode, afin qu’un guard ou un interceptor puisse la récupérer plus tard via `Reflector` ou `Reflect.getMetadata`. [shiftasia](https://shiftasia.com/community/mastering-custom-decorators-and-metadata-in-nestjs/)

***

## Signature générique

```ts
<K = string, V = unknown>(metadataKey: K, metadataValue: V)
```

### Variables / types génériques

- `K` : type de la clé de metadata.
- `V` : type de la valeur de metadata.

### Valeurs par défaut

- `K = string`
- `V = unknown`

### Rôle

- Rendre la fonction générique et typée.
- Ici, cela veut dire :
  - la clé sera généralement une string,
  - la valeur peut être n’importe quoi.

### Exemple implicite

Quand tu écris plus bas :

```ts
SetMetadata(ROLES_KEY, roles)
```

TypeScript peut comprendre :

- `K = string`
- `V = Role[]`

### Intérêt

- Flexibilité,
- typage plus propre,
- meilleure lisibilité côté IDE / autocomplétion.

***

## Paramètre `metadataKey`

```ts
metadataKey
```

### Rôle

- Nom logique de la metadata stockée.
- Ici, dans ce fichier, la clé sera `"roles"`.

### Exemple

Si `metadataKey = "roles"`, alors la metadata enregistrée est associée sous cette clé.

***

## Paramètre `metadataValue`

```ts
metadataValue
```

### Rôle

- Valeur attachée à la metadata.
- Ici, dans ton usage, ce sera un tableau de rôles comme :

```ts
["ADMIN", "USER"]
```

ou plus précisément un `Role[]`.

***

## La fonction retournée

```ts
return (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
) => {
```

### Rôle

- Retourner le **vrai décorateur**.
- En TypeScript, un décorateur est une fonction appelée avec des paramètres spéciaux selon ce qu’on décore. Nest rappelle qu’un décorateur ES/TypeScript est une expression qui retourne une fonction appliquée ensuite à une classe, méthode ou propriété. [dev](https://dev.to/tejastn10/deep-dive-into-nestjs-decorators-internals-usage-and-custom-implementations-4eha)

### Paramètres

#### `target: object`

- La cible décorée.
- Peut être :
  - le prototype de classe,
  - la classe elle-même,
  - ou autre selon le type de décorateur.

#### `propertyKey?: string | symbol`

- Nom de la méthode ou propriété décorée.
- Optionnel car il n’existe pas pour un décorateur de classe.

#### `descriptor?: PropertyDescriptor`

- Descripteur de propriété/méthode.
- Utile surtout pour un décorateur de méthode.
- Peut contenir `descriptor.value`, c’est-à-dire la fonction réelle de la méthode décorée.

***

## Variable `metadataTarget`

```ts
const metadataTarget = descriptor?.value ?? target;
```

### Variable

- `metadataTarget` : cible réelle sur laquelle la metadata va être enregistrée.

### Rôle

- Choisir où attacher la metadata :
  - si on décore une méthode → utiliser la fonction réelle (`descriptor.value`),
  - sinon → utiliser la cible elle-même (`target`).

### Décomposition

#### `descriptor?.value`

- Utilise l’optional chaining.
- Si `descriptor` existe, on lit `descriptor.value`.
- Pour une méthode, `descriptor.value` correspond généralement à la fonction de la méthode.

#### `?? target`

- Si `descriptor?.value` vaut `undefined` ou `null`, on prend `target`.

### Pourquoi c’est fait

Ce code veut gérer à la fois :

- un décorateur sur une méthode,
- un décorateur sur une classe.

### Exemple logique

#### Cas méthode

```ts
@Roles(Role.ADMIN)
getUsers() {}
```

- `descriptor` existe
- `metadataTarget = descriptor.value`

#### Cas classe

```ts
@Roles(Role.ADMIN)
@Controller("users")
export class UsersController {}
```

- `descriptor` n’existe pas
- `metadataTarget = target`

### Intérêt

- Le décorateur devient polyvalent.
- Il peut être posé soit sur une classe, soit sur une méthode.

***

## Appel à `Reflect.defineMetadata`

```ts
(Reflect as any).defineMetadata(metadataKey, metadataValue, metadataTarget);
```

### Rôle

- Enregistrer la metadata dans le système de réflexion.
- La clé est `metadataKey`,
- la valeur est `metadataValue`,
- la cible est `metadataTarget`.

La librairie `reflect-metadata` permet précisément de définir des métadonnées sur des classes, méthodes ou propriétés via `Reflect.defineMetadata(...)`. [typescriptlang](https://www.typescriptlang.org/tsconfig/emitDecoratorMetadata.html)

### Pourquoi `(Reflect as any)`

- TypeScript ne reconnaît pas toujours nativement `defineMetadata` sur `Reflect` sans typings ou configuration spécifique.
- Le cast `(Reflect as any)` contourne cette contrainte de typage.

### Ce que ça signifie

- On dit à TypeScript : “fais-moi confiance, cette méthode existe au runtime”.

### Point important

Ce code dépend du fait que `reflect-metadata` soit chargé dans l’application, ce qui est bien le cas dans ton `main.ts` avec :

```ts
import 'reflect-metadata';
```

La génération et l’usage de metadata décorateurs en TypeScript reposent bien sur `reflect-metadata` et la configuration associée. [99x](https://99x.io/Insights/blog/metadata-decorators-through-reflection)

***

# Constante `ROLES_KEY`

```ts
export const ROLES_KEY = "roles";
```

### Rôle

- Définir la clé officielle utilisée pour stocker les rôles dans la metadata.
- Le fait de la centraliser dans une constante évite les fautes de frappe.

### Intérêt

Au lieu d’écrire `"roles"` à plusieurs endroits, on utilise une constante réutilisable :

- dans le décorateur,
- dans un guard,
- dans un interceptor,
- dans n’importe quel lecteur de metadata.

### Exemple typique côté guard

Un guard Nest peut ensuite lire cette clé avec `Reflector` ou `Reflect.getMetadata(...)`. Nest documente ce schéma avec un `@Roles()` décorateur et un guard qui lit la clé `'roles'`. [nestjs](https://nestjs.fr/security/authorization/)

***

# Décorateur `Roles`

```ts
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

C’est la partie publique réellement utilisée dans le reste du projet.

***

## Signature

### Paramètre

- `...roles: Role[]`

### Rôle

- Accepter un nombre variable de rôles.
- Grâce au rest parameter `...roles`, tu peux écrire :

```ts
@Roles(Role.ADMIN)
```

ou :

```ts
@Roles(Role.ADMIN, Role.AUDITOR)
```

### Type

- `Role[]` : tableau de rôles issus de l’enum `Role`.

***

## Ce que retourne `Roles`

```ts
SetMetadata(ROLES_KEY, roles)
```

### Rôle

- Créer un décorateur configuré avec :
  - clé = `"roles"`
  - valeur = tableau de rôles transmis

### Résultat

`Roles(...)` retourne donc un décorateur applicable à une classe ou une méthode.

### Traduction conceptuelle

Quand tu écris :

```ts
@Roles(Role.ADMIN, Role.USER)
```

cela veut dire :

> “Attache à cette cible une metadata avec la clé `roles` et la valeur `[Role.ADMIN, Role.USER]`”.

***

# Exemple d’utilisation

## Sur une méthode

```ts
@Get()
@Roles(Role.ADMIN)
findAll() {
  return this.usersService.findAll();
}
```

### Signification

- Cette route nécessite le rôle `ADMIN`.
- Le décorateur ne bloque rien à lui seul.
- Il ajoute juste la metadata.

Ensuite, un guard vient lire cette information et décider s’il autorise ou non la requête. C’est le schéma standard d’autorisation par rôles dans NestJS. [shiftasia](https://shiftasia.com/community/mastering-custom-decorators-and-metadata-in-nestjs/)

***

## Sur une classe

```ts
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {}
```

### Signification

- Toutes les routes de ce controller peuvent hériter de cette contrainte de rôle.
- Là encore, c’est la lecture ultérieure de la metadata qui applique réellement la règle.

***

# Ce que fait ce fichier, concrètement

Ce fichier ne fait **pas** :

- l’authentification,
- la lecture du token,
- la comparaison entre utilisateur et rôles,
- le blocage HTTP.

Ce fichier fait seulement ceci :

1. définir une clé de metadata : `"roles"`,
2. définir une fabrique de décorateurs,
3. exposer un décorateur `@Roles(...)`,
4. enregistrer les rôles demandés sur une classe ou une méthode via `Reflect.defineMetadata(...)`. [docs.nestjs](https://docs.nestjs.com/fundamentals/execution-context)

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `Role` | enum | liste typée des rôles possibles |
| `SetMetadata` | fonction générique | fabrique un décorateur qui stocke une metadata |
| `metadataKey` | clé de metadata | nom sous lequel la donnée est stockée |
| `metadataValue` | valeur de metadata | contenu attaché à la cible |
| `target` | cible du décorateur | classe ou prototype/méthode décorée |
| `propertyKey` | nom de membre | méthode ou propriété décorée |
| `descriptor` | descripteur | accès à la fonction réelle d’une méthode |
| `metadataTarget` | cible effective | objet réellement annoté par la metadata |
| `ROLES_KEY` | constante string | clé officielle `"roles"` |
| `Roles` | décorateur personnalisé | attache une liste de rôles à une route/classe |

***

# Lecture architecturale

## 1. Décorateur déclaratif

Le code adopte une approche **déclarative** : on écrit la politique d’accès directement à côté de la route ou du controller.

Exemple :

```ts
@Roles(Role.ADMIN)
```

plutôt que de coder la logique d’autorisation manuellement dans chaque méthode.

C’est exactement l’intérêt des décorateurs personnalisés et metadata dans NestJS. [docs.nestjs](https://docs.nestjs.com/custom-decorators)

## 2. Séparation des responsabilités

Ce fichier s’occupe seulement de **déclarer** les rôles.  
Un autre composant devra **lire** les rôles et décider :

- utilisateur autorisé,
- ou refusé.

Typiquement, ce sera un `RolesGuard` ou un guard équivalent. Nest documente cette séparation entre décorateur `@Roles()` et guard d’autorisation. [docs.nestjs](https://docs.nestjs.com/security/authorization)

## 3. Métadonnées runtime

Le choix de `Reflect.defineMetadata(...)` signifie que l’application repose sur de la metadata runtime, ce qui est très cohérent avec la philosophie NestJS fondée sur décorateurs + réflexion. [typescriptlang](https://www.typescriptlang.org/tsconfig/emitDecoratorMetadata.html)

***

# Traduction simple pour débutant

Si on simplifie au maximum, ce fichier permet d’écrire :

```ts
@Roles(Role.ADMIN)
```

et ça veut dire :

> “colle une étiquette `roles = [ADMIN]` sur cette route”.

Plus tard, un guard lira cette étiquette et dira :

- “oui, l’utilisateur a le bon rôle”,
- ou “non, accès refusé”.

***

# Exemple mental complet

```ts
@Get("admin")
@Roles(Role.ADMIN)
getAdminData() {
  return "secret";
}
```

### Ce que fait le décorateur

- Il n’exécute pas de vérification d’accès.
- Il stocke juste :

```ts
roles = [Role.ADMIN]
```

sur la méthode `getAdminData`.

### Ce qu’un guard ferait ensuite

- lire la metadata `roles`,
- récupérer l’utilisateur courant,
- vérifier si cet utilisateur possède `Role.ADMIN`,
- autoriser ou refuser l’accès. [nestjs](https://nestjs.fr/security/authorization/)

***

# Conclusion technique du fichier

`role.decorator.ts` est un fichier d’**annotation de sécurité** :

- il définit une clé de metadata `ROLES_KEY`,
- il expose un décorateur `@Roles(...)`,
- il stocke les rôles requis sur une classe ou une méthode via `Reflect.defineMetadata(...)`. [99x](https://99x.io/Insights/blog/metadata-decorators-through-reflection)

C’est une brique classique de RBAC dans NestJS :  
**décorateur pour déclarer**, **guard pour appliquer**.

On peut continuer exactement pareil avec :

- `role.enum.ts`,
- un `roles.guard.ts`,
- `auth.guard.ts`,
- `jwt.strategy.ts`,
- ou un controller/service API.
***
Parfait — on continue avec le même format.

***

# Breakdown de `role.enum.ts`

## Vue d’ensemble

Ce fichier définit un **enum TypeScript** nommé `Role`, qui représente l’ensemble des rôles autorisés dans ton application. Un enum sert à définir un ensemble limité de constantes nommées, et les **string enums** sont souvent choisies car elles sont plus lisibles au runtime et dans les logs. [typescriptlang](https://www.typescriptlang.org/docs/handbook/enums.html)

Dans ton projet, cet enum sert très probablement de base au système d’autorisation RBAC, avec le décorateur `@Roles(...)` et un guard qui compare le rôle de l’utilisateur aux rôles autorisés pour une route. C’est justement le pattern présenté dans les exemples d’autorisation NestJS. [imzihad21.github](https://imzihad21.github.io/articles/a/custom-role-based-access-control-in-nestjs-using-custom-guards-jol/)

***

## Le code

```ts
export enum Role {
  ADMIN = "admin",
  VIEWER = "viewer",
  AGENT = "agent"
}
```

***

## `export`

### Rôle

- Rend l’enum accessible depuis les autres fichiers du projet.
- Sans `export`, `Role` resterait local à ce fichier.

### Exemple

Grâce à `export`, tu peux écrire ailleurs :

```ts
import { Role } from "../enums/role.enum";
```

C’est ce que tu fais justement dans `role.decorator.ts`.

***

## `enum`

### Rôle

- `enum` est un mot-clé TypeScript qui permet de définir un ensemble de constantes nommées.
- Un enum est utile quand tu veux limiter une valeur à une liste fermée de possibilités connues. [w3schools](https://www.w3schools.com/typescript/typescript_enums.php)

### Pourquoi c’est utile ici

Au lieu d’écrire partout :

```ts
"admin"
"viewer"
"agent"
```

tu écris :

```ts
Role.ADMIN
Role.VIEWER
Role.AGENT
```

Cela évite :

- les fautes de frappe,
- les valeurs incohérentes,
- les chaînes magiques dispersées dans le code.

***

## Nom de l’enum : `Role`

```ts
export enum Role
```

### Rôle

- `Role` est le nom du type.
- Il décrit le concept métier représenté : le rôle d’un utilisateur ou d’un agent dans le système.

### Intérêt

Le nom est simple et clair.  
Quand tu lis :

```ts
roles: Role[]
```

tu comprends immédiatement qu’il s’agit d’une liste de rôles valides du système.

***

# Membres de l’enum

Chaque ligne définit une constante de l’enum.

***

## `ADMIN = "admin"`

```ts
ADMIN = "admin"
```

### Rôle

- Définit un membre nommé `ADMIN`.
- Sa valeur réelle au runtime est la chaîne `"admin"`.

### Sens métier probable

Ce rôle correspond très probablement à un utilisateur ayant des privilèges élevés, par exemple :

- gestion complète des scans,
- accès aux rapports,
- planification,
- administration générale de l’application.

### Intérêt de la valeur string

Au runtime, `Role.ADMIN` vaut `"admin"`, ce qui est lisible dans :

- les logs,
- les tokens,
- la base de données,
- les réponses JSON.

Les string enums sont justement appréciées pour leur lisibilité par rapport aux enums numériques. [blog.logrocket](https://blog.logrocket.com/typescript-string-enums-guide/)

***

## `VIEWER = "viewer"`

```ts
VIEWER = "viewer"
```

### Rôle

- Définit le rôle `VIEWER`.
- Valeur réelle : `"viewer"`.

### Sens métier probable

Ce rôle correspond en général à un utilisateur avec des droits de lecture uniquement, par exemple :

- consulter les scans,
- voir les rapports,
- sans pouvoir modifier ou déclencher des opérations sensibles.

### Intérêt

Cela permet de distinguer les comptes “lecture seule” des comptes plus puissants comme `ADMIN`.

***

## `AGENT = "agent"`

```ts
AGENT = "agent"
```

### Rôle

- Définit le rôle `AGENT`.
- Valeur réelle : `"agent"`.

### Sens métier probable

Dans ton projet, ce rôle semble particulièrement important, car vous avez un agent Go qui communique avec l’API. Il est donc très plausible que `AGENT` représente :

- un agent technique,
- un client machine-to-machine,
- un composant chargé de récupérer ou envoyer des scans.

### Intérêt

Cela permet de distinguer :

- les utilisateurs humains (`ADMIN`, `VIEWER`),
- et les agents automatisés (`AGENT`).

***

# Pourquoi c’est un **string enum**

Ton enum est de cette forme :

```ts
export enum Role {
  ADMIN = "admin",
  VIEWER = "viewer",
  AGENT = "agent"
}
```

On appelle ça un **string enum**, car chaque membre reçoit une chaîne explicite. TypeScript recommande cette approche quand la lisibilité du runtime est importante. [typescriptlang](https://www.typescriptlang.org/play/typescript/language-extensions/enums.ts.html)

### Avantages

- lisible dans les logs,
- lisible dans les JWT / payloads,
- facile à stocker en base,
- facile à comparer avec des valeurs venant d’un client ou d’une requête.

### Comparaison avec un enum numérique

Un enum numérique aurait ressemblé à :

```ts
enum Role {
  ADMIN,
  VIEWER,
  AGENT
}
```

et les valeurs seraient devenues `0`, `1`, `2`, ce qui est moins clair à relire ou à déboguer. Les docs TypeScript notent bien que les string enums sont plus lisibles au runtime. [typescriptlang](https://www.typescriptlang.org/docs/handbook/enums.html)

***

# Comment on l’utilise

## 1. Dans le décorateur `@Roles(...)`

```ts
@Roles(Role.ADMIN)
```

### Rôle

- Déclarer qu’une route nécessite le rôle `ADMIN`.
- Ici, `Role.ADMIN` vaut `"admin"` au runtime.

Ton décorateur précédent est justement typé avec `Role[]`, ce qui garantit que seuls les rôles valides de l’enum peuvent être passés. [dev](https://dev.to/luffy_p1r4t3/role-based-access-control-in-nestjs-2cl2)

***

## 2. Dans un utilisateur ou un payload JWT

Exemple possible :

```ts
type AuthUser = {
  id: string;
  role: Role;
};
```

### Rôle

- Restreindre la propriété `role` aux seules valeurs définies dans l’enum.
- Empêche des valeurs invalides comme `"superadmin"` si ce rôle n’existe pas.

***

## 3. Dans un guard

Exemple conceptuel :

```ts
if (user.role === Role.ADMIN) {
  return true;
}
```

### Rôle

- Comparer le rôle courant à un rôle officiel du système.
- Plus sûr que comparer à une string tapée à la main.

***

# Ce que ce fichier apporte au projet

Ce petit fichier apporte en réalité plusieurs bénéfices importants.

## 1. Source unique de vérité

Tous les rôles sont centralisés à un seul endroit.  
Si tu ajoutes un rôle plus tard, tu sais où le déclarer.

## 2. Typage fort

TypeScript peut empêcher des usages invalides.

Exemple :

```ts
const role: Role = "administrator";
```

Cela devrait être refusé si `"administrator"` n’est pas une valeur de l’enum.

## 3. Cohérence entre auth et autorisation

L’enum peut être réutilisé dans :

- les DTOs,
- les guards,
- les decorators,
- les services,
- les entités DB,
- les JWT payloads.

## 4. Lisibilité métier

`Role.ADMIN` est plus explicite que `"admin"` dispersé dans tout le code.

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `Role` | enum TypeScript | type fermé représentant les rôles possibles |
| `ADMIN` | membre d’enum | rôle administrateur |
| `VIEWER` | membre d’enum | rôle lecture seule |
| `AGENT` | membre d’enum | rôle technique / agent automatisé |
| `"admin"` | valeur runtime | string réellement stockée / comparée |
| `"viewer"` | valeur runtime | string réellement stockée / comparée |
| `"agent"` | valeur runtime | string réellement stockée / comparée |

***

# Lecture simple pour débutant

Tu peux voir cet enum comme une **liste officielle de rôles autorisés**.

Au lieu de dire :

```ts
le rôle peut être n’importe quelle string
```

tu dis :

```ts
le rôle doit être l’un de ceux-ci :
- admin
- viewer
- agent
```

Et tu y accèdes proprement avec :

```ts
Role.ADMIN
Role.VIEWER
Role.AGENT
```

***

# Exemple concret

```ts
function canManageScans(role: Role): boolean {
  return role === Role.ADMIN;
}
```

### Lecture

- la fonction prend un rôle valide,
- elle renvoie `true` seulement si ce rôle est `ADMIN`.

Appels possibles :

```ts
canManageScans(Role.ADMIN)  // true
canManageScans(Role.VIEWER) // false
canManageScans(Role.AGENT)  // false
```

***

# Place dans l’architecture globale

Avec ce qu’on a déjà vu :

- `role.enum.ts` définit les rôles possibles,
- `role.decorator.ts` permet d’annoter les routes avec ces rôles,
- un futur `roles.guard.ts` lira cette metadata et comparera avec le rôle réel de l’utilisateur. [docs.nestjs](https://docs.nestjs.com/security/authorization)

Donc ce fichier est la **brique de base** du système RBAC.

***

# Conclusion technique du fichier

`role.enum.ts` définit un **enum TypeScript de rôles** :

- `ADMIN`
- `VIEWER`
- `AGENT`

avec des valeurs runtime lisibles :

- `"admin"`
- `"viewer"`
- `"agent"`.

C’est une manière propre, typée et maintenable de représenter les rôles dans une application NestJS/TypeScript, en particulier dans un système d’autorisation basé sur décorateurs + guards. [blog.logrocket](https://blog.logrocket.com/typescript-string-enums-guide/)
***
Parfait — on continue avec le **même format détaillé**.  
Voici le breakdown de `basic-auth.guard.ts`.

***

# Breakdown de `basic-auth.guard.ts`

## Vue d’ensemble

Ce fichier définit un **guard NestJS** chargé d’authentifier les requêtes à partir d’un token Bearer simple envoyé dans l’en-tête `Authorization`. Dans Nest, un guard implémente l’interface `CanActivate` et décide si une requête peut atteindre le handler de route ou doit être bloquée. [docs.nestjs](https://docs.nestjs.com/guards)

Ici, le guard :

- lit l’en-tête `Authorization`,
- vérifie le format `Bearer <token>`,
- compare le token à trois secrets configurés par variables d’environnement,
- attache un utilisateur simplifié à `req.user`,
- ou lève une `UnauthorizedException` si l’authentification échoue. Les guards Nest peuvent justement lever une `UnauthorizedException` pour refuser l’accès. [github](https://github.com/nestjs/nest/issues/1936)

***

## Imports

```ts
import { Request } from "express";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Role } from "../enums/role.enum";
import { RequestWithUser } from "../types/request-with-user";
```

***

## `Request`

- Importé depuis `express`.
- Représente l’objet requête HTTP Express.
- Même si ce fichier utilise ensuite surtout `RequestWithUser`, cet import montre qu’on est dans un contexte HTTP Express/Nest.

### Rôle

- Typage de la requête HTTP côté backend.
- Permet de manipuler les headers, body, query, etc.

***

## `CanActivate`

- Importé depuis `@nestjs/common`.
- Interface que doit implémenter un guard NestJS.
- Un guard possède une méthode `canActivate()` qui renvoie en général un `boolean`, `Promise<boolean>` ou `Observable<boolean>`. Les guards servent précisément à décider si une requête sera traitée ou bloquée. [dev](https://dev.to/brngranado/how-to-implement-authentication-with-nestjs-using-guards-in-3-easy-steps-24je)

### Rôle

- Définir le contrat d’un guard.
- Ici, `BasicAuthGuard` l’implémente.

***

## `ExecutionContext`

- Importé depuis `@nestjs/common`.
- Représente le contexte d’exécution courant.
- Permet d’accéder à la requête HTTP, la réponse, et d’autres infos d’exécution.

Nest documente `ExecutionContext` comme le moyen standard de récupérer le contexte courant dans guards, interceptors et autres mécanismes transverses. [josuedev.hashnode](https://josuedev.hashnode.dev/mastering-guards-in-nestjs-handling-authorisation-and-request-control)

### Rôle

- Accéder à la requête HTTP actuelle dans `canActivate()`.
- Ici, il sert à faire :

```ts
context.switchToHttp().getRequest<RequestWithUser>()
```

***

## `Injectable`

- Importé depuis `@nestjs/common`.
- Décorateur NestJS qui déclare une classe comme injectable dans le conteneur DI.
- Les guards personnalisés sont généralement marqués `@Injectable()`. [digitalocean](https://www.digitalocean.com/community/tutorials/understanding-guards-in-nestjs)

### Rôle

- Permettre à Nest de gérer le guard comme provider.
- Indispensable si le guard doit être injecté / instancié par Nest.

***

## `UnauthorizedException`

- Importé depuis `@nestjs/common`.
- Exception HTTP qui correspond à une erreur 401 Unauthorized.
- Utilisée quand la requête n’est pas authentifiée ou que le token est invalide. Lever `UnauthorizedException` dans un guard est un pattern courant. [docs.nestjs](https://docs.nestjs.com/guards)

### Rôle

- Couper immédiatement la requête avec une réponse HTTP 401.
- Fournir un message d’erreur explicite.

***

## `Role`

```ts
import { Role } from "../enums/role.enum";
```

### Rôle

- Enum des rôles applicatifs.
- Ici, le guard attribue un rôle à l’utilisateur authentifié :
  - `Role.ADMIN`
  - `Role.VIEWER`
  - `Role.AGENT`

***

## `RequestWithUser`

```ts
import { RequestWithUser } from "../types/request-with-user";
```

### Rôle

- Type personnalisé de requête HTTP.
- Il étend probablement la requête Express classique avec une propriété `user`.

### Pourquoi c’est utile

Dans Express/Nest, `req.user` n’est pas toujours typé par défaut. Une approche classique consiste soit à étendre l’interface `Request`, soit à créer un type personnalisé comme `RequestWithUser`. [darraghoriordan](https://www.darraghoriordan.com/2023/08/14/custom-request-response-express-typescript)

### Intérêt

- Éviter les casts sauvages,
- permettre à TypeScript de comprendre que `req.user` existe,
- avoir un typage propre pour la suite de la chaîne de traitement.

***

# Décorateur `@Injectable()`

```ts
@Injectable()
```

### Rôle

- Indiquer à Nest que `BasicAuthGuard` est une classe injectable.
- Cela permet à Nest de l’utiliser via `@UseGuards(BasicAuthGuard)` ou comme guard global/module-level.

### Intérêt

Sans `@Injectable()`, Nest pourrait ne pas gérer correctement la classe dans son conteneur de dépendances. Les guards Nest sont bien des providers. [dev](https://dev.to/brngranado/how-to-implement-authentication-with-nestjs-using-guards-in-3-easy-steps-24je)

***

# Classe `BasicAuthGuard`

```ts
export class BasicAuthGuard implements CanActivate {
```

### Rôle

- Définir le guard d’authentification.
- La classe implémente `CanActivate`, donc elle doit fournir une méthode `canActivate()`.

### Ce que ça veut dire

Cette classe est appelée avant l’exécution du handler de route. Si `canActivate()` renvoie `true`, la requête continue; sinon elle est bloquée ou une exception est levée. [digitalocean](https://www.digitalocean.com/community/tutorials/understanding-guards-in-nestjs)

***

# Méthode `canActivate`

```ts
canActivate(context: ExecutionContext): boolean {
```

### Paramètre

- `context` (`ExecutionContext`) : contexte d’exécution de la requête en cours.

### Type de retour

- `boolean` : ici, le guard fonctionne de manière synchrone.
- Il renvoie `true` quand l’accès est autorisé.
- Sinon, il lève une exception.

### Rôle global

- Vérifier la présence du header Authorization,
- vérifier son format,
- valider le token contre les tokens attendus,
- attacher l’utilisateur à la requête,
- autoriser ou refuser l’accès.

***

## Récupération de la requête

```ts
const req = context.switchToHttp().getRequest<RequestWithUser>();
```

### Variable

- `req` : requête HTTP courante, typée comme `RequestWithUser`.

### Rôle

- Basculer le contexte Nest vers le contexte HTTP.
- Récupérer la requête Express réelle.

### Détail

#### `context.switchToHttp()`

- Indique qu’on travaille dans un transport HTTP.
- `ExecutionContext` peut théoriquement être utilisé avec d’autres transports, mais ici on veut la requête HTTP. [docs.nestjs](https://docs.nestjs.com/fundamentals/execution-context)

#### `.getRequest<RequestWithUser>()`

- Récupère l’objet request.
- Le générique `<RequestWithUser>` précise le type attendu.

### Intérêt

- Accéder aux headers.
- Plus tard, ajouter `req.user`.

***

## Lecture du header Authorization

```ts
const authHeader = req.headers.authorization;
```

### Variable

- `authHeader` : contenu brut du header `Authorization`.

### Rôle

- Lire la valeur envoyée par le client.

### Exemple attendu

```http
Authorization: Bearer abc123
```

Alors :

```ts
authHeader === "Bearer abc123"
```

Les schémas Bearer dans le header `Authorization` sont la manière standard d’envoyer un token côté HTTP, y compris dans les exemples Nest d’authentification. [codesignal](https://codesignal.com/learn/courses/securing-your-nestjs-app/lessons/securing-endpoints-with-jwt-guards)

***

## Vérification de présence du header

```ts
if (!authHeader) {
  throw new UnauthorizedException("Authorization header is required");
}
```

### Rôle

- Refuser immédiatement les requêtes sans header d’authentification.

### Comportement

Si le header n’existe pas :

- la méthode ne continue pas,
- elle lève une `UnauthorizedException`,
- Nest renverra une réponse HTTP 401. [github](https://github.com/nestjs/nest/issues/1936)

### Intérêt

- Éviter de parser une valeur inexistante.
- Donner un message explicite au client.

***

## Découpage du header

```ts
const [scheme, token] = authHeader.split(" ");
```

### Variables

- `scheme` : partie avant l’espace, ex. `"Bearer"`
- `token` : partie après l’espace, ex. `"abc123"`

### Rôle

- Séparer le type de schéma d’authentification et la valeur du token.

### Exemple

Si :

```ts
authHeader = "Bearer abc123"
```

alors :

- `scheme = "Bearer"`
- `token = "abc123"`

***

## Vérification du format Bearer

```ts
if (scheme !== "Bearer" || !token) {
  throw new UnauthorizedException("Use Bearer token");
}
```

### Rôle

- Vérifier que le client utilise bien le schéma attendu.
- Refuser tout autre format.

### Condition

- `scheme !== "Bearer"` : mauvais préfixe
- `!token` : pas de token après l’espace

### Exemple rejeté

- `"Basic abc123"`
- `"Bearer"`
- `"abc123"`

### Résultat

- Si le format n’est pas correct, réponse 401 avec message `"Use Bearer token"`.

***

## Lecture des tokens attendus

```ts
const adminToken = process.env.ADMIN_TOKEN ?? "admin-dev-token";
const viewerToken = process.env.VIEWER_TOKEN ?? "viewer-dev-token";
const agentToken = process.env.AGENT_TOKEN ?? "agent-dev-token";
```

### Variables

- `adminToken` : token accepté pour le rôle admin
- `viewerToken` : token accepté pour le rôle viewer
- `agentToken` : token accepté pour le rôle agent

### Rôle

- Lire les secrets d’authentification depuis les variables d’environnement.
- Si une variable est absente, utiliser une valeur par défaut de développement.

### Détail

#### `process.env.ADMIN_TOKEN`

- Variable d’environnement éventuelle contenant le token admin.

#### `?? "admin-dev-token"`

- Si la variable n’existe pas, valeur de fallback.

### Intérêt

- Simplifier le développement local.
- Permettre une configuration sans code en production.

### Point de sécurité

Ces valeurs par défaut sont pratiques en dev, mais elles sont **dangereuses** si elles restent actives en production. Toute personne connaissant ces valeurs pourrait s’authentifier si les variables d’environnement ne sont pas correctement configurées. Les exemples de tokens statiques existent pour des cas simples, mais ils sont bien moins robustes qu’un vrai JWT ou qu’une vérification serveur persistante. [stackoverflow](https://stackoverflow.com/questions/72351040/how-can-i-add-token-authentication-to-my-nestjs-app)

***

## Vérification du token admin

```ts
if (token === adminToken) {
  req.user = { role: Role.ADMIN, subject: "admin" };
  return true;
}
```

### Rôle

- Si le token reçu correspond au token admin configuré :
  - considérer la requête comme authentifiée,
  - injecter un utilisateur simplifié dans `req.user`,
  - autoriser l’accès.

### Variable ajoutée

- `req.user`

### Valeur affectée

```ts
{
  role: Role.ADMIN,
  subject: "admin"
}
```

### Interprétation

- `role: Role.ADMIN` : l’utilisateur courant a le rôle admin
- `subject: "admin"` : identifiant logique / sujet de l’authentification

### Intérêt

La suite du pipeline peut ensuite utiliser `req.user` dans :

- un guard de rôles,
- un interceptor d’audit,
- un controller,
- un service.

L’idée d’attacher l’utilisateur authentifié à la requête est justement un pattern classique dans les systèmes d’auth HTTP/Nest. [dev](https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5)

***

## Vérification du token viewer

```ts
if (token === viewerToken) {
  req.user = { role: Role.VIEWER, subject: "viewer" };
  return true;
}
```

### Rôle

- Même logique que pour admin.
- Si le token correspond au token viewer :
  - on attache un utilisateur viewer,
  - on autorise la requête.

### Valeur de `req.user`

```ts
{
  role: Role.VIEWER,
  subject: "viewer"
}
```

***

## Vérification du token agent

```ts
if (token === agentToken) {
  req.user = { role: Role.AGENT, subject: "agent" };
  return true;
}
```

### Rôle

- Même logique pour l’agent automatisé.
- Si le token correspond :
  - on attache un utilisateur rôle `AGENT`,
  - on autorise.

### Importance dans ton projet

Vu l’existence d’un agent Go qui parle à l’API, ce rôle `AGENT` semble destiné à l’authentification machine-to-machine.

***

## Refus final

```ts
throw new UnauthorizedException("Invalid token");
```

### Rôle

- Si aucun des tokens connus ne correspond, refuser l’accès.

### Effet

- Réponse HTTP 401,
- message `"Invalid token"`.

### Logique globale

À ce stade, toutes les possibilités valides ont déjà été testées.  
Donc si on arrive ici, le token est forcément invalide.

***

# Flux complet de la méthode

Voici la logique complète de `canActivate()` :

1. Récupérer la requête HTTP depuis `ExecutionContext`. [josuedev.hashnode](https://josuedev.hashnode.dev/mastering-guards-in-nestjs-handling-authorisation-and-request-control)
2. Lire le header `Authorization`.  
3. Vérifier qu’il existe, sinon 401.  
4. Le découper en `scheme` + `token`.  
5. Vérifier le format `Bearer <token>`, sinon 401.  
6. Lire les trois tokens de référence depuis l’environnement, avec fallback dev.  
7. Comparer le token :
   - si token admin → `req.user = { role: ADMIN, subject: "admin" }`
   - si token viewer → `req.user = { role: VIEWER, subject: "viewer" }`
   - si token agent → `req.user = { role: AGENT, subject: "agent" }`
8. Si un cas correspond → `return true`.  
9. Sinon → 401 `"Invalid token"`.

***

# Ce que contient `req.user`

Même si le type exact vient de `RequestWithUser`, on voit qu’ici la structure minimale est :

```ts
{
  role: Role;
  subject: string;
}
```

### Rôle de `role`

- Sert à l’autorisation (RBAC),
- peut être relu par un `RolesGuard`.

### Rôle de `subject`

- Identifiant logique du principal authentifié.
- Ici, ce n’est pas un vrai user ID, mais une valeur symbolique :
  - `"admin"`
  - `"viewer"`
  - `"agent"`

Dans un système plus avancé, `subject` serait souvent l’équivalent d’un `sub` JWT ou d’un identifiant utilisateur. [nestjs](https://nestjs.fr/security/authentication/)

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `BasicAuthGuard` | guard Nest | contrôle l’accès par token Bearer simple |
| `canActivate` | méthode principale | décide si la requête est autorisée |
| `context` | `ExecutionContext` | donne accès au contexte HTTP courant |
| `req` | `RequestWithUser` | requête HTTP enrichie avec `user` |
| `authHeader` | `string \| undefined` | contenu du header Authorization |
| `scheme` | `string` | schéma d’auth, attendu = `"Bearer"` |
| `token` | `string` | token envoyé par le client |
| `adminToken` | `string` | token attendu pour l’admin |
| `viewerToken` | `string` | token attendu pour le viewer |
| `agentToken` | `string` | token attendu pour l’agent |
| `req.user` | objet user simplifié | principal authentifié injecté dans la requête |
| `UnauthorizedException` | exception HTTP | déclenche une réponse 401 |

***

# Lecture architecturale

## 1. Authentification simple par token statique

Le système ici n’est pas un vrai Basic Auth malgré le nom du fichier.  
C’est plutôt une **authentification Bearer à tokens statiques**.

Le nom `basic-auth.guard.ts` peut donc être un peu trompeur, car le code ne gère pas le schéma HTTP `Basic`, il gère `Bearer`. Le schéma Bearer est bien celui utilisé pour transmettre un jeton dans l’en-tête Authorization. [codesignal](https://codesignal.com/learn/courses/securing-your-nestjs-app/lessons/securing-endpoints-with-jwt-guards)

## 2. Authentification et autorisation séparées

Ce guard ne vérifie que :

- “qui es-tu ?” ou plutôt “quel token présentes-tu ?”

Il ne vérifie pas encore :

- “as-tu le droit d’appeler cette route ?”

Cette séparation est propre :

- `BasicAuthGuard` → authentifie,
- `RolesGuard` éventuel → autorise selon `req.user.role` + metadata `@Roles(...)`. [docs.nestjs](https://docs.nestjs.com/security/authorization)

## 3. Architecture adaptée à un environnement interne

Pour une API interne ou un prototype, ce système peut suffire :

- très simple,
- zéro dépendance JWT,
- pas de base de données nécessaire pour l’auth.

Mais pour un système exposé publiquement, ce serait limité par rapport à une vraie auth signée, expirante, rotative, etc. [stackoverflow](https://stackoverflow.com/questions/72351040/how-can-i-add-token-authentication-to-my-nestjs-app)

***

# Exemple de comportement

## Cas 1 : token admin valide

```http
Authorization: Bearer admin-dev-token
```

Si `ADMIN_TOKEN` n’est pas défini :

- le token matche la fallback value,
- `req.user = { role: Role.ADMIN, subject: "admin" }`,
- accès autorisé.

## Cas 2 : header absent

Aucun header `Authorization`.

Résultat :

- exception 401,
- message `"Authorization header is required"`.

## Cas 3 : mauvais schéma

```http
Authorization: Basic abc123
```

Résultat :

- exception 401,
- message `"Use Bearer token"`.

## Cas 4 : token inconnu

```http
Authorization: Bearer nope
```

Résultat :

- exception 401,
- message `"Invalid token"`.

***

# Conclusion technique du fichier

`basic-auth.guard.ts` définit un guard NestJS d’**authentification Bearer simple** :

- il lit le header `Authorization`,
- impose le format `Bearer <token>`,
- compare le token à trois valeurs configurables par environnement,
- attache un utilisateur minimal à `req.user`,
- ou renvoie une `UnauthorizedException` en cas d’échec. [nestjs](https://nestjs.fr/security/authentication/)

C’est une solution très simple, adaptée à un environnement contrôlé ou à une API interne, et conçue pour s’intégrer ensuite avec un système de rôles basé sur `Role` + `@Roles(...)`.
***
Parfait — voici le breakdown de `role.guard.ts` dans **le même format détaillé**.

***

# Breakdown de `role.guard.ts`

## Vue d’ensemble

Ce fichier définit un **guard d’autorisation par rôles** pour NestJS. Son rôle n’est pas d’authentifier l’utilisateur, mais de vérifier si l’utilisateur déjà authentifié possède l’un des rôles requis par la route ou le controller. Dans Nest, les guards servent justement à décider si une requête peut atteindre le handler, et la documentation d’autorisation montre un pattern classique basé sur `@Roles(...)`, `Reflector` et un `RolesGuard`. [docs.nestjs](https://docs.nestjs.com/security/authorization)

Autrement dit :

- `BasicAuthGuard` répond à “qui es-tu ?”,
- `RolesGuard` répond à “as-tu le droit ?”. [stackoverflow](https://stackoverflow.com/questions/57932498/nestjs-rolesguard-not-working-as-expected)

***

## Imports

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../enums/role.enum";
import { RequestWithUser } from "../types/request-with-user";
```

***

## `CanActivate`

- Interface NestJS que doit implémenter un guard.
- Elle impose une méthode `canActivate(...)` qui décide si l’accès est autorisé. [docs.nestjs](https://docs.nestjs.com/guards)

### Rôle

- Définir le contrat du guard.
- Ici, `RolesGuard` est un guard de contrôle d’accès.

***

## `ExecutionContext`

- Représente le contexte d’exécution courant.
- Sert à accéder au handler, à la classe, et à la requête HTTP. [docs.nestjs](https://docs.nestjs.com/fundamentals/execution-context)

### Rôle

Dans ce fichier, il sert à :

- récupérer la metadata de la route et du controller,
- récupérer la requête courante.

***

## `ForbiddenException`

- Exception HTTP Nest correspondant à une erreur 403 Forbidden.
- Utilisée quand l’utilisateur est authentifié, mais n’a pas les permissions nécessaires.

### Différence avec `UnauthorizedException`

- `401 Unauthorized` : problème d’authentification, identité absente/invalide
- `403 Forbidden` : identité connue, mais accès refusé

C’est exactement la bonne exception pour un contrôle de rôle échoué. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-nestjs-guards-authorization/view)

***

## `Injectable`

- Décorateur NestJS indiquant que la classe peut être gérée par le conteneur d’injection de dépendances.
- Indispensable ici parce que le guard dépend d’un `Reflector`. [stackoverflow](https://stackoverflow.com/questions/77814872/nestjs-reflector-not-injected-in-custom-guard)

***

## `Reflector`

- Importé depuis `@nestjs/core`.
- Outil NestJS utilisé pour lire la metadata attachée par des décorateurs personnalisés comme `@Roles(...)`. [docs.nest-js](https://docs.nest-js.fr/fundamentals/execution-context)

### Rôle

Il permet ici de récupérer les rôles requis associés :

- soit à la méthode,
- soit à la classe.

C’est le mécanisme standard montré par Nest pour relier décorateurs et guards. [docs.nestjs](https://docs.nestjs.com/fundamentals/execution-context)

***

## `ROLES_KEY`

```ts
import { ROLES_KEY } from "../decorators/roles.decorator";
```

### Rôle

- Constante contenant la clé de metadata `"roles"`.
- Sert à lire exactement la même clé que celle utilisée dans le décorateur `@Roles(...)`.

### Importance

Sans cette constante partagée, le guard ne saurait pas sous quel nom aller chercher les rôles.

***

## `Role`

- Enum des rôles autorisés dans l’application.
- Ici, il sert à typer `requiredRoles` et à comparer avec `req.user.role`.

***

## `RequestWithUser`

- Type de requête enrichie avec `user`.
- Permet au compilateur de comprendre que `req.user` existe.

### Rôle

- Donner un type correct à la requête HTTP enrichie par l’auth guard.
- Très utile puisque `RolesGuard` dépend du fait que `BasicAuthGuard` ait déjà placé un utilisateur dans `req.user`. [darraghoriordan](https://www.darraghoriordan.com/2023/08/14/custom-request-response-express-typescript)

***

# Décorateur `@Injectable()`

```ts
@Injectable()
```

### Rôle

- Déclarer `RolesGuard` comme provider injectable.
- Cela permet à Nest d’injecter automatiquement `Reflector` dans le constructeur.

***

# Classe `RolesGuard`

```ts
export class RolesGuard implements CanActivate {
```

### Rôle

- Définir un guard de contrôle d’accès RBAC.
- Il implémente `CanActivate`, donc il doit fournir `canActivate()`.

### Responsabilité

- Lire les rôles exigés par la route,
- lire le rôle réel de l’utilisateur courant,
- vérifier la correspondance,
- autoriser ou refuser la requête.

***

# Constructeur

```ts
constructor(private readonly reflector: Reflector) {}
```

### Variable / propriété

- `reflector` (`Reflector`) : service Nest utilisé pour lire les métadonnées.

### Rôle

- Injecter l’outil de réflexion Nest.
- Le `private readonly` dans le constructeur crée automatiquement une propriété de classe.

### Intérêt

Grâce à cette injection, le guard peut lire les métadonnées ajoutées par `@Roles(...)`.  
C’est justement le pattern recommandé dans les exemples Nest pour les guards de rôles. [docs.nestjs](https://docs.nestjs.com/security/authorization)

***

# Méthode `canActivate`

```ts
canActivate(context: ExecutionContext): boolean {
```

### Paramètre

- `context` : contexte d’exécution courant.

### Type de retour

- `boolean` : le guard fonctionne ici de façon synchrone.

### Rôle global

- Lire les rôles requis,
- autoriser si aucun rôle n’est requis,
- sinon comparer avec `req.user.role`,
- lever une `ForbiddenException` en cas d’échec.

***

## Lecture des rôles requis

```ts
const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
  context.getHandler(),
  context.getClass()
]);
```

### Variable

- `requiredRoles` (`Role[] | undefined`) : liste des rôles requis pour la route courante.

### Rôle

- Récupérer la metadata `"roles"` attachée :
  1. d’abord au handler (la méthode),
  2. puis à la classe.

### Décomposition

#### `this.reflector.getAllAndOverride<Role[]>(...)`

- Lit une clé de metadata sur plusieurs cibles.
- Retourne la première valeur définie selon l’ordre donné.
- `getAllAndOverride()` est exactement la méthode recommandée par Nest quand on veut permettre à une méthode de surcharger la metadata définie au niveau classe. [docs.nest-js](https://docs.nest-js.fr/fundamentals/execution-context)

#### `ROLES_KEY`

- Clé de metadata à lire, ici `"roles"`.

#### Tableau des cibles

```ts
[
  context.getHandler(),
  context.getClass()
]
```

- `context.getHandler()` : la méthode de route actuelle.
- `context.getClass()` : le controller.

### Logique de priorité

Le guard vérifie d’abord si la méthode a sa propre metadata de rôles.  
Sinon, il regarde celle du controller.

### Exemple

#### Cas 1 : rôles définis sur la méthode

```ts
@Roles(Role.ADMIN)
@Get()
findAll() {}
```

Alors `requiredRoles` viendra de la méthode.

#### Cas 2 : rôles définis sur la classe

```ts
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {}
```

Alors `requiredRoles` viendra de la classe, sauf si une méthode la surcharge. Ce comportement est justement la raison d’utiliser `getAllAndOverride()`. [docs.nestjs](https://docs.nestjs.com/fundamentals/execution-context)

***

## Cas sans rôles requis

```ts
if (!requiredRoles || requiredRoles.length === 0) {
  return true;
}
```

### Rôle

- Si aucune metadata de rôles n’est définie, le guard laisse passer la requête.

### Interprétation

Cela signifie :

- route publique du point de vue des rôles,
- ou au moins route sans restriction RBAC spécifique.

### Important

Ce guard ne rend pas une route publique au sens authentification si un autre guard la protège toujours. Il dit simplement : **“aucun rôle particulier n’est exigé”**.  
Si `BasicAuthGuard` est aussi appliqué avant, la requête devra quand même être authentifiée. [docs.nestjs](https://docs.nestjs.com/guards)

***

## Récupération de la requête HTTP

```ts
const req = context.switchToHttp().getRequest<RequestWithUser>();
```

### Variable

- `req` : requête HTTP courante avec propriété `user`.

### Rôle

- Accéder à l’utilisateur authentifié injecté en amont.

### Pourquoi c’est important

`RolesGuard` suppose qu’un mécanisme précédent a déjà placé un utilisateur dans `req.user`.  
Dans ton projet, c’est justement le rôle de `BasicAuthGuard`. Si `req.user` n’est pas défini, le guard ne peut pas faire la comparaison de rôle. [stackoverflow](https://stackoverflow.com/questions/57932498/nestjs-rolesguard-not-working-as-expected)

***

## Vérification du rôle utilisateur

```ts
if (!req.user || !requiredRoles.includes(req.user.role)) {
  throw new ForbiddenException("Insufficient role");
}
```

### Rôle

- Vérifier deux choses :
  1. qu’un utilisateur existe bien dans la requête,
  2. que son rôle fait partie des rôles autorisés.

### Décomposition

#### `!req.user`

- Si aucun utilisateur n’a été injecté, le guard échoue.

#### `!requiredRoles.includes(req.user.role)`

- Si le rôle de l’utilisateur n’est pas dans la liste des rôles autorisés, le guard échoue.

### Exemple

Si :

```ts
requiredRoles = [Role.ADMIN, Role.AGENT]
req.user.role = Role.VIEWER
```

alors :

```ts
requiredRoles.includes(Role.VIEWER) === false
```

et le guard lève une exception.

### Exception utilisée

```ts
throw new ForbiddenException("Insufficient role");
```

- Réponse HTTP 403.
- Message : `"Insufficient role"`.

### Pourquoi 403

L’utilisateur peut être authentifié, mais il n’a pas les droits suffisants.  
C’est bien un cas de **forbidden**, pas d’**unauthorized**. [oneuptime](https://oneuptime.com/blog/post/2026-01-25-rbac-custom-guards-nestjs/view)

***

## Autorisation finale

```ts
return true;
```

### Rôle

- Si aucun des cas de refus n’a été déclenché, l’accès est autorisé.

### Signification

Le handler de route peut maintenant s’exécuter.

***

# Flux complet du guard

Voici la logique complète :

1. Lire les rôles requis via `Reflector` sur la méthode puis sur la classe. [docs.nestjs](https://docs.nestjs.com/security/authorization)
2. Si aucun rôle n’est requis, autoriser directement.  
3. Récupérer la requête HTTP.  
4. Lire `req.user`.  
5. Vérifier si le rôle de l’utilisateur est inclus dans `requiredRoles`.  
6. Si non :
   - lever `ForbiddenException("Insufficient role")`.  
7. Sinon :
   - `return true`.

***

# Dépendance implicite avec l’auth guard

Ce point est important : ce guard dépend implicitement du fait qu’un autre guard ou middleware ait déjà injecté `req.user`.

Dans ton projet :

- `BasicAuthGuard` met `req.user = { role, subject }`,
- `RolesGuard` lit `req.user.role`.

Sans cette étape préalable, `RolesGuard` échouerait sur `!req.user`. C’est un pattern courant dans Nest : le guard d’auth authentifie, puis le guard d’autorisation exploite l’utilisateur injecté. [stackoverflow](https://stackoverflow.com/questions/57932498/nestjs-rolesguard-not-working-as-expected)

***

# Exemple d’utilisation

## Décorateur sur route

```ts
@Get("admin")
@Roles(Role.ADMIN)
getAdminData() {
  return "secret";
}
```

### Cas 1 : utilisateur admin

```ts
req.user.role === Role.ADMIN
```

- `requiredRoles = [Role.ADMIN]`
- `includes(...) === true`
- accès autorisé

### Cas 2 : utilisateur viewer

```ts
req.user.role === Role.VIEWER
```

- `requiredRoles = [Role.ADMIN]`
- `includes(...) === false`
- exception 403 `"Insufficient role"`

***

## Décorateur sur classe

```ts
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {}
```

### Rôle

- Toutes les routes du controller héritent de cette contrainte, sauf si une méthode définit sa propre metadata.
- C’est précisément l’intérêt de `getAllAndOverride()`. [docs.nest-js](https://docs.nest-js.fr/fundamentals/execution-context)

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `RolesGuard` | guard Nest | applique l’autorisation basée sur les rôles |
| `reflector` | service Nest | lit les metadata des décorateurs |
| `context` | `ExecutionContext` | accès au handler, à la classe et à la requête |
| `requiredRoles` | `Role[] \| undefined` | rôles requis pour la route |
| `req` | `RequestWithUser` | requête enrichie avec `user` |
| `req.user.role` | `Role` | rôle réel de l’utilisateur courant |
| `ROLES_KEY` | clé de metadata | nom de la metadata contenant les rôles |
| `ForbiddenException` | exception HTTP 403 | refus d’accès par manque de permissions |

***

# Lecture architecturale

## 1. Guard d’autorisation, pas d’authentification

Ce fichier ne vérifie pas de token, ne lit pas le header Authorization, et ne résout pas l’identité.  
Il suppose qu’un autre composant a déjà authentifié la requête.

## 2. RBAC déclaratif

Le système suit un modèle RBAC classique :

- `Role` définit les rôles,
- `@Roles(...)` les attache à une route,
- `RolesGuard` lit ces rôles et les compare avec `req.user.role`. [dev](https://dev.to/luffy_p1r4t3/role-based-access-control-in-nestjs-2cl2)

## 3. Priorité méthode > classe

Le choix de `getAllAndOverride()` permet un comportement propre :

- rôle défini sur la méthode = priorité haute,
- sinon fallback sur la classe. [docs.nestjs](https://docs.nestjs.com/fundamentals/execution-context)

## 4. Code simple et lisible

Le guard reste volontairement minimal :

- pas de hiérarchie de rôles,
- pas de permissions fines,
- pas de rôles multiples par utilisateur,
- juste une inclusion simple dans une liste.

C’est souvent suffisant pour un premier niveau de RBAC.

***

# Traduction simple pour débutant

Tu peux voir ce fichier comme :

> “si la route demande certains rôles, regarde si l’utilisateur courant a l’un de ces rôles”.

Exemple :

```ts
@Roles(Role.ADMIN)
```

veut dire :

> “seuls les admins peuvent passer”.

Le guard lit cette info, puis compare avec :

```ts
req.user.role
```

et décide :

- oui → `true`
- non → erreur 403

***

# Conclusion technique du fichier

`role.guard.ts` définit un **guard NestJS d’autorisation par rôles** :

- il lit la metadata `roles` depuis la méthode ou la classe via `Reflector`,
- laisse passer si aucun rôle n’est requis,
- récupère `req.user`,
- vérifie que `req.user.role` fait partie des rôles autorisés,
- lève une `ForbiddenException` sinon. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-nestjs-guards-authorization/view)

C’est la seconde moitié logique du système RBAC de ton projet, après :

- `role.enum.ts` pour définir les rôles,
- `roles.decorator.ts` pour déclarer les rôles requis,
- `basic-auth.guard.ts` pour injecter l’utilisateur courant.
***
Parfait — on continue avec le **même format détaillé**.  
Voici le breakdown de `audit.interceptor.ts`.

***

# Breakdown de `audit.interceptor.ts`

## Vue d’ensemble

Ce fichier définit un **interceptor NestJS** chargé de journaliser les requêtes HTTP de l’application dans une logique d’audit. Un interceptor Nest peut intercepter l’exécution avant et après le handler, observer le flux de réponse, mesurer le temps, transformer des données ou produire des effets secondaires comme du logging. [docs.nestjs](https://docs.nestjs.com/interceptors)

Ici, `AuditInterceptor` :

- récupère les informations de la requête,
- mesure la durée d’exécution,
- enregistre les accès réussis et échoués,
- conserve les logs en mémoire,
- peut les exporter dans un fichier.

Comme il est branché globalement via `APP_INTERCEPTOR`, il s’applique à toute l’application. Un interceptor global Nest agit sur chaque requête/réponse de l’application. [linkedin](https://www.linkedin.com/pulse/using-guards-interceptors-authorization-logging-nestjs-brijesh-yadav-9ehgf)

***

## Imports

```ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
```

***

## `Injectable`

- Décorateur NestJS qui rend la classe injectable et gérée par le conteneur DI.
- Ici, il permet à `AuditInterceptor` d’être enregistré comme provider/interceptor global. [docs.nestjs](https://docs.nestjs.com/interceptors)

***

## `NestInterceptor`

- Interface NestJS que doit implémenter un interceptor.
- Elle impose une méthode `intercept(context, next)`.

### Rôle

- Définir le contrat de l’interceptor.
- Dans Nest, un interceptor agit autour de l’exécution du handler, avant et après la réponse. [docs.nest-js](https://docs.nest-js.fr/interceptors)

***

## `ExecutionContext`

- Représente le contexte d’exécution courant.
- Sert à accéder à la requête, à la réponse, au handler et à la classe. [oneuptime](https://oneuptime.com/blog/post/2026-02-03-nestjs-interceptors/view)

### Rôle ici

- Récupérer l’objet `request`
- récupérer l’objet `response`

***

## `CallHandler`

- Représente le “prochain maillon” du pipeline Nest.
- Il expose la méthode `handle()` qui déclenche l’exécution du handler de route et retourne un `Observable`. [docs.nest-js](https://docs.nest-js.fr/interceptors)

### Rôle ici

- Permettre à l’interceptor d’observer ce qui se passe après l’appel réel du handler.

***

## `Logger`

- Logger intégré fourni par NestJS.
- Permet d’écrire des logs structurés (`log`, `error`, etc.).

### Rôle ici

- Créer un logger nommé `AUDIT`.
- Écrire les événements d’audit dans la console.

***

## `Observable`

- Type RxJS représentant un flux asynchrone.
- Dans Nest, beaucoup de pipelines internes utilisent RxJS, notamment dans les interceptors. L’interface `CallHandler.handle()` retourne bien un `Observable`. [docs.nestjs](https://docs.nestjs.com/interceptors)

### Rôle ici

- Type de retour de `intercept(...)`.

***

## `tap`

- Opérateur RxJS utilisé pour produire des **effets de bord** sans modifier le flux. Le `tap` est justement destiné à observer un flux, journaliser ou déclencher une action sans transformer la donnée émise. [stackoverflow](https://stackoverflow.com/questions/58269766/why-do-we-need-tap-operator-in-rxjs)

### Rôle ici

- Exécuter du logging :
  - en cas de succès (`next`)
  - en cas d’erreur (`error`)
- sans modifier la réponse HTTP.

***

## `Request`

- Type Express de la requête HTTP.
- Utilisé ici pour typer proprement `request`.

***

# Interface `AuditLog`

```ts
interface AuditLog {
    timestamp: string;
    method: string;
    path: string;
    status: number;
    duration: number;
    ip: string;
    token?: string;
    userId?: string;
    body?: any;
}
```

Cette interface définit la structure d’un enregistrement d’audit.

***

## Champ `timestamp`

- Type : `string`
- Contient la date/heure du log, au format ISO.

### Rôle

- Permet de savoir quand l’action a eu lieu.

***

## Champ `method`

- Type : `string`
- Méthode HTTP de la requête (`GET`, `POST`, `PUT`, etc.).

### Rôle

- Identifier le type d’opération.

***

## Champ `path`

- Type : `string`
- Chemin HTTP demandé.

### Exemple

- `/api/scans`
- `/api/scan-tasks/claim`

***

## Champ `status`

- Type : `number`
- Code HTTP final.

### Exemple

- `200`
- `201`
- `401`
- `403`
- `500`

***

## Champ `duration`

- Type : `number`
- Durée de traitement en millisecondes.

### Rôle

- Mesurer la performance de la requête.

***

## Champ `ip`

- Type : `string`
- Adresse IP de l’appelant.

### Rôle

- Tracer l’origine réseau de la requête.

***

## Champ `token?`

- Type : `string | undefined`
- Premier extrait du token Bearer, si présent.

### Rôle

- Aider à corréler les appels sans enregistrer tout le token.

***

## Champ `userId?`

- Type : `string | undefined`
- Champ prévu pour l’identifiant utilisateur.

### Remarque

Dans le code actuel, `userId` existe dans l’interface mais n’est **jamais rempli** dans `intercept()`.

***

## Champ `body?`

- Type : `any`
- Corps de requête nettoyé.

### Rôle

- Enregistrer certaines données utiles de la requête sans garder les secrets sensibles.

***

# Décorateur `@Injectable()`

```ts
@Injectable()
```

### Rôle

- Permet à Nest d’instancier l’interceptor et de l’utiliser comme provider.

***

# Classe `AuditInterceptor`

```ts
export class AuditInterceptor implements NestInterceptor {
```

### Rôle

- Définir un interceptor global de logging d’audit.

### Responsabilités

- capturer les infos de requête,
- mesurer le temps,
- enregistrer succès et erreurs,
- stocker en mémoire,
- exporter les logs si besoin.

***

## Propriété `logger`

```ts
private readonly logger = new Logger('AUDIT');
```

### Variable

- `logger` : instance du logger Nest.

### Rôle

- Préfixer les logs avec le contexte `"AUDIT"`.
- Produire des logs lisibles en console.

### Intérêt

Permet de distinguer facilement les logs d’audit des autres logs système.

***

## Propriété `auditLogs`

```ts
private auditLogs: AuditLog[] = [];
```

### Variable

- `auditLogs` : tableau en mémoire contenant tous les logs d’audit collectés.

### Rôle

- Stocker les événements au runtime.
- Servir ensuite à :
  - consultation via `getAuditLogs()`,
  - purge via `clearAuditLogs()`,
  - export via `exportLogsToFile()`.

### Point d’architecture

Ce stockage est **volatile** :

- il vit en mémoire seulement,
- il disparaît si le process redémarre,
- il grossit potentiellement sans limite.

Donc c’est simple et pratique en dev ou en petit environnement, mais pas idéal à grande échelle.

***

# Méthode `intercept`

```ts
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
```

### Paramètres

- `context` : contexte d’exécution courant
- `next` : handler suivant dans la chaîne

### Type de retour

- `Observable<any>`

### Rôle global

- Capturer les informations de la requête avant exécution,
- laisser la requête continuer,
- puis journaliser le résultat ou l’erreur après exécution.

C’est exactement la mécanique d’un interceptor Nest : utiliser `next.handle()` puis observer le flux retourné. [docs.nest-js](https://docs.nest-js.fr/interceptors)

***

## Récupération de la requête et de la réponse

```ts
const request = context.switchToHttp().getRequest<Request>();
const response = context.switchToHttp().getResponse();
```

### Variables

- `request` : requête HTTP Express
- `response` : réponse HTTP

### Rôle

- Accéder aux infos HTTP concrètes.

### Détail

`ExecutionContext` peut être utilisé dans plusieurs types de transports, mais `switchToHttp()` indique qu’on veut travailler avec le contexte HTTP. [docs.nestjs](https://docs.nestjs.com/fundamentals/execution-context)

***

## Temps de départ

```ts
const startTime = Date.now();
```

### Variable

- `startTime` : timestamp au début du traitement.

### Rôle

- Calculer la durée de la requête plus tard avec :

```ts
Date.now() - startTime
```

***

## Extraction des infos de requête

```ts
const method = request.method;
const path = request.path;
const ip = request.ip || request.connection.remoteAddress || 'unknown';
```

### Variables

- `method` : méthode HTTP
- `path` : chemin demandé
- `ip` : IP du client

### Rôle

- Constituer la base du log d’audit.

### Remarque sur `ip`

`request.ip` et `request.connection.remoteAddress` sont des moyens classiques de récupérer l’IP dans Express, mais derrière un proxy il faut souvent faire attention à `x-forwarded-for` et à la configuration `trust proxy`. Sans cela, l’IP vue peut être celle du proxy ou `localhost`. [reddit](https://www.reddit.com/r/node/comments/jsf13d/how_do_i_get_the_clients_ip_address_in_express_js/)

### Exemple

- en local : `::1` ou `127.0.0.1`
- derrière proxy mal configuré : IP du reverse proxy
- derrière proxy bien configuré : IP réelle du client

***

## Extraction du token

```ts
const authHeader = request.get('Authorization') || '';
const token = authHeader.replace('Bearer ', '').substring(0, 20);
```

### Variables

- `authHeader` : valeur brute du header Authorization
- `token` : extrait partiel du token

### Rôle

- Récupérer le token Bearer pour audit.
- N’en conserver que les 20 premiers caractères.

### Intérêt

- Corrélation minimale d’un appel à un token
- sans enregistrer le token complet

### Limite

- `replace('Bearer ', '')` retire juste le préfixe exact, sans validation stricte.
- Si le header n’est pas au format attendu, le résultat peut être imparfait.
- Le découpage à 20 caractères reste prudent, mais même un fragment de token peut parfois être sensible selon le contexte.

***

## Nettoyage du body

```ts
const body = this.sanitizeBody(request.body);
```

### Variable

- `body` : corps de requête nettoyé.

### Rôle

- Préparer une version “audit-friendly” du body.
- Éviter de stocker des champs sensibles évidents.

***

# Retour du pipeline RxJS

```ts
return next.handle().pipe(
    tap({
        next: (result) => {
            ...
        },
        error: (error) => {
            ...
        },
    })
);
```

### Rôle

- Exécuter réellement le handler de route avec `next.handle()`.
- Observer le flux de sortie sans le modifier grâce à `tap`. [learnrxjs](https://www.learnrxjs.io/learn-rxjs/operators/utility/do)

### Très important

`tap` ne transforme pas la réponse.  
Il observe simplement ce qui passe, ce qui est parfait pour du logging/audit. [angulartraining](https://www.angulartraining.com/daily-newsletter/rxjs-tap-operator/)

***

# Bloc `next` : cas succès

```ts
next: (result) => {
```

### Rôle

- Ce bloc s’exécute quand le handler retourne une réponse avec succès.

### Remarque

- `result` est présent mais pas utilisé dans le code.
- Il pourrait servir plus tard à auditer le contenu de la réponse.

***

## Calcul de la durée et du statut

```ts
const duration = Date.now() - startTime;
const status = response.statusCode;
```

### Variables

- `duration` : temps total en ms
- `status` : code HTTP final

### Rôle

- Compléter les données du log avec les infos finales de la réponse.

***

## Construction du log d’audit succès

```ts
const auditLog: AuditLog = {
    timestamp: new Date().toISOString(),
    method,
    path,
    status,
    duration,
    ip,
    token: token || undefined,
    body: Object.keys(body).length > 0 ? body : undefined,
};
```

### Variable

- `auditLog` : objet structuré conforme à l’interface `AuditLog`.

### Rôle

- Représenter un événement d’audit complet.

### Détail

#### `timestamp`

- Date ISO de l’événement.

#### `token: token || undefined`

- Si `token` est une chaîne vide, on met `undefined`.

#### `body: Object.keys(body).length > 0 ? body : undefined`

- Si le body nettoyé est vide, on ne le stocke pas.

### Remarque

Le champ `userId` de l’interface n’est pas rempli ici.

***

## Ajout en mémoire

```ts
this.auditLogs.push(auditLog);
```

### Rôle

- Stocker le log dans le tableau interne.

### Conséquence

Tous les logs s’accumulent en mémoire jusqu’à effacement manuel ou redémarrage du process.

***

## Log console conditionnel

```ts
if (this.isAuditableAction(method, path)) {
    this.logger.log(
        `[${status}] ${method} ${path} (${duration}ms) - IP: ${ip}`
    );
}
```

### Rôle

- Écrire un log console pour certaines actions jugées importantes.
- Ne pas loguer forcément tout en console, même si tout est stocké en mémoire.

### Important

L’interceptor **stocke tous les logs** dans `auditLogs`, mais n’affiche en console qu’un sous-ensemble défini par `isAuditableAction(...)`.

***

# Bloc `error` : cas erreur

```ts
error: (error) => {
```

### Rôle

- S’exécute si le handler ou le pipeline échoue avec une erreur.

***

## Calcul durée + statut erreur

```ts
const duration = Date.now() - startTime;
const status = error.status || 500;
```

### Variables

- `duration` : temps total avant l’échec
- `status` : code HTTP de l’erreur ou fallback `500`

### Rôle

- Journaliser aussi les échecs.

### Remarque

- `error.status` est courant dans les exceptions Nest/HTTP.
- Si absent, le code force `500`.

***

## Construction du log d’erreur

```ts
const auditLog: AuditLog = {
    timestamp: new Date().toISOString(),
    method,
    path,
    status,
    duration,
    ip,
    token: token || undefined,
    body: Object.keys(body).length > 0 ? body : undefined,
};
```

### Rôle

- Construire un log d’audit même en cas d’échec.

### Remarque

Le contenu est quasiment identique au cas succès, sauf que le statut est dérivé de l’erreur.

***

## Stockage du log d’erreur

```ts
this.auditLogs.push(auditLog);
```

### Rôle

- Conserver aussi les événements d’erreur dans l’historique mémoire.

***

## Log console d’erreur

```ts
this.logger.error(
    `[${status}] ${method} ${path} (${duration}ms) - Error: ${error.message}`
);
```

### Rôle

- Écrire un log d’erreur en console.
- Ici, contrairement au cas succès, toutes les erreurs semblent être loguées.

***

# Méthode `sanitizeBody`

```ts
private sanitizeBody(body: any): any {
```

### Rôle

- Nettoyer le body de la requête avant audit.
- Supprimer certains champs sensibles.

***

## Cas body invalide

```ts
if (!body || typeof body !== 'object') {
    return {};
}
```

### Rôle

- Si le body est absent ou non objet, renvoyer un objet vide.
- Évite de casser la logique suivante basée sur `Object.keys(...)`.

***

## Copie du body

```ts
const sanitized = { ...body };
```

### Rôle

- Créer une copie superficielle.
- Éviter de modifier directement `request.body`.

### Important

C’est une **copie shallow**, donc si le body contient des objets imbriqués, ils ne sont pas profondément clonés.

***

## Liste des champs sensibles

```ts
const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
];
```

### Rôle

- Définir les clés à retirer du body avant stockage.

### Intérêt

Éviter de conserver en audit certains secrets évidents.

### Limite

Le nettoyage est basé sur des noms exacts :

- sensible aux variantes de casse (`Password`, `accessToken`, etc.),
- ne gère pas les objets imbriqués,
- ne gère pas les tableaux complexes.

***

## Suppression des champs sensibles

```ts
for (const field of sensitiveFields) {
    delete sanitized[field];
}
```

### Rôle

- Supprimer les champs listés de l’objet `sanitized`.

### Résultat

Le log stocké aura une version partiellement nettoyée du body.

***

## Retour du body nettoyé

```ts
return sanitized;
```

***

# Méthode `isAuditableAction`

```ts
private isAuditableAction(method: string, path: string): boolean {
```

### Rôle

- Déterminer si une requête mérite un log console explicite.

***

## Log des opérations d’écriture

```ts
if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return true;
}
```

### Rôle

- Considérer toutes les opérations modifiant l’état comme auditées/visibles.

### Interprétation

C’est cohérent, car les actions d’écriture sont souvent les plus sensibles.

***

## Log de certains endpoints importants

```ts
const importantPaths = ['/api/scan-tasks/claim', '/api/scans', '/api/reports'];
return importantPaths.some((p) => path.includes(p));
```

### Variables

- `importantPaths` : liste des chemins importants à surveiller.

### Rôle

- Même pour des lectures ou appels non mutateurs, certains endpoints sont jugés importants.

### Exemple

- `/api/scan-tasks/claim`
- `/api/scans`
- `/api/reports`

### Détail

`some(...)` renvoie `true` si au moins un chemin important est inclus dans `path`.

***

# Méthode `getAuditLogs`

```ts
getAuditLogs(): AuditLog[] {
    return this.auditLogs;
}
```

### Rôle

- Retourner la liste courante des logs en mémoire.

### Remarque

Cette méthode renvoie directement le tableau interne, pas une copie. Donc du code appelant pourrait théoriquement le modifier.

***

# Méthode `clearAuditLogs`

```ts
clearAuditLogs(): void {
    this.auditLogs = [];
}
```

### Rôle

- Réinitialiser complètement l’historique en mémoire.

### Usage probable

- tests,
- maintenance,
- rotation manuelle,
- export suivi d’un clear.

***

# Méthode `exportLogsToFile`

```ts
exportLogsToFile(filePath: string): void {
    const fs = require('fs');
    fs.writeFileSync(
        filePath,
        JSON.stringify(this.auditLogs, null, 2),
        'utf-8'
    );
    this.logger.log(`Audit logs exported to ${filePath}`);
}
```

### Paramètre

- `filePath` : chemin du fichier de sortie.

### Rôle

- Exporter les logs d’audit en JSON dans un fichier.

### Décomposition

#### `const fs = require('fs');`

- Charge dynamiquement le module Node `fs`.

#### `JSON.stringify(this.auditLogs, null, 2)`

- Convertit les logs en JSON lisible, indenté sur 2 espaces.

#### `fs.writeFileSync(...)`

- Écrit le fichier de manière synchrone.

#### `this.logger.log(...)`

- Confirme l’export en console.

### Remarque technique

Utiliser `require('fs')` à l’intérieur d’une méthode est fonctionnel mais un peu moins idiomatique que :

```ts
import * as fs from 'fs';
```

en tête de fichier, surtout dans un projet TypeScript/Nest structuré.

***

# Flux global de l’interceptor

Voici le déroulé complet :

1. Récupérer `request` et `response`. [oneuptime](https://oneuptime.com/blog/post/2026-02-03-nestjs-interceptors/view)
2. Capturer :
   - heure de départ,
   - méthode,
   - path,
   - IP,
   - extrait de token,
   - body nettoyé.  
3. Appeler `next.handle()` pour laisser la requête continuer. [docs.nest-js](https://docs.nest-js.fr/interceptors)
4. Observer le flux avec `tap(...)`. [learnrxjs](https://www.learnrxjs.io/learn-rxjs/operators/utility/do)
5. En cas de succès :
   - calculer durée + statut,
   - créer un `AuditLog`,
   - le stocker,
   - loguer en console si l’action est jugée importante.  
6. En cas d’erreur :
   - calculer durée + statut,
   - créer un `AuditLog`,
   - le stocker,
   - loguer l’erreur en console.  

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `AuditLog` | interface | structure d’un événement d’audit |
| `logger` | `Logger` Nest | écrit les logs console |
| `auditLogs` | `AuditLog[]` | stockage mémoire des logs |
| `intercept` | méthode interceptor | observe les requêtes/réponses |
| `request` | `Request` Express | source des données HTTP |
| `response` | réponse HTTP | source du `statusCode` |
| `startTime` | nombre | point de départ pour mesurer la durée |
| `method` | string | méthode HTTP |
| `path` | string | chemin demandé |
| `ip` | string | IP du client |
| `authHeader` | string | header Authorization brut |
| `token` | string | premier extrait du token |
| `body` | objet | body nettoyé |
| `sanitizeBody` | méthode privée | retire certains champs sensibles |
| `isAuditableAction` | méthode privée | choisit quels appels afficher en console |
| `getAuditLogs` | méthode publique | retourne les logs mémoire |
| `clearAuditLogs` | méthode publique | efface les logs mémoire |
| `exportLogsToFile` | méthode publique | exporte les logs vers un fichier JSON |

***

# Lecture architecturale

## 1. Interceptor transversal

Le choix de l’interceptor est pertinent pour l’audit, car il permet d’observer **toutes** les requêtes au même endroit, sans répéter du code dans chaque controller. Les interceptors sont précisément conçus pour ce type de logique transverse. [blog.logrocket](https://blog.logrocket.com/nestjs-interceptors-guide-use-cases/)

## 2. Audit en mémoire

Le système est simple :

- stockage local en RAM,
- possibilité d’export manuel,
- affichage console.

C’est pratique pour démarrer, mais limité pour une vraie prod :

- perte à chaque redémarrage,
- pas de rotation native,
- pas de persistance centralisée.

## 3. Nettoyage de données sensible

Le code fait déjà un effort utile avec `sanitizeBody()`, ce qui est bien pour éviter de logger des secrets évidents. Mais le nettoyage reste superficiel, et il faudrait être plus rigoureux si des payloads complexes sont manipulés.

## 4. Couplage avec le transport HTTP

L’interceptor est centré sur HTTP Express (`Request`, headers, IP, path). C’est cohérent avec ton API NestJS actuelle.

***

# Points d’attention techniques

## 1. `userId` n’est jamais rempli

L’interface `AuditLog` prévoit `userId?: string`, mais le code ne l’alimente jamais. Si `req.user` existe via tes guards, ce champ pourrait être enrichi.

## 2. Le stockage mémoire peut grossir sans limite

`this.auditLogs.push(...)` sur chaque requête signifie que le tableau peut devenir très volumineux avec le temps.

## 3. L’extraction IP peut être inexacte derrière proxy

Sans gestion de `x-forwarded-for` et `trust proxy`, l’IP loguée peut être celle du proxy ou de localhost. [stackfame](https://stackfame.com/get-ip-address-node)

## 4. Nettoyage du body non récursif

Les secrets imbriqués dans des sous-objets ne seront pas supprimés.

## 5. `require('fs')` dans la méthode

Fonctionne, mais un import en haut du fichier serait plus homogène avec le reste du code.

***

# Traduction simple pour débutant

Tu peux voir cet interceptor comme une **caméra de surveillance** sur l’API :

- il regarde chaque requête entrer,
- note ce qu’elle fait,
- mesure combien de temps elle prend,
- enregistre si ça réussit ou si ça échoue,
- puis garde tout dans un carnet mémoire.

Le `tap(...)` de RxJS sert exactement à ça : observer sans changer le flux. [angulartraining](https://www.angulartraining.com/daily-newsletter/rxjs-tap-operator/)

***

# Conclusion technique du fichier

`audit.interceptor.ts` définit un **interceptor global d’audit** :

- il lit les infos de requête HTTP,
- mesure la durée,
- journalise succès et erreurs,
- stocke les événements dans un tableau en mémoire,
- permet de nettoyer, consulter, effacer et exporter ces logs. [learnrxjs](https://www.learnrxjs.io/learn-rxjs/operators/utility/do)

C’est une brique propre pour centraliser le logging d’audit, particulièrement utile dans une API qui gère des scans, des rapports et des agents automatisés.

***
Parfait — on continue dans le même style.  
Voici le breakdown de `request-with-user.ts`.

***

# Breakdown de `request-with-user.ts`

## Vue d’ensemble

Ce fichier définit une **interface TypeScript personnalisée** qui étend la requête HTTP Express pour y ajouter une propriété `user`. Étendre `Request` est une pratique courante en TypeScript quand un middleware, un guard ou une stratégie d’auth ajoute des données à la requête, par exemple `req.user`. [stackoverflow](https://stackoverflow.com/questions/37377731/extend-express-request-object-using-typescript)

Dans ton projet, cette interface sert à typer proprement la requête après passage par `BasicAuthGuard`, qui injecte justement un objet utilisateur simplifié dans `req.user`.

***

## Le code

```ts
import { Request } from "express";
import { Role } from "../enums/role.enum";


export interface RequestWithUser extends Request {
  user?: {
    role: Role;
    subject: string;
  };
}
```

***

# Imports

## `Request`

```ts
import { Request } from "express";
```

### Rôle

- Importer le type de requête HTTP standard d’Express.
- C’est la base que l’interface personnalisée va étendre.

### Pourquoi c’est utile

Dans Express, `Request` contient déjà toutes les propriétés classiques d’une requête HTTP, par exemple :

- `headers`
- `body`
- `params`
- `query`
- `method`
- `path`

L’idée ici n’est pas de recréer une requête, mais de **partir de la requête Express existante** et de lui ajouter une propriété supplémentaire. Étendre `Request` de cette manière est une approche standard en TypeScript. [blog.logrocket](https://blog.logrocket.com/extend-express-request-object-typescript/)

***

## `Role`

```ts
import { Role } from "../enums/role.enum";
```

### Rôle

- Importer l’enum des rôles applicatifs.
- Il sera utilisé dans la propriété `user.role`.

### Intérêt

Cela garantit que le rôle attaché à `req.user` est l’un des rôles officiels du système :

- `Role.ADMIN`
- `Role.VIEWER`
- `Role.AGENT`

***

# Interface `RequestWithUser`

```ts
export interface RequestWithUser extends Request {
```

## `export`

### Rôle

- Rendre l’interface réutilisable dans les autres fichiers.

### Exemple d’usage

Grâce à `export`, tu peux l’utiliser dans :

- `basic-auth.guard.ts`
- `roles.guard.ts`
- un controller
- un interceptor

***

## `interface`

### Rôle

- Définir un contrat de type TypeScript.
- Ici, l’interface décrit la forme d’une requête enrichie.

### Pourquoi une interface

Les interfaces TypeScript servent à décrire des structures d’objet et peuvent être étendues avec `extends`. C’est justement un cas d’usage classique quand on veut ajouter des propriétés à un type existant. [typescripttutorial](https://www.typescripttutorial.net/typescript-tutorial/typescript-extend-interface/)

***

## `RequestWithUser`

### Rôle

- Nommer le type de requête enrichie.
- Le nom indique clairement que cette requête possède potentiellement une propriété `user`.

### Intérêt

Le nom est très parlant :

- `Request` = requête HTTP normale
- `WithUser` = avec un utilisateur attaché

***

## `extends Request`

### Rôle

- Hériter de toutes les propriétés de la requête Express standard.
- Ajouter ensuite seulement ce qui manque.

### Ce que ça implique

`RequestWithUser` possède :

- tout ce que possède `Request`
- **plus** la propriété `user`

C’est exactement le sens du mot-clé `extends` pour une interface TypeScript : créer une nouvelle interface qui reprend les membres d’une autre. [dev](https://dev.to/tomoy/three-ways-of-using-extends-in-typescript-3dld)

### Exemple conceptuel

Si `Request` contient déjà :

```ts
method: string
headers: any
body: any
```

alors `RequestWithUser` contient aussi tout ça, en plus de :

```ts
user?: { ... }
```

***

# Propriété `user`

```ts
user?: {
  role: Role;
  subject: string;
};
```

Cette propriété est la vraie valeur ajoutée du fichier.

***

## `user?`

### Rôle

- Ajouter une propriété `user` à la requête.
- Le `?` signifie qu’elle est **optionnelle**.

### Pourquoi optionnelle

Parce que `req.user` n’existe pas forcément dans tous les contextes :

- avant passage par le guard d’auth → peut être absent
- sur une route publique → peut être absent
- sur une requête mal authentifiée → peut être absent

Rendre la propriété optionnelle est cohérent avec la manière dont les données d’auth sont souvent injectées dans Express/Nest. [plusreturn](https://plusreturn.com/blog/how-to-extend-express-request-interface-in-typescript/)

### Conséquence

TypeScript oblige ensuite à vérifier son existence :

```ts
if (!req.user) {
  ...
}
```

ce qu’on voit justement dans `RolesGuard`.

***

## Objet `user`

La propriété `user` est définie inline comme un petit objet structuré.

***

## Champ `role`

```ts
role: Role;
```

### Type

- `Role`

### Rôle

- Représenter le rôle applicatif de l’utilisateur authentifié.

### Exemple

```ts
req.user = {
  role: Role.ADMIN,
  subject: "admin"
}
```

### Utilité

C’est ce champ qui est utilisé ensuite par `RolesGuard` pour faire le contrôle RBAC :

```ts
requiredRoles.includes(req.user.role)
```

***

## Champ `subject`

```ts
subject: string;
```

### Type

- `string`

### Rôle

- Représenter l’identité logique du principal authentifié.

### Interprétation

Le mot `subject` fait penser au champ `sub` souvent utilisé dans les JWT et les systèmes d’identité.  
Dans ton projet, il semble représenter une identité simple, par exemple :

- `"admin"`
- `"viewer"`
- `"agent"`

### Utilité

Ce champ peut servir à :

- journaliser qui a fait l’action,
- identifier le principal courant,
- enrichir un audit log,
- distinguer plusieurs acteurs même à rôle égal.

***

# Ce que cette interface apporte concrètement

## 1. Typage propre de `req.user`

Sans cette interface, TypeScript pourrait signaler une erreur du genre :

```ts
Property 'user' does not exist on type 'Request'
```

Parce que `Request` Express standard ne connaît pas forcément ta propriété personnalisée. Étendre `Request` est justement une solution courante à ce problème. [dev](https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5)

## 2. Sécurité de typage

Avec `RequestWithUser`, TypeScript sait que :

- `req.user` peut exister,
- `req.user.role` est de type `Role`,
- `req.user.subject` est une `string`.

Donc ton IDE et le compilateur peuvent t’aider.

## 3. Cohérence avec les guards

Le fichier relie bien les deux guards que tu as montrés :

- `BasicAuthGuard` **écrit** `req.user`
- `RolesGuard` **lit** `req.user`

Cette interface formalise ce contrat entre eux.

***

# Exemple d’usage dans ton projet

## Dans `BasicAuthGuard`

```ts
const req = context.switchToHttp().getRequest<RequestWithUser>();
req.user = { role: Role.ADMIN, subject: "admin" };
```

### Rôle

- Le type dit à TypeScript que `req.user` est une propriété valide.
- Sans `RequestWithUser`, cette affectation serait souvent signalée comme invalide.

***

## Dans `RolesGuard`

```ts
const req = context.switchToHttp().getRequest<RequestWithUser>();
if (!req.user || !requiredRoles.includes(req.user.role)) {
  throw new ForbiddenException("Insufficient role");
}
```

### Rôle

- TypeScript comprend que `req.user` peut être absent,
- mais aussi que si elle existe, `req.user.role` est bien un `Role`.

***

# Pourquoi créer une interface dédiée au lieu de modifier globalement Express

Il existe deux approches classiques pour ajouter `user` à une requête Express :

## 1. Type local dédié

Créer un type/une interface comme ici :

```ts
interface RequestWithUser extends Request { ... }
```

### Avantages

- simple,
- explicite,
- local au projet,
- pas besoin de declaration merging global.

## 2. Declaration merging global

Étendre globalement l’interface Express `Request` via un fichier `.d.ts`.  
C’est aussi une approche connue en TypeScript, mais elle demande une config plus globale du projet. [github](https://github.com/DefinitelyTyped/DefinitelyTyped/issues/47741)

### Dans ton cas

Le choix d’une interface dédiée est très bien pour :

- garder le code simple,
- ne typer `req.user` que là où c’est utile,
- éviter d’impacter globalement tous les usages de `Request`.

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `RequestWithUser` | interface TypeScript | requête Express enrichie |
| `Request` | type Express | base standard de la requête HTTP |
| `extends Request` | héritage d’interface | récupère toutes les propriétés standard de la requête |
| `user?` | propriété optionnelle | utilisateur injecté par l’auth |
| `role` | `Role` | rôle applicatif courant |
| `subject` | `string` | identifiant logique du principal |

***

# Lecture architecturale

## 1. Contrat entre auth et autorisation

Ce fichier est une petite brique de liaison entre plusieurs parties du système :

- le guard d’auth ajoute un utilisateur,
- le guard de rôle le lit,
- potentiellement l’interceptor d’audit ou les controllers peuvent aussi le lire.

## 2. Approche minimaliste

Le `user` ici est volontairement simple :

```ts
{
  role: Role;
  subject: string;
}
```

Il ne contient pas :

- email,
- id numérique,
- permissions détaillées,
- expiration,
- claims JWT complètes.

C’est cohérent avec ton auth actuelle, qui est une auth Bearer statique très légère.

## 3. Type centré sur le besoin réel

L’interface ne cherche pas à représenter un “vrai user domain model” complet.  
Elle représente juste **ce que la requête transporte réellement** après authentification.

***

# Traduction simple pour débutant

Tu peux voir ce fichier comme :

> “une requête HTTP normale, mais avec une case en plus appelée `user`”.

Sans ce fichier, TypeScript voit seulement une requête Express normale.  
Avec ce fichier, TypeScript comprend qu’après authentification, tu peux avoir :

```ts
req.user.role
req.user.subject
```

de façon propre et sûre.

***

# Exemple concret

```ts
function example(req: RequestWithUser) {
  if (req.user) {
    console.log(req.user.role);
    console.log(req.user.subject);
  }
}
```

### Ce que TypeScript comprend

- `req` a toutes les propriétés Express normales,
- `req.user` peut être absent,
- si `req.user` existe :
  - `role` est un `Role`
  - `subject` est une `string`

***

# Conclusion technique du fichier

`request-with-user.ts` définit une **interface TypeScript personnalisée** qui étend `Request` d’Express pour ajouter une propriété optionnelle `user`. Cette propriété contient deux informations :

- `role: Role`
- `subject: string`

C’est une solution simple et propre pour typer `req.user` dans un projet NestJS/Express, en particulier quand un guard d’auth enrichit la requête et qu’un autre composant, comme `RolesGuard`, doit ensuite la relire. [reddit](https://www.reddit.com/r/nestjs/comments/1j7v2ee/how_to_properly_type_the_request_object_in_a/)

***
Parfait — on continue avec le même niveau de détail.  
Voici le breakdown de `database.module.ts`.

***

# Breakdown de `database.module.ts`

## Vue d’ensemble

Ce fichier définit un **module NestJS** dédié à la couche base de données. Dans Nest, un module sert à regrouper des providers, controllers et imports/export, et constitue l’unité d’organisation principale de l’application. Les modules encapsulent leurs providers, et seuls les providers exportés deviennent accessibles aux autres modules. [docs.nestjs](https://docs.nestjs.com/modules)

Ici, `DatabaseModule` :

- déclare `DatabaseService` comme provider,
- l’exporte pour qu’il puisse être injecté ailleurs,
- et le rend **global** grâce à `@Global()`, ce qui évite d’avoir à importer ce module dans chaque autre module consommateur. Les modules globaux doivent être enregistrés une seule fois, généralement dans le module racine. [nestjs](https://nestjs.fr/modules/)

***

## Le code

```ts
import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "./database.service";


@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule {}
```

***

# Imports

## `Global`

```ts
import { Global, Module } from "@nestjs/common";
```

### Rôle

- `Global` est un décorateur NestJS qui rend un module **global-scoped**.
- Un module global expose ses providers partout dans l’application, sans avoir besoin d’être réimporté dans chaque module utilisateur, à condition qu’il soit enregistré une fois au niveau racine. [stackoverflow](https://stackoverflow.com/questions/64114712/how-to-use-global-module-in-nestjs)

### Intérêt ici

Comme un service de base de données est souvent utilisé dans beaucoup de modules :

- scans,
- reports,
- auth,
- tasks,

le rendre global réduit le boilerplate.

### Point important

Nest recommande de ne pas abuser des modules globaux et de les enregistrer une seule fois, généralement dans `AppModule` ou un module central. [github](https://github.com/nestjs/nest/issues/3519)

***

## `Module`

### Rôle

- `Module` est le décorateur fondamental de NestJS pour déclarer un module.
- Il prend un objet de configuration décrivant les providers, imports, controllers et exports du module. [docs.nest-js](https://docs.nest-js.fr/modules)

### Intérêt ici

Il transforme `DatabaseModule` en véritable module Nest reconnu par le framework.

***

## `DatabaseService`

```ts
import { DatabaseService } from "./database.service";
```

### Rôle

- Importer le service qui encapsule probablement la logique d’accès à la base de données.
- Ce service devient le provider principal du module.

### Hypothèse raisonnable

Même sans voir `database.service.ts`, on peut déduire que ce service gère probablement :

- la connexion DB,
- l’accès aux collections/tables,
- les opérations CRUD,
- ou l’abstraction de persistance.

Dans Nest, les services sont des providers typiques, injectables dans d’autres classes. [nestjs](https://nestjs.fr/providers/)

***

# Décorateur `@Global()`

```ts
@Global()
```

## Rôle

- Marquer `DatabaseModule` comme **module global**.

### Ce que ça change

Normalement, pour utiliser un provider d’un module, un autre module doit importer explicitement ce module.  
Avec `@Global()`, les providers exportés par ce module deviennent disponibles partout après enregistrement initial du module. [docs.nestjs](https://docs.nestjs.com/modules)

### Exemple sans `@Global()`

Un module consommateur devrait faire :

```ts
@Module({
  imports: [DatabaseModule],
})
export class ReportsModule {}
```

### Exemple avec `@Global()`

Après enregistrement initial dans le root module, `ReportsModule` peut souvent injecter `DatabaseService` sans réimporter `DatabaseModule`. [stackoverflow](https://stackoverflow.com/questions/64114712/how-to-use-global-module-in-nestjs)

### Important

Le module global ne dispense pas de l’enregistrer une première fois.  
Il doit quand même être importé dans un module racine. [github](https://github.com/nestjs/nest/issues/3519)

***

# Décorateur `@Module(...)`

```ts
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService]
})
```

Ce décorateur configure le contenu du module.

***

## `providers: [DatabaseService]`

### Rôle

- Déclarer `DatabaseService` comme provider appartenant à ce module.

### Ce que ça signifie

Nest pourra :

- instancier `DatabaseService`,
- gérer son cycle de vie,
- l’injecter dans d’autres classes.

Les providers sont l’un des concepts centraux de Nest, et les services en sont l’exemple typique. [docs.nestjs](https://docs.nestjs.com/providers)

### Effet concret

Une autre classe peut faire :

```ts
constructor(private readonly databaseService: DatabaseService) {}
```

à condition que le provider soit visible dans son scope.

***

## `exports: [DatabaseService]`

### Rôle

- Exposer `DatabaseService` à l’extérieur du module.

### Pourquoi c’est nécessaire

Dans Nest, un provider déclaré dans `providers` reste encapsulé dans son module tant qu’il n’est pas exporté. Le tableau `exports` définit l’API publique du module. [stackoverflow](https://stackoverflow.com/questions/71618125/exporting-nestjs-module-vs-exporting-providers)

### Sans `exports`

- `DatabaseService` serait utilisable **à l’intérieur** de `DatabaseModule`,
- mais pas injectable depuis d’autres modules.

### Avec `exports`

- d’autres modules peuvent l’utiliser,
- et comme le module est global, cette disponibilité devient très large dans l’application. [docs.nestjs](https://docs.nestjs.com/modules)

***

# Classe `DatabaseModule`

```ts
export class DatabaseModule {}
```

## Rôle

- Déclarer la classe représentant le module.
- C’est une classe vide, ce qui est tout à fait normal pour un module Nest simple.

### Pourquoi elle est vide

Le comportement du module est porté par les décorateurs :

- `@Global()`
- `@Module({...})`

La classe n’a pas besoin de logique interne dans ce cas.

### `export`

- Rend le module importable depuis d’autres fichiers, notamment le module racine.

***

# Ce que fait ce module, concrètement

Ce fichier dit à Nest :

1. “Il existe un module appelé `DatabaseModule`.”  
2. “Ce module possède un provider : `DatabaseService`.”  
3. “Ce provider est exporté.”  
4. “Ce module est global.”  

Donc une fois le module enregistré dans l’application, `DatabaseService` peut être injecté à peu près partout sans répétition d’imports module par module. [nestjs](https://nestjs.fr/modules/)

***

# Exemple de consommation

## Dans un service

```ts
@Injectable()
export class ReportsService {
  constructor(private readonly databaseService: DatabaseService) {}
}
```

### Rôle

- Injecter le service DB directement.

### Pourquoi ça marche

Parce que :

- `DatabaseService` est déclaré dans `providers`,
- il est exporté,
- et son module est global. [docs.nestjs](https://docs.nestjs.com/providers)

***

# Différence entre `providers` et `exports`

C’est un point clé.

## `providers`

- déclare ce que le module **possède** localement.

## `exports`

- déclare ce que le module **rend disponible** aux autres modules.

Tu peux voir `exports` comme l’**API publique** du module. C’est exactement ainsi que Nest présente la frontière d’encapsulation des modules. [stackoverflow](https://stackoverflow.com/questions/71618125/exporting-nestjs-module-vs-exporting-providers)

***

# Pourquoi un module base de données séparé

Créer un `DatabaseModule` séparé a plusieurs avantages.

## 1. Centralisation

Toute la logique DB est regroupée à un seul endroit :

- connexion,
- requêtes,
- repository/service,
- configuration DB.

## 2. Réutilisabilité

Plusieurs domaines métier peuvent réutiliser le même service d’accès DB.

## 3. Meilleure architecture

Cela évite de recréer la logique DB dans chaque module métier.

## 4. Préparation à l’évolution

Plus tard, ce module pourrait évoluer vers :

- un dynamic module,
- un module configurable,
- un wrapper de Prisma/TypeORM/Mongoose,
- une gestion de connexion plus avancée. Nest propose justement aussi des modules dynamiques pour ce genre d’évolution. [docs.nestjs](https://docs.nestjs.com/fundamentals/dynamic-modules)

***

# Lecture architecturale

## 1. Module d’infrastructure

`DatabaseModule` est typiquement un **module d’infrastructure**.  
Il ne représente pas un domaine métier comme `scans` ou `reports`, mais un service transverse nécessaire à plusieurs domaines.

## 2. Choix du global

Rendre ce module global est cohérent pour un composant fréquemment utilisé comme une base de données, un cache, un logger ou une config centralisée. C’est un cas d’usage explicitement courant des global modules. [stanza](https://www.stanza.dev/courses/nestjs-fundamentals/module-architecture/nestjs-fundamentals-global-modules)

## 3. Risque potentiel

Le côté pratique du global vient avec un compromis :

- les dépendances deviennent moins explicites,
- certains modules utilisent `DatabaseService` sans montrer dans `imports` d’où il vient.

Nest indique d’ailleurs que les global modules sont un outil pratique, mais que l’import explicite reste souvent préférable pour garder une architecture claire. [docs.nestjs](https://docs.nestjs.com/modules)

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `DatabaseModule` | module Nest | encapsule l’accès DB |
| `@Global()` | décorateur de module | rend les exports disponibles globalement |
| `@Module(...)` | décorateur de configuration | déclare providers/exports |
| `DatabaseService` | provider/service | logique d’accès à la base de données |
| `providers` | tableau de providers | liste ce que le module instancie |
| `exports` | tableau d’exports | liste ce que le module expose aux autres modules |

***

# Traduction simple pour débutant

Tu peux voir ce fichier comme :

> “je crée un module base de données, il contient `DatabaseService`, et je veux que ce service soit accessible partout dans l’application”.

En version simplifiée :

- `providers` = ce que le module possède
- `exports` = ce qu’il partage
- `@Global()` = ce qu’il partage partout

***

# Exemple mental simple

Imagine que `DatabaseService` soit une boîte à outils DB.

- `providers: [DatabaseService]` → la boîte existe dans ce module.
- `exports: [DatabaseService]` → on autorise les autres modules à l’utiliser.
- `@Global()` → pas besoin de redemander la boîte dans chaque pièce de la maison après l’avoir installée une fois au départ. [stackoverflow](https://stackoverflow.com/questions/64114712/how-to-use-global-module-in-nestjs)

***

# Conclusion technique du fichier

`database.module.ts` définit un **module NestJS global** qui enregistre `DatabaseService` comme provider et l’exporte pour le rendre injectable dans le reste de l’application. Les modules Nest encapsulent leurs providers, et `exports` sert à exposer ceux qu’on veut partager; `@Global()` permet ensuite de les rendre accessibles globalement après enregistrement au niveau racine. [nestjs](https://nestjs.fr/modules/)

C’est une structure propre pour une couche d’infrastructure comme la base de données, surtout si plusieurs modules métiers doivent réutiliser le même service.
***
Parfait — là on arrive sur une vraie pièce centrale de l’archi.  
Voici le breakdown détaillé de `database.service.ts`.

***

# Breakdown de `database.service.ts`

## Vue d’ensemble

Ce fichier définit un **service NestJS d’accès PostgreSQL** basé sur `pg` (node-postgres). Il encapsule la connexion à la base, les requêtes SQL simples, l’exécution de transactions, ainsi que l’initialisation automatique du schéma au démarrage du module. `node-postgres` fournit bien un `Pool` pour mutualiser les connexions, et les transactions doivent être exécutées sur **le même client** avec `BEGIN`, `COMMIT` et `ROLLBACK`. [node-postgres](https://node-postgres.com/features/transactions)

Côté NestJS, ce service utilise aussi deux hooks de cycle de vie :

- `OnModuleInit` pour préparer le schéma au démarrage,
- `OnModuleDestroy` pour fermer proprement le pool à l’arrêt. Les hooks de cycle de vie sont justement prévus pour des tâches d’initialisation et de nettoyage. [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)

***

## Le code

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";


@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "postgres",
      database: process.env.POSTGRES_DB ?? "novisec"
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
    this.logger.log("PostgreSQL schema ready");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureSchema(): Promise<void> {
    ...
  }
}
```

***

# Imports

## `Injectable`

- Décorateur NestJS qui rend la classe injectable dans le conteneur DI.
- Permet d’utiliser `DatabaseService` comme provider dans l’application. [docs.nestjs](https://docs.nestjs.com/providers)

***

## `Logger`

- Logger intégré de NestJS.
- Sert à écrire des messages structurés dans les logs.

### Rôle ici

- Logger l’état de préparation du schéma,
- éventuellement aider au debug opérationnel.

***

## `OnModuleInit`

- Interface de hook lifecycle NestJS.
- `onModuleInit()` est appelée quand le module/provider a été initialisé. [blog.stackademic](https://blog.stackademic.com/advanced-guide-to-lifecycle-events-in-nestjs-ab2b5fbfeb65)

### Rôle ici

- Lancer `ensureSchema()` au démarrage.
- Préparer la base automatiquement.

***

## `OnModuleDestroy`

- Interface de hook lifecycle appelée pendant la destruction du module/provider. [nestjs](https://nestjs.fr/fundamentals/lifecycle-events/)

### Rôle ici

- Fermer proprement le pool PostgreSQL avec `pool.end()`.

### Remarque

Les hooks d’arrêt nécessitent un shutdown correct de l’application, souvent avec `enableShutdownHooks()` côté bootstrap si on veut une gestion complète des signaux de terminaison. [nestjs](https://nestjs.fr/fundamentals/lifecycle-events/)

***

## `Pool`

- Type fourni par `pg`.
- Représente un pool de connexions PostgreSQL.

### Rôle

- Réutiliser efficacement les connexions DB,
- exécuter des requêtes sans créer une connexion à chaque appel. `pool.query(...)` est justement la méthode pratique recommandée pour les requêtes simples hors transaction. [reddit](https://www.reddit.com/r/node/comments/15ab9e1/nodepostgres_can_i_just_use_poolquery_for/)

***

## `PoolClient`

- Représente un client individuel obtenu depuis le pool.

### Rôle ici

- Exécuter plusieurs requêtes dans une **même transaction**.
- C’est obligatoire avec node-postgres : toutes les commandes d’une transaction doivent passer par le **même client**. [github](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/transactions.mdx)

***

## `QueryResult`

- Type de résultat de requête fourni par `pg`.

### Rôle

- Représenter le résultat renvoyé par PostgreSQL.

***

## `QueryResultRow`

- Type de ligne de résultat de base dans `pg`.

### Rôle

- Servir de contrainte générique pour typer les résultats des requêtes.

***

# Décorateur `@Injectable()`

```ts
@Injectable()
```

## Rôle

- Déclare `DatabaseService` comme provider NestJS.
- Permet son injection dans les autres services/controllers/modules.

***

# Classe `DatabaseService`

```ts
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
```

## Rôle

- Centraliser l’accès à PostgreSQL.
- Encapsuler :
  - la connexion,
  - les requêtes SQL,
  - les transactions,
  - l’initialisation du schéma,
  - la fermeture du pool.

## Interfaces implémentées

- `OnModuleInit`
- `OnModuleDestroy`

### Intérêt

Cela donne au service un vrai cycle de vie géré par Nest. [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)

***

# Propriété `logger`

```ts
private readonly logger = new Logger(DatabaseService.name);
```

## Variable

- `logger` : instance du logger Nest.

## Rôle

- Écrire des logs avec le contexte `DatabaseService`.

### Exemple de contexte

Le nom du service sera utilisé comme tag logique dans les logs Nest.

***

# Propriété `pool`

```ts
private readonly pool: Pool;
```

## Variable

- `pool` : pool PostgreSQL principal.

## Rôle

- Gérer les connexions à la base.
- Servir de point d’entrée pour les requêtes simples et pour obtenir un client transactionnel.

## Pourquoi `readonly`

- La référence au pool ne doit pas être remplacée après construction.
- C’est logique : le service travaille avec une seule instance de pool.

***

# Constructeur

```ts
constructor() {
  this.pool = new Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "postgres",
    password: process.env.POSTGRES_PASSWORD ?? "postgres",
    database: process.env.POSTGRES_DB ?? "novisec"
  });
}
```

## Rôle global

- Initialiser le pool PostgreSQL avec la configuration issue de l’environnement.

***

## Configuration du pool

### `host`

```ts
host: process.env.POSTGRES_HOST ?? "localhost"
```

- Hôte PostgreSQL.
- Fallback : `"localhost"`.

### `port`

```ts
port: Number(process.env.POSTGRES_PORT ?? 5432)
```

- Port PostgreSQL.
- Fallback : `5432`, qui est le port standard PostgreSQL.

### `user`

```ts
user: process.env.POSTGRES_USER ?? "postgres"
```

- Utilisateur DB.
- Fallback : `"postgres"`.

### `password`

```ts
password: process.env.POSTGRES_PASSWORD ?? "postgres"
```

- Mot de passe DB.
- Fallback : `"postgres"`.

### `database`

```ts
database: process.env.POSTGRES_DB ?? "novisec"
```

- Nom de la base.
- Fallback : `"novisec"`.

***

## Lecture architecturale du constructeur

Le service repose sur une configuration par variables d’environnement, ce qui est classique dans les applis Nest/Node déployées en conteneur. [docs.nestjs](https://docs.nestjs.com/techniques/configuration)
Les valeurs par défaut facilitent le dev local, mais comme pour tes tokens précédents, elles doivent être considérées avec prudence en production.

***

# Hook `onModuleInit`

```ts
async onModuleInit(): Promise<void> {
  await this.ensureSchema();
  this.logger.log("PostgreSQL schema ready");
}
```

## Rôle

- Exécuter l’initialisation du schéma au démarrage du module.

## Comportement

1. Appelle `ensureSchema()`.
2. Si tout se passe bien, log `"PostgreSQL schema ready"`.

## Intérêt

Cela évite de dépendre d’une migration manuelle minimale pour créer les tables de base.  
`OnModuleInit` est justement prévu pour faire des tâches de setup au moment où le module est prêt. [blog.stackademic](https://blog.stackademic.com/advanced-guide-to-lifecycle-events-in-nestjs-ab2b5fbfeb65)

## Conséquence pratique

Au démarrage de l’application :

- si les tables n’existent pas, elles sont créées,
- sinon, le code continue sans erreur grâce aux `IF NOT EXISTS`.

***

# Hook `onModuleDestroy`

```ts
async onModuleDestroy(): Promise<void> {
  await this.pool.end();
}
```

## Rôle

- Fermer proprement le pool de connexions à l’arrêt du module.

## Intérêt

- Libérer les ressources,
- éviter les connexions pendantes,
- avoir une fermeture propre de l’application.

`pool.end()` est la méthode standard de terminaison du pool dans node-postgres. [node-postgres](https://node-postgres.com/features/transactions)

## Remarque

Pour que ce hook soit réellement invoqué dans tous les cas de shutdown applicatif, il faut que l’application gère bien les hooks d’arrêt. Nest rappelle que cela peut nécessiter `enableShutdownHooks()`. [nestjs](https://nestjs.fr/fundamentals/lifecycle-events/)

***

# Méthode `query`

```ts
query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return this.pool.query<T>(text, params);
}
```

## Rôle global

- Fournir une méthode pratique pour exécuter une requête SQL simple via le pool.

***

## Paramètre `text`

- Type : `string`
- Requête SQL à exécuter.

### Exemple

```ts
SELECT * FROM scans WHERE id = $1
```

***

## Paramètre `params`

- Type : `unknown[]`
- Tableau des paramètres SQL.
- Valeur par défaut : `[]`

### Rôle

- Permettre des requêtes paramétrées.

### Exemple

```ts
query("SELECT * FROM scans WHERE id = $1", [scanId])
```

***

## Générique `<T extends QueryResultRow = QueryResultRow>`

### Rôle

- Permettre de typer les lignes retournées.

### Exemple conceptuel

```ts
type ScanRow = { id: string; agent_id: string };
const result = await db.query<ScanRow>("SELECT id, agent_id FROM scans");
```

Ainsi, `result.rows` sera typé comme `ScanRow[]`.

### Intérêt

- meilleur autocomplétion,
- moins d’erreurs de manipulation de résultats SQL.

***

## Retour

- Type : `Promise<QueryResult<T>>`

### Rôle

- Renvoie le résultat brut de `pg`.

***

## Point important

Utiliser `pool.query(...)` est très bien pour les requêtes unitaires simples.  
La documentation node-postgres recommande justement cette méthode de convenance hors transaction. [reddit](https://www.reddit.com/r/node/comments/15ab9e1/nodepostgres_can_i_just_use_poolquery_for/)

***

# Méthode `transaction`

```ts
async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await this.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

## Rôle global

- Encapsuler l’exécution d’une transaction PostgreSQL.

## Pourquoi cette méthode est importante

Avec node-postgres, une transaction doit utiliser **le même `PoolClient` du début à la fin**. Il ne faut pas mélanger cela avec `pool.query(...)`. La documentation le souligne explicitement. [github](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/transactions.mdx)

***

## Paramètre `callback`

- Type : `(client: PoolClient) => Promise<T>`

### Rôle

- Représenter le travail transactionnel à effectuer.
- Le callback reçoit le client transactionnel.

### Exemple conceptuel

```ts
await db.transaction(async (client) => {
  await client.query(...);
  await client.query(...);
});
```

***

## Étape 1 : obtenir un client

```ts
const client = await this.pool.connect();
```

### Rôle

- Réserver une connexion réelle du pool.
- Cette connexion sera utilisée pour toute la transaction.

***

## Étape 2 : démarrer la transaction

```ts
await client.query("BEGIN");
```

### Rôle

- Ouvrir la transaction SQL.

C’est exactement la façon recommandée par node-postgres : envoyer `BEGIN` soi-même. [node-postgres](https://node-postgres.com/features/transactions)

***

## Étape 3 : exécuter le callback

```ts
const result = await callback(client);
```

### Rôle

- Exécuter la logique métier transactionnelle.
- Toutes les requêtes doivent passer par `client`.

***

## Étape 4 : commit

```ts
await client.query("COMMIT");
return result;
```

### Rôle

- Valider définitivement les modifications si tout s’est bien passé.
- Retourner le résultat du callback.

***

## Étape 5 : rollback en cas d’erreur

```ts
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}
```

### Rôle

- Annuler toutes les opérations de la transaction si une erreur survient.
- Puis relancer l’erreur pour que la couche appelante la gère.

### Intérêt

Garantit l’atomicité :

- soit tout passe,
- soit rien n’est conservé.

***

## Étape 6 : release systématique

```ts
finally {
  client.release();
}
```

### Rôle

- Rendre le client au pool quoi qu’il arrive.
- Évite les fuites de connexions.

### Très important

Sans `release()`, le pool pourrait finir saturé.

***

# Méthode `ensureSchema`

```ts
private async ensureSchema(): Promise<void> {
  ...
}
```

## Rôle global

- Créer les tables et index nécessaires si elles n’existent pas déjà.

## Philosophie

C’est une stratégie de **bootstrap applicatif du schéma** :

- simple,
- automatique,
- sans outil de migration externe immédiat.

Les commandes `CREATE TABLE IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS` sont justement conçues pour pouvoir être rejouées sans recréer les objets existants. PostgreSQL supporte bien `CREATE INDEX IF NOT EXISTS` dans les versions modernes. [stackoverflow](https://stackoverflow.com/questions/24674281/create-unique-index-if-not-exists-in-postgresql)

***

# Table `scans`

```sql
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY,
  agent_id TEXT NOT NULL,
  scan_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  summary_total_containers INTEGER NOT NULL DEFAULT 0,
  summary_healthy_containers INTEGER NOT NULL DEFAULT 0,
  summary_vulnerable_containers INTEGER NOT NULL DEFAULT 0,
  summary_total_vulnerabilities INTEGER NOT NULL DEFAULT 0,
  summary_global_risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Rôle

- Table principale représentant un scan.

## Colonnes

### `id UUID PRIMARY KEY`

- identifiant unique du scan

### `agent_id TEXT NOT NULL`

- identifiant de l’agent ayant exécuté le scan

### `scan_type TEXT NOT NULL`

- type du scan, par exemple `MANUAL_GLOBAL`

### `started_at`, `finished_at` (`TIMESTAMPTZ`)

- timestamps de début et fin
- `TIMESTAMPTZ` est le type PostgreSQL pour timestamp avec fuseau horaire.

### Colonnes `summary_*`

- stockent des agrégats du scan :
  - nb total de conteneurs,
  - nb sains,
  - nb vulnérables,
  - nb total de vulnérabilités,
  - score de risque global

### `summary_global_risk_score NUMERIC(6,2)`

- nombre décimal exact avec 6 chiffres max dont 2 après la virgule

### `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

- date de création de la ligne
- `NOW()` est une fonction standard PostgreSQL pour l’horodatage courant.

***

# Table `scan_containers`

```sql
CREATE TABLE IF NOT EXISTS scan_containers (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  container_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ
);
```

## Rôle

- Représenter les conteneurs observés dans un scan.

## Colonnes importantes

### `id BIGSERIAL PRIMARY KEY`

- identifiant auto-incrémenté

### `scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE`

- clé étrangère vers `scans`
- `ON DELETE CASCADE` signifie que si le scan parent est supprimé, ses conteneurs liés sont supprimés automatiquement.

### `container_id`

- identifiant technique du conteneur

### `name`

- nom du conteneur

### `image`

- image utilisée par le conteneur

### `status`

- statut observé

### `created_at`

- timestamp éventuel de création du conteneur

***

# Table `vulnerabilities`

```sql
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id BIGSERIAL PRIMARY KEY,
  container_row_id BIGINT NOT NULL REFERENCES scan_containers(id) ON DELETE CASCADE,
  cve TEXT NOT NULL,
  cwe TEXT,
  package_name TEXT NOT NULL,
  installed_version TEXT,
  fixed_version TEXT,
  cvss NUMERIC(4,1) NOT NULL,
  severity TEXT NOT NULL,
  title TEXT,
  remediation TEXT,
  description TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Rôle

- Stocker les vulnérabilités associées à un conteneur scanné.

## Colonnes importantes

### `container_row_id`

- FK vers `scan_containers(id)`

### `cve`

- identifiant CVE

### `cwe`

- identifiant CWE éventuel

### `package_name`

- package vulnérable

### `installed_version`, `fixed_version`

- version installée et version corrigée

### `cvss NUMERIC(4,1)`

- score CVSS décimal

### `severity`

- niveau de gravité (`LOW`, `MEDIUM`, `HIGH`, etc.)

### `title`, `remediation`, `description`, `source`

- métadonnées descriptives

### `created_at`

- horodatage de création

***

# Table `cve_updates`

```sql
CREATE TABLE IF NOT EXISTS cve_updates (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Rôle

- Journaliser ou suivre les mises à jour de données CVE.

## Lecture métier probable

Cette table semble servir à suivre :

- quelle source CVE a été mise à jour,
- si la mise à jour a réussi/échoué,
- avec quel message.

***

# Table `scan_tasks`

```sql
CREATE TABLE IF NOT EXISTS scan_tasks (
  id UUID PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('MANUAL_GLOBAL', 'MANUAL_TARGET', 'AUTO_CRON')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  target_container_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT
);
```

## Rôle

- Gérer la file logique des tâches de scan.

## Colonnes importantes

### `mode`

- mode de scan demandé
- contrainte `CHECK` limitant les valeurs possibles

### `status`

- état de la tâche
- contrainte `CHECK` limitant les valeurs à :
  - `queued`
  - `processing`
  - `completed`
  - `failed`

### `requested_by`

- acteur ayant demandé la tâche

### `requested_at`

- date de demande

### `claimed_by`, `claimed_at`

- agent qui a récupéré la tâche et moment de claim

### `completed_at`

- moment de fin

### `scan_id UUID REFERENCES scans(id) ON DELETE SET NULL`

- lien facultatif vers le scan produit
- si le scan est supprimé, on garde la tâche mais `scan_id` devient `NULL`

### `target_container_ids JSONB NOT NULL DEFAULT '[]'::jsonb`

- liste JSON des conteneurs ciblés pour un scan ciblé
- `JSONB` est pratique pour stocker des structures JSON PostgreSQL.

### `message`

- message libre de statut ou d’erreur

***

# Création des index

```ts
await this.query(`CREATE INDEX IF NOT EXISTS idx_scan_tasks_status_requested_at ON scan_tasks (status, requested_at);`);
await this.query(`CREATE INDEX IF NOT EXISTS idx_scan_containers_scan_id ON scan_containers (scan_id);`);
await this.query(`CREATE INDEX IF NOT EXISTS idx_vulnerabilities_container_row_id ON vulnerabilities (container_row_id);`);
```

## Rôle

- Accélérer certaines requêtes probables.

### `idx_scan_tasks_status_requested_at`

- utile pour rechercher rapidement les tâches par statut et ancienneté
- très cohérent pour une file de tâches à “claim”

### `idx_scan_containers_scan_id`

- utile pour retrouver rapidement les conteneurs d’un scan

### `idx_vulnerabilities_container_row_id`

- utile pour retrouver rapidement les vulnérabilités liées à un conteneur

Les index PostgreSQL servent précisément à accélérer les accès aux colonnes ciblées par les filtres et jointures. [postgresql](https://www.postgresql.org/docs/6.4/sql-createindex.htm)

***

# Flux de vie complet du service

## Au démarrage

1. Le constructeur crée le pool PostgreSQL.  
2. Nest appelle `onModuleInit()`. [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)
3. `ensureSchema()` crée les tables/index manquants.  
4. Le service log `"PostgreSQL schema ready"`.

## Pendant l’exécution

- `query(...)` sert aux requêtes simples.
- `transaction(...)` sert aux opérations atomiques multi-requêtes.

## À l’arrêt

1. Nest appelle `onModuleDestroy()` si le shutdown est correctement géré. [nestjs](https://nestjs.fr/fundamentals/lifecycle-events/)
2. `pool.end()` ferme le pool.

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `DatabaseService` | service Nest | couche d’accès PostgreSQL |
| `logger` | `Logger` | logs techniques DB |
| `pool` | `Pool` | pool de connexions PostgreSQL |
| `onModuleInit` | hook Nest | initialise le schéma |
| `onModuleDestroy` | hook Nest | ferme le pool |
| `query` | méthode utilitaire | exécute une requête simple |
| `transaction` | méthode utilitaire | exécute une transaction atomique |
| `client` | `PoolClient` | connexion dédiée à une transaction |
| `ensureSchema` | méthode privée | crée tables et index |
| `scans` | table | entité principale des scans |
| `scan_containers` | table | conteneurs liés à un scan |
| `vulnerabilities` | table | vulnérabilités par conteneur |
| `cve_updates` | table | suivi des updates CVE |
| `scan_tasks` | table | file de tâches de scan |

***

# Lecture architecturale

## 1. Service DB très bas niveau

Ce service est volontairement **simple et proche du SQL** :

- pas d’ORM,
- pas de repository abstrait,
- pas de query builder avancé,
- SQL explicite.

C’est souvent un bon choix pour un projet sécurité/outillage, car tu gardes un contrôle total sur les requêtes.

## 2. Auto-bootstrap du schéma

Le service crée lui-même ses tables/index au démarrage.  
C’est pratique pour démarrer vite, surtout dans un environnement Docker.

### Limite

Ce n’est pas un vrai système de migration versionnée.  
Si le schéma évolue fortement, un outil de migrations deviendra probablement nécessaire.

## 3. Bonne séparation requêtes simples / transactions

Le code respecte correctement la recommandation node-postgres :

- `pool.query(...)` pour les requêtes simples,
- `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` pour les transactions. [github](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/transactions.mdx)

## 4. Modèle de données cohérent

Le schéma reflète bien le métier :

- un scan,
- ses conteneurs,
- leurs vulnérabilités,
- les tâches de scan,
- les updates CVE.

On sent une chaîne logique claire entre agent → scan → conteneurs → vulnérabilités.

***

# Points d’attention techniques

## 1. Pas de configuration fine du pool

Le constructeur ne configure pas explicitement :

- `max`
- `idleTimeoutMillis`
- `connectionTimeoutMillis`

Le pool fonctionnera, mais avec les valeurs par défaut de `pg`.

## 2. Pas de retry / healthcheck explicite

Le service suppose que la DB est disponible au démarrage.  
Si PostgreSQL tarde à monter, `ensureSchema()` peut faire échouer l’initialisation.

## 3. `ensureSchema()` fait du DDL au runtime

Pratique, mais à surveiller en prod :
- concurrence de démarrage,
- évolutions de schéma,
- droits SQL nécessaires.

## 4. `transaction()` rollbacke toute erreur

C’est normal et souhaité, mais si `ROLLBACK` lui-même échoue, l’erreur finale peut masquer l’état exact. Le pattern reste malgré tout standard.

***

# Traduction simple pour débutant

Tu peux voir ce fichier comme le **pont entre NestJS et PostgreSQL**.

Il sait :

- se connecter à la base,
- exécuter une requête SQL,
- faire une transaction,
- créer automatiquement les tables si elles n’existent pas,
- fermer proprement la connexion quand l’appli s’arrête.

***

# Conclusion technique du fichier

`database.service.ts` définit un **service PostgreSQL bas niveau** pour NestJS, construit sur `pg`, avec gestion du pool, des hooks de cycle de vie, des requêtes simples, des transactions et du bootstrap de schéma. La gestion transactionnelle est correcte vis-à-vis de node-postgres, qui exige l’utilisation d’un même client pour toute la transaction, et les hooks Nest sont utilisés de façon cohérente pour l’initialisation et la fermeture des ressources. [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)

C’est une base solide pour toute la persistance de ton projet.  
***
Parfait — on continue.  
Voici le breakdown détaillé de `store.ts`.

***

# Breakdown de `store.ts`

## Vue d’ensemble

Ce fichier définit un **store en mémoire** très simple pour stocker temporairement des scans, des schedules et des triggers. Il ne s’agit pas d’une vraie base de données : les données sont conservées dans des tableaux JavaScript en mémoire vive, donc elles disparaissent au redémarrage du processus Node. [nodejs](https://nodejs.org/api/crypto.html)

Le fichier fournit aussi quelques fonctions utilitaires pour :

- ajouter un scan,
- mettre une tâche de trigger en file,
- marquer un trigger comme terminé,
- créer un schedule,
- lister les vulnérabilités à partir des scans stockés.

***

## Le code

```ts
import { randomUUID } from "crypto";
import { ScanReport, ScheduledAudit, TriggerRequest, Vulnerability } from "../common/types";
```

***

# Imports

## `randomUUID`

```ts
import { randomUUID } from "crypto";
```

### Rôle

- Générer des identifiants uniques aléatoires.
- Dans l’écosystème Node, `crypto.randomUUID()` génère un UUID v4 basé sur une source aléatoire sécurisée. [geeksforgeeks](https://www.geeksforgeeks.org/node-js/node-js-crypto-randomuuid-function/)

### Intérêt ici

Le store utilise `randomUUID()` pour générer automatiquement des IDs quand :

- un scan n’a pas encore de `scanId`,
- un trigger est créé,
- un schedule est créé.

### Exemple de sortie

Un UUID généré ressemble à :

```ts
"36b8f84d-df4e-4d49-b662-bcde71a8764f"
```

Les UUID v4 sont justement une manière standard et pratique de générer des identifiants uniques sans coordination centrale. [developer.mozilla](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)

***

## Types métier

```ts
import { ScanReport, ScheduledAudit, TriggerRequest, Vulnerability } from "../common/types";
```

### Rôle

- Importer les types métier utilisés dans le store.

### Types concernés

- `ScanReport`
- `ScheduledAudit`
- `TriggerRequest`
- `Vulnerability`

### Intérêt

Le store reste fortement typé :

- les tableaux stockent des objets métier connus,
- les fonctions exposent des signatures propres,
- TypeScript peut détecter des incohérences.

***

# Interface `InMemoryStore`

```ts
interface InMemoryStore {
  scans: ScanReport[];
  schedules: ScheduledAudit[];
  triggers: TriggerRequest[];
}
```

## Rôle

- Définir la structure de l’objet `store`.
- Centraliser les trois collections mémoire.

## Champs

### `scans: ScanReport[]`

- Tableau de rapports de scan.

### `schedules: ScheduledAudit[]`

- Tableau des audits planifiés.

### `triggers: TriggerRequest[]`

- Tableau des demandes de déclenchement de scan.

## Intérêt

Cette interface agit comme le contrat du stockage mémoire.

***

# Constante `store`

```ts
export const store: InMemoryStore = {
  scans: [],
  schedules: [],
  triggers: []
};
```

## Rôle

- Créer l’instance concrète du store en mémoire.
- Initialiser les trois collections avec des tableaux vides.

## Comportement

Au démarrage de l’application :

- `store.scans` est vide,
- `store.schedules` est vide,
- `store.triggers` est vide.

Puis ces tableaux sont modifiés au fil de l’exécution.

## Point important

Comme il s’agit d’un objet en mémoire :

- pas de persistance disque,
- pas de persistance base de données,
- pas de partage entre plusieurs processus,
- reset complet au redémarrage.

***

# Fonction `addScan`

```ts
export function addScan(scan: Omit<ScanReport, "scanId"> & { scanId?: string }): ScanReport {
  const item: ScanReport = {
    ...scan,
    scanId: scan.scanId ?? randomUUID()
  };
  store.scans.unshift(item);
  return item;
}
```

***

## Signature

### Paramètre `scan`

```ts
scan: Omit<ScanReport, "scanId"> & { scanId?: string }
```

### Rôle

- Accepter un objet “presque” `ScanReport`,
- avec `scanId` optionnel.

### Décomposition du type

#### `Omit<ScanReport, "scanId">`

`Omit` est un utility type TypeScript qui construit un nouveau type à partir d’un type existant en retirant certaines propriétés. [graphite](https://graphite.com/guides/typescript-omit-utility-type)

Ici, cela veut dire :

> “prends `ScanReport`, mais enlève la propriété `scanId`”.

#### `& { scanId?: string }`

Puis on réajoute :

- `scanId` facultatif.

### Pourquoi faire ça

Cela permet d’accepter deux cas :

- un scan fourni **sans** identifiant,
- un scan fourni **avec** un identifiant déjà défini.

***

## Variable `item`

```ts
const item: ScanReport = {
  ...scan,
  scanId: scan.scanId ?? randomUUID()
};
```

### Rôle

- Construire le vrai `ScanReport` final.

### Comportement

- recopie toutes les propriétés de `scan`,
- si `scan.scanId` existe, on le garde,
- sinon, on génère un UUID.

### `??`

L’opérateur nullish coalescing signifie :

- si `scan.scanId` est `null` ou `undefined`, prendre `randomUUID()`.

***

## Insertion dans le store

```ts
store.scans.unshift(item);
```

### Rôle

- Ajouter le scan au début du tableau.

### Pourquoi `unshift` et pas `push`

- `unshift` insère au début,
- donc les scans les plus récents apparaissent en premier.

### Effet

Si tu listes `store.scans`, tu obtiens naturellement un ordre “du plus récent au plus ancien”.

***

## Retour

```ts
return item;
```

### Rôle

- Renvoyer le scan réellement stocké.
- Très utile car il contient l’ID final garanti.

***

# Fonction `queueTrigger`

```ts
export function queueTrigger(mode: "global" | "targeted", containerIds: string[]): TriggerRequest {
  const trigger: TriggerRequest = {
    id: randomUUID(),
    mode,
    containerIds,
    createdAt: new Date().toISOString(),
    status: "queued"
  };
  store.triggers.unshift(trigger);
  return trigger;
}
```

***

## Paramètre `mode`

```ts
mode: "global" | "targeted"
```

### Rôle

- Limiter le mode à deux valeurs exactes :
  - `"global"`
  - `"targeted"`

### Intérêt

C’est une union littérale TypeScript très simple et très utile :

- pas de faute de frappe libre,
- pas de valeur métier invalide.

***

## Paramètre `containerIds`

```ts
containerIds: string[]
```

### Rôle

- Représenter la liste des conteneurs ciblés.
- Pour un trigger global, la liste peut potentiellement être vide ou ignorée selon le métier.

***

## Variable `trigger`

```ts
const trigger: TriggerRequest = {
  id: randomUUID(),
  mode,
  containerIds,
  createdAt: new Date().toISOString(),
  status: "queued"
};
```

### Rôle

- Construire une nouvelle demande de déclenchement.

### Champs

#### `id`

- UUID du trigger

#### `mode`

- `"global"` ou `"targeted"`

#### `containerIds`

- liste des conteneurs ciblés

#### `createdAt`

- timestamp ISO de création

#### `status: "queued"`

- état initial de la demande

***

## Insertion

```ts
store.triggers.unshift(trigger);
```

### Rôle

- Ajouter le trigger en tête de liste.

***

## Retour

```ts
return trigger;
```

### Rôle

- Renvoyer l’objet effectivement stocké.

***

# Fonction `markTriggerDone`

```ts
export function markTriggerDone(id: string): void {
  const target = store.triggers.find((item) => item.id === id);
  if (target) {
    target.status = "done";
  }
}
```

## Paramètre `id`

- Type : `string`
- ID du trigger à marquer comme terminé.

***

## Variable `target`

```ts
const target = store.triggers.find((item) => item.id === id);
```

### Rôle

- Rechercher dans le tableau le trigger correspondant à l’ID demandé.

### `find(...)`

- `find` renvoie le premier élément correspondant,
- ou `undefined` si aucun n’est trouvé.

***

## Mise à jour

```ts
if (target) {
  target.status = "done";
}
```

### Rôle

- Si le trigger existe, muter son statut.

### Important

La mise à jour se fait **en place**, directement sur l’objet déjà présent dans `store.triggers`.

### Si l’ID n’existe pas

- la fonction ne fait rien,
- aucune erreur n’est levée.

***

# Fonction `upsertSchedule`

```ts
export function upsertSchedule(schedule: Omit<ScheduledAudit, "id" | "createdAt">): ScheduledAudit {
  const created: ScheduledAudit = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...schedule
  };
  store.schedules.unshift(created);
  return created;
}
```

## Point important sur le nom

Le nom `upsertSchedule` est un peu trompeur.

### Pourquoi

Un vrai **upsert** signifie généralement :

- update si l’objet existe déjà,
- insert sinon.

Or ici, la fonction :

- crée toujours un nouvel ID,
- crée toujours une nouvelle date,
- insère toujours un nouvel objet en tête du tableau.

Donc en pratique, cette fonction fait surtout un **insert** et non un vrai upsert.

***

## Paramètre `schedule`

```ts
Omit<ScheduledAudit, "id" | "createdAt">
```

### Rôle

- Accepter un schedule sans `id` ni `createdAt`,
- car ces champs seront générés automatiquement.

### Intérêt

L’appelant fournit les données métier,
le store complète les métadonnées techniques.

***

## Variable `created`

```ts
const created: ScheduledAudit = {
  id: randomUUID(),
  createdAt: new Date().toISOString(),
  ...schedule
};
```

### Rôle

- Construire l’objet final stockable.

### Champs générés

- `id`
- `createdAt`

***

## Insertion

```ts
store.schedules.unshift(created);
```

### Rôle

- Ajouter le schedule au début du tableau.

***

## Retour

```ts
return created;
```

### Rôle

- Renvoyer l’objet complet nouvellement créé.

***

# Fonction `listVulnerabilities`

```ts
export function listVulnerabilities(containerId?: string, severity?: Vulnerability["severity"]): Vulnerability[] {
  const vulnerabilities = store.scans.flatMap((scan) =>
    scan.containers.flatMap((container) =>
      container.vulnerabilities
        .filter((vuln) => (severity ? vuln.severity === severity : true))
        .filter(() => (containerId ? container.containerId === containerId : true))
    )
  );

  return vulnerabilities;
}
```

Cette fonction est la plus intéressante du fichier côté transformation de données.

***

## Signature

### Paramètre `containerId?: string`

- Optionnel
- Si fourni, filtre les vulnérabilités d’un conteneur précis

### Paramètre `severity?: Vulnerability["severity"]`

- Optionnel
- Si fourni, filtre les vulnérabilités selon leur niveau de sévérité

### Type `Vulnerability["severity"]`

Cela signifie :

- “prendre le type de la propriété `severity` dans le type `Vulnerability`”.

### Intérêt

Si `severity` est définie dans `Vulnerability` comme une union du genre :

```ts
"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
```

alors ce paramètre reprend exactement ce même type.

***

## Variable `vulnerabilities`

```ts
const vulnerabilities = store.scans.flatMap((scan) =>
  scan.containers.flatMap((container) =>
    container.vulnerabilities
      .filter((vuln) => (severity ? vuln.severity === severity : true))
      .filter(() => (containerId ? container.containerId === containerId : true))
  )
);
```

### Rôle global

- Parcourir tous les scans,
- puis tous leurs conteneurs,
- puis toutes leurs vulnérabilités,
- pour renvoyer une seule liste plate filtrée.

***

## Premier `flatMap`

```ts
store.scans.flatMap((scan) => ...)
```

### Rôle

- Pour chaque scan, produire une liste de vulnérabilités,
- puis aplatir le résultat en un seul tableau.

`flatMap()` correspond conceptuellement à un `map(...).flat(1)` : on transforme chaque élément puis on aplatit d’un niveau. [dev](https://dev.to/jkap100/using-the-javascript-array-method-flatmap-1534)

***

## Deuxième `flatMap`

```ts
scan.containers.flatMap((container) => ...)
```

### Rôle

- Pour chaque conteneur, récupérer sa liste de vulnérabilités filtrées,
- puis tout aplatir encore.

### Résultat final

On passe de :

- plusieurs scans,
- contenant plusieurs conteneurs,
- contenant plusieurs vulnérabilités,

à :

- **une seule liste plate** de vulnérabilités.

***

## Premier `filter`

```ts
.filter((vuln) => (severity ? vuln.severity === severity : true))
```

### Rôle

- Si `severity` est fournie, garder seulement les vulnérabilités de cette sévérité.
- Sinon, tout garder.

### Exemple

- `severity = "HIGH"` → seules les HIGH passent
- `severity = undefined` → tout passe

***

## Deuxième `filter`

```ts
.filter(() => (containerId ? container.containerId === containerId : true))
```

### Rôle

- Si `containerId` est fourni, ne garder que les vulnérabilités du conteneur ciblé.
- Sinon, tout garder.

### Détail

Ici, le callback ne regarde pas directement l’élément vulnérabilité, mais le `container` englobant.

### Remarque de style

Ce filtre fonctionne, mais il pourrait être plus lisible en filtrant plus tôt au niveau des conteneurs, par exemple avant d’entrer dans `container.vulnerabilities`.

***

## Retour

```ts
return vulnerabilities;
```

### Rôle

- Renvoyer la liste finale plate et filtrée.

***

# Flux global du fichier

Ce fichier expose un mini stockage mémoire avec trois collections :

- `scans`
- `schedules`
- `triggers`

Puis des opérations simples dessus :

1. `addScan(...)` → ajoute un scan
2. `queueTrigger(...)` → ajoute un trigger en file
3. `markTriggerDone(...)` → passe un trigger à `done`
4. `upsertSchedule(...)` → crée un schedule
5. `listVulnerabilities(...)` → extrait toutes les vulnérabilités filtrées des scans stockés

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `InMemoryStore` | interface | structure du stockage mémoire |
| `store` | objet singleton | contient les tableaux en mémoire |
| `store.scans` | `ScanReport[]` | scans stockés |
| `store.schedules` | `ScheduledAudit[]` | audits planifiés stockés |
| `store.triggers` | `TriggerRequest[]` | déclenchements stockés |
| `addScan` | fonction | ajoute un scan avec ID auto si besoin |
| `queueTrigger` | fonction | crée un trigger en file |
| `markTriggerDone` | fonction | marque un trigger comme terminé |
| `upsertSchedule` | fonction | crée un schedule avec ID/date auto |
| `listVulnerabilities` | fonction | extrait les vulnérabilités filtrées |
| `randomUUID` | fonction crypto | génère des UUID v4 |
| `Omit` | utility type TS | retire des propriétés d’un type |
| `flatMap` | méthode JS | mappe puis aplatit le résultat |

***

# Lecture architecturale

## 1. Store mémoire temporaire

Le fichier joue le rôle d’un petit repository local, mais sans vraie persistance.  
C’est bien pour :

- un prototype,
- des tests,
- une démo,
- un fallback temporaire.

Ce n’est pas adapté à une vraie prod si les données doivent survivre à un restart.

## 2. API fonctionnelle simple

Le choix ici est d’exposer des **fonctions pures-ish autour d’un singleton mutable** plutôt qu’une classe `StoreService`.

### Intérêt

- très simple,
- zéro DI,
- facile à importer.

### Limite

- plus difficile à mocker proprement dans une architecture Nest,
- partage global implicite,
- état mutable global.

## 3. Mélange lecture/écriture minimaliste

Le store est rudimentaire :

- pas de suppression,
- pas de pagination,
- pas de recherche avancée,
- pas de verrouillage,
- pas de persistance.

Mais pour une maquette métier ou un mode dev, c’est souvent suffisant.

***

# Points d’attention

## 1. `upsertSchedule` n’est pas un vrai upsert

Le nom suggère update-or-insert, mais le comportement est un insert systématique.

## 2. Pas de persistance

Toutes les données sont perdues au redémarrage.

## 3. État global mutable

Comme `store` est exporté, n’importe quel fichier peut en théorie le modifier directement.

## 4. `listVulnerabilities` parcourt tout

La fonction reparcourt tous les scans et conteneurs à chaque appel.  
C’est acceptable en mémoire sur petit volume, mais pas optimal si ça grossit.

## 5. Pas de protection concurrence/process multiples

Si l’application tourne sur plusieurs instances, chaque instance aura son propre store mémoire isolé.

***

# Traduction simple pour débutant

Tu peux voir ce fichier comme un **mini faux back-end de stockage** :

- `store` = les boîtes où on range les données
- `addScan` = ajoute un scan
- `queueTrigger` = ajoute une demande de scan
- `markTriggerDone` = marque la demande comme finie
- `upsertSchedule` = ajoute un planning
- `listVulnerabilities` = ressort toutes les vulnérabilités selon des filtres

C’est comme une petite base de données, sauf que tout reste juste dans la RAM du programme.

***

# Conclusion technique du fichier

`store.ts` définit un **store en mémoire** basé sur un singleton mutable et quelques fonctions utilitaires. Il s’appuie sur `randomUUID()` pour générer des identifiants, sur `Omit` pour ajuster les types d’entrée, et sur `flatMap()` pour extraire les vulnérabilités d’une structure imbriquée scans → conteneurs → vulnérabilités. [developer.mozilla](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap)

C’est une implémentation simple et pratique pour du prototypage ou du dev, mais pas une solution de persistance durable.

***
`auth.module.ts` définit simplement un **module NestJS vide** nommé `AuthModule`. Un module Nest est une classe décorée avec `@Module()` que le framework utilise pour organiser l’application en scopes logiques de controllers, providers et imports/exports. [docs.nestjs](https://docs.nestjs.com/modules)

***

## Le code

```ts
import { Module } from "@nestjs/common";


@Module({})
export class AuthModule {}
```

***

## Import `Module`

```ts
import { Module } from "@nestjs/common";
```

### Rôle

- Importer le décorateur `@Module()` de NestJS.
- C’est ce décorateur qui transforme une classe ordinaire en module Nest reconnu par le framework. [codesignal](https://codesignal.com/learn/courses/nestjs-basics/lessons/modules-in-nestjs)

### Ce que Nest attend d’un module

Un module peut déclarer dans son metadata object :

- `imports`
- `providers`
- `controllers`
- `exports`

Ici, aucun de ces champs n’est renseigné, donc le module est valide mais vide. [nestjs](https://nestjs.fr/modules/)

***

## Décorateur `@Module({})`

```ts
@Module({})
```

### Rôle

- Déclarer la classe qui suit comme un module NestJS.
- Le décorateur reçoit ici un objet de configuration vide.

### Ce que ça signifie concrètement

Le module ne déclare actuellement :

- aucun provider,
- aucun controller,
- aucun import,
- aucun export.

C’est autorisé : un module Nest peut exister comme conteneur logique même s’il ne contient encore rien. [docs.nestjs](https://docs.nestjs.com/modules)

### Lecture architecturale

Ce genre de module apparaît souvent dans trois cas :

- on prépare une future zone fonctionnelle,
- on veut garder une architecture modulaire propre dès le début,
- le contenu du module sera ajouté plus tard.

***

## Classe `AuthModule`

```ts
export class AuthModule {}
```

### Rôle

- Définir la classe représentant le module d’authentification.
- La classe est vide, ce qui est normal pour un module simple.

### Pourquoi elle est vide

Dans Nest, la logique de composition du module est portée par le décorateur `@Module(...)`, pas par des méthodes dans la classe elle-même. [github](https://github.com/nestjs/nest/blob/master/packages/common/decorators/modules/module.decorator.ts)

### `export`

- Rend le module importable ailleurs, typiquement dans `AppModule`.

***

## Ce que fait réellement ce fichier

Pour l’instant, ce fichier dit seulement :

> “il existe un module logique appelé `AuthModule`”.

Mais en l’état, il ne fait encore rien de concret, car il ne contient aucun composant enregistré. [nestjs](https://nestjs.fr/modules/)

***

## Ce qu’on s’attendrait souvent à voir plus tard

Dans un vrai module d’auth, on retrouve souvent :

- des guards,
- des services d’auth,
- éventuellement un controller `/auth`,
- des stratégies JWT ou Passport,
- des exports de guards/services réutilisables.

Par exemple, un `AuthModule` plus rempli pourrait ressembler à :

```ts
@Module({
  providers: [BasicAuthGuard, RolesGuard],
  exports: [BasicAuthGuard, RolesGuard],
})
export class AuthModule {}
```

ou inclure un `AuthService` et un `AuthController`, selon l’architecture choisie. Nest structure généralement l’application en feature modules pour regrouper les composants liés à un domaine fonctionnel. [codesignal](https://codesignal.com/learn/courses/nestjs-basics/lessons/modules-in-nestjs)

***

## Lecture par rapport à ton projet

Vu les fichiers que tu as déjà montrés :

- `basic-auth.guard.ts`
- `role.guard.ts`
- `role.decorator.ts`
- `role.enum.ts`
- `request-with-user.ts`

on pourrait s’attendre à ce que ce module soit, plus tard, le point de regroupement naturel de ces briques d’auth/autorisation. En l’état, elles semblent exister dans le projet, mais `AuthModule` ne les déclare pas encore. [vaduoconsulting](https://vaduoconsulting.com/blog/articles/amliorez-vos-endpoints-api---dcouvrez-les-dcorateurs-et-guards-nestjs/)

***

## Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `Module` | décorateur Nest | déclare un module |
| `@Module({})` | metadata vide | module valide mais sans contenu |
| `AuthModule` | classe module | conteneur logique pour l’auth |
| `export` | mot-clé TS | rend le module importable ailleurs |

***

## Traduction simple

Tu peux voir ce fichier comme une **boîte d’auth vide** :

- la boîte existe,
- elle a un nom,
- mais elle ne contient encore aucun outil.

C’est donc surtout un **placeholder architectural** pour organiser le code proprement.

***

## Conclusion technique

`auth.module.ts` définit un **module NestJS vide** nommé `AuthModule`. Un module Nest organise l’application en unités logiques via `@Module()`, et un objet metadata vide signifie simplement que ce module n’enregistre encore aucun controller, provider, import ou export. [docs.nestjs](https://docs.nestjs.com/modules)

Ici, le fichier sert surtout de squelette d’architecture, probablement destiné à accueillir plus tard les composants d’authentification et d’autorisation du projet.
***
Parfait — ici on change un peu de style de code, car on est sur **Express pur** et non sur NestJS, mais la logique d’explication reste la même.

***

# Breakdown de `routes.ts`

## Vue d’ensemble

Ce fichier définit un **router Express** dédié à l’authentification, avec une route `GET /me` protégée par un middleware `authenticate`. En Express, `express.Router()` permet de créer des groupes de routes modulaires et montables, et les middlewares peuvent être attachés au niveau d’une route pour exécuter une logique avant le handler final. [expressjs](https://expressjs.com/en/guide/using-middleware.html)

Concrètement, cette route renvoie des informations sur l’utilisateur authentifié courant, ici :

- `subject`
- `role`

***

## Le code

```ts
import { Router } from "express";
import { authenticate } from "../../common/auth";


export const authRouter = Router();


authRouter.get("/me", authenticate, (req, res) => {
  res.json({
    subject: req.auth?.subject,
    role: req.auth?.role
  });
});
```

***

# Imports

## `Router`

```ts
import { Router } from "express";
```

### Rôle

- Importer le constructeur de router d’Express.
- `Router()` crée une instance de routeur modulaire.

### Intérêt

Au lieu de définir toutes les routes directement dans `app`, on peut les organiser par domaine :

- auth
- scans
- reports
- admin

Express présente `Router` comme un système complet de middleware et de routing montable dans l’application. [expressjs](https://expressjs.com/en/guide/routing.html)

***

## `authenticate`

```ts
import { authenticate } from "../../common/auth";
```

### Rôle

- Importer un middleware d’authentification personnalisé.
- Ce middleware est exécuté avant le handler de `/me`.

### Ce qu’on peut déduire

Même sans voir son code, on comprend qu’il sert probablement à :

- vérifier l’identité du client,
- enrichir `req` avec des informations d’auth,
- probablement via `req.auth`.

### Point important

Le handler utilise `req.auth?.subject` et `req.auth?.role`, donc `authenticate` semble injecter une propriété `auth` dans la requête.

Ajouter une propriété personnalisée à `req` est un pattern très courant en Express avec TypeScript, soit via un type dédié, soit via declaration merging. [dev](https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5)

***

# Constante `authRouter`

```ts
export const authRouter = Router();
```

## Rôle

- Créer une instance de routeur Express dédiée aux routes d’auth.
- L’export permet de l’importer ensuite dans l’application principale.

### Exemple d’usage probable

Dans un fichier principal, on pourrait voir quelque chose comme :

```ts
app.use("/auth", authRouter);
```

ou :

```ts
app.use("/api/auth", authRouter);
```

### Effet

Si le router est monté sur `/auth`, alors la route définie plus bas :

```ts
"/me"
```

deviendra :

```ts
/auth/me
```

Le principe de montage des routeurs est justement central dans Express. [expressjs](https://expressjs.com/en/guide/using-middleware.html)

***

# Route `GET /me`

```ts
authRouter.get("/me", authenticate, (req, res) => {
  res.json({
    subject: req.auth?.subject,
    role: req.auth?.role
  });
});
```

C’est la partie fonctionnelle du fichier.

***

## `authRouter.get(...)`

### Rôle

- Déclarer une route HTTP GET sur le chemin `"/me"`.

### Ce que ça signifie

Cette route répondra à une requête GET sur l’URL du router monté + `/me`.

### Exemple

Si `authRouter` est monté sur `/auth`, alors :

- `GET /auth/me`

renverra les informations du sujet courant.

***

## Middleware `authenticate`

```ts
authenticate
```

### Rôle

- Exécuter l’authentification avant le handler final.
- Si l’auth échoue, le middleware peut probablement :
  - couper la requête,
  - renvoyer une erreur,
  - ou ne pas appeler `next()`.

### Si l’auth réussit

On peut déduire qu’il place des infos sur la requête, probablement :

```ts
req.auth = {
  subject: ...,
  role: ...
}
```

### Importance

Sans ce middleware, `req.auth` n’aurait probablement pas de valeur fiable.

En Express, les middlewares route-level sont justement conçus pour exécuter une logique avant le handler final d’une route. [w3schools](https://www.w3schools.com/nodejs/nodejs_middleware.asp)

***

## Handler `(req, res) => { ... }`

```ts
(req, res) => {
  res.json({
    subject: req.auth?.subject,
    role: req.auth?.role
  });
}
```

### Paramètres

- `req` : objet requête Express
- `res` : objet réponse Express

Dans Express, `req` représente la requête entrante et `res` l’objet utilisé pour construire la réponse HTTP. [stackoverflow](https://stackoverflow.com/questions/4696283/what-are-res-and-req-parameters-in-express-functions)

***

# Réponse JSON

```ts
res.json({
  subject: req.auth?.subject,
  role: req.auth?.role
});
```

## `res.json(...)`

### Rôle

- Envoyer une réponse JSON au client.
- `res.json()` sérialise l’objet fourni en JSON et envoie la réponse avec le bon content type. [geeksforgeeks](https://www.geeksforgeeks.org/web-tech/express-js-res-json-function/)

### Objet renvoyé

```ts
{
  subject: req.auth?.subject,
  role: req.auth?.role
}
```

### Contenu

- `subject` : sujet authentifié courant
- `role` : rôle courant

### Interprétation métier

Cette route est une route “**who am I**” :

- elle permet au client de savoir qui il est selon le backend,
- pratique pour vérifier une session, un token ou un contexte d’auth.

C’est une route très classique dans les APIs d’auth.

***

# Optional chaining sur `req.auth`

```ts
req.auth?.subject
req.auth?.role
```

## Rôle

- Lire `subject` et `role` seulement si `req.auth` existe.
- Si `req.auth` est `undefined`, l’expression renvoie `undefined` au lieu de lever une erreur.

### Pourquoi c’est utile

Cela évite un crash du type :

```ts
Cannot read properties of undefined
```

### Mais en pratique

Comme la route passe par `authenticate`, on s’attend normalement à ce que `req.auth` soit bien présent si l’auth réussit.  
Donc l’optional chaining joue ici surtout un rôle de sécurité défensive.

***

# Ce que fait exactement cette route

## Flux complet

1. Le client appelle `GET /.../me`.
2. Express exécute le middleware `authenticate`. [w3schools](https://www.w3schools.com/nodejs/nodejs_middleware.asp)
3. Si l’auth passe :
   - le handler final est exécuté.
4. Le handler lit `req.auth`.
5. Le backend renvoie :

```json
{
  "subject": "...",
  "role": "..."
}
```

***

# Ce qu’on peut déduire sur `req.auth`

Le code suggère qu’un type ou un enrichissement de requête existe quelque part, probablement sous une forme proche de :

```ts
req.auth = {
  subject: string,
  role: string
}
```

ou un type plus précis.

### Important

Ce n’est pas natif à Express.  
La propriété `auth` est très probablement ajoutée par le middleware `authenticate` et typée manuellement dans le projet. Étendre la requête Express avec une propriété personnalisée est une pratique très courante en TypeScript. [darraghoriordan](https://www.darraghoriordan.com/2023/08/14/custom-request-response-express-typescript)

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `Router` | API Express | crée un routeur modulaire |
| `authRouter` | instance de router | groupe les routes d’auth |
| `authenticate` | middleware | protège la route et enrichit la requête |
| `"/me"` | chemin de route | endpoint de profil/auth courant |
| `req` | requête Express | contient les données de la requête |
| `res` | réponse Express | envoie la réponse HTTP |
| `req.auth` | propriété custom | contexte d’auth injecté par middleware |
| `subject` | champ métier | identité logique du principal |
| `role` | champ métier | rôle du principal |
| `res.json(...)` | méthode Express | envoie une réponse JSON |

***

# Lecture architecturale

## 1. Route de self-introspection

Cette route sert à exposer l’identité courante vue par le serveur.  
C’est très utile pour :

- tester un token,
- alimenter un front,
- vérifier l’état d’authentification.

## 2. Middleware avant handler

L’authentification est séparée du handler métier :

- `authenticate` s’occupe de l’accès,
- le handler s’occupe juste de répondre.

C’est une séparation propre et idiomatique en Express. [dev](https://dev.to/romulogatto/expressjs-middleware-and-routing-advanced-concepts-56h9)

## 3. Code très léger

Le handler est minimaliste :

- aucune logique métier complexe,
- pas de DB,
- juste lecture de `req.auth` et réponse JSON.

C’est bon signe : la responsabilité de la route est très claire.

***

# Traduction simple pour débutant

Tu peux voir cette route comme :

> “dis-moi qui je suis”.

Le client appelle `/me`, le middleware vérifie qu’il est authentifié, puis le serveur répond avec :

- son identifiant logique (`subject`)
- son rôle (`role`)

***

# Exemple concret

## Requête

```http
GET /auth/me
Authorization: Bearer abc123
```

## Si `authenticate` valide le token et met :

```ts
req.auth = {
  subject: "admin",
  role: "admin"
}
```

alors la réponse sera :

```json
{
  "subject": "admin",
  "role": "admin"
}
```

***

# Conclusion technique

`routes.ts` définit un **router Express d’authentification** avec une route `GET /me` protégée par le middleware `authenticate`. Le routeur Express permet de regrouper des routes modulaires, le middleware s’exécute avant le handler, et `res.json()` envoie la réponse JSON contenant `subject` et `role` lus depuis une propriété personnalisée `req.auth`. [expressjs](https://expressjs.com/en/guide/routing.html)

C’est une route simple, propre, et typique d’une API qui expose l’identité courante du client authentifié.


Je me suis arreté a routes.ts
***
Oui, là c’est bien un vrai **controller NestJS**.  
Je te fais le breakdown complet de ce `ReportsController`.

***

# Breakdown de `reports.controller.ts`

## Vue d’ensemble

Ce fichier définit un **controller NestJS** exposant des endpoints HTTP sous le préfixe `/api/reports`. Dans NestJS, un controller regroupe les handlers de routes entrantes, et les décorateurs comme `@Controller()`, `@Get()`, `@Param()` et `@UseGuards()` servent à déclarer les routes, les paramètres et les protections d’accès. [docs.nestjs](https://docs.nestjs.com/guards)

Ici, le controller :
- dépend de `ReportsService`,
- protège toutes ses routes avec `BasicAuthGuard` et `RolesGuard`,
- autorise seulement les rôles `ADMIN` et `VIEWER`,
- expose trois endpoints :
  - `GET /api/reports/overview`
  - `GET /api/reports/matrix`
  - `GET /api/reports/details/:containerId`

***

## Le code

```ts
import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ReportsService } from "./reports.service";

@Controller("api/reports")
@UseGuards(BasicAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.VIEWER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  getOverview() {
    return this.reportsService.getOverview();
  }

  @Get("matrix")
  getMatrix() {
    return this.reportsService.getMatrix();
  }

  @Get("details/:containerId")
  getContainerDetails(@Param("containerId") containerId: string) {
    return this.reportsService.getContainerDetails(containerId);
  }
}
```

***

# Imports

## `Controller`

```ts
import { Controller, Get, Param, UseGuards } from "@nestjs/common";
```

### Rôle

- `Controller` est le décorateur NestJS qui déclare une classe comme contrôleur HTTP.
- Il permet d’associer un préfixe de route à toute la classe. [docs.nestjs](https://docs.nestjs.com/controllers)

### Ici

```ts
@Controller("api/reports")
```

signifie que toutes les routes de cette classe commencent par `/api/reports`.

***

## `Get`

### Rôle

- Décorateur NestJS pour déclarer un handler HTTP GET.
- Il associe une méthode de classe à une route GET donnée. [docs.nest-js](https://docs.nest-js.fr/controllers)

### Exemple ici

- `@Get("overview")`
- `@Get("matrix")`
- `@Get("details/:containerId")`

***

## `Param`

### Rôle

- Décorateur NestJS qui injecte un paramètre de route dans la méthode.
- Il permet d’accéder à une variable dynamique présente dans l’URL. [dev](https://dev.to/wakeup_flower_8591a6cb6a9/parameter-decorators-in-nestjs-2l5f)

### Exemple ici

```ts
@Param("containerId") containerId: string
```

récupère la valeur de `:containerId` depuis l’URL.

***

## `UseGuards`

### Rôle

- Décorateur NestJS qui attache un ou plusieurs guards à un controller ou à une méthode.
- Quand il est placé au niveau classe, il s’applique à tous les handlers du controller. [github](https://github.com/nestjs/nest/blob/master/packages/common/decorators/core/use-guards.decorator.ts)

### Ici

```ts
@UseGuards(BasicAuthGuard, RolesGuard)
```

veut dire que les deux guards seront exécutés pour chaque route du controller.

***

## `Roles`

```ts
import { Roles } from "../../common/decorators/roles.decorator";
```

### Rôle

- Décorateur personnalisé qui attache une metadata de rôles à la cible.
- Cette metadata est ensuite lue par `RolesGuard`. C’est le pattern RBAC classique NestJS. [stackoverflow](https://stackoverflow.com/questions/60254371/authentication-roles-with-guards-decorators-how-to-pass-user-object)

***

## `Role`

```ts
import { Role } from "../../common/enums/role.enum";
```

### Rôle

- Enum des rôles applicatifs.
- Ici, il sert à déclarer les rôles autorisés pour ce controller.

***

## `BasicAuthGuard`

### Rôle

- Guard d’authentification.
- Il valide la requête, extrait le token Bearer, et injecte probablement `req.user`.

### Dans ton projet

On l’a déjà analysé : il affecte par exemple :

```ts
req.user = { role: Role.ADMIN, subject: "admin" };
```

***

## `RolesGuard`

### Rôle

- Guard d’autorisation.
- Il lit la metadata `@Roles(...)` et vérifie que `req.user.role` fait partie des rôles autorisés. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-nestjs-guards-authorization/view)

***

## `ReportsService`

```ts
import { ReportsService } from "./reports.service";
```

### Rôle

- Service métier chargé de produire les données des rapports.
- Le controller lui délègue toute la logique métier.

### Intérêt architectural

C’est très propre : le controller gère la couche HTTP, le service gère la logique métier. En Nest, les controllers consomment généralement des providers/services via injection de dépendances. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

***

# Décorateur `@Controller("api/reports")`

```ts
@Controller("api/reports")
```

## Rôle

- Définir le préfixe de route du controller.

## Effet

Toutes les routes déclarées dans cette classe commenceront par :

```ts
/api/reports
```

### Exemples

- `@Get("overview")` → `GET /api/reports/overview`
- `@Get("matrix")` → `GET /api/reports/matrix`
- `@Get("details/:containerId")` → `GET /api/reports/details/:containerId`

Les controllers Nest permettent précisément ce regroupement des routes sous un préfixe commun. [blog.logrocket](https://blog.logrocket.com/understanding-controllers-routes-nestjs/)

***

# Décorateur `@UseGuards(BasicAuthGuard, RolesGuard)`

```ts
@UseGuards(BasicAuthGuard, RolesGuard)
```

## Rôle

- Attacher deux guards à tout le controller.
- Les deux s’exécutent avant chaque handler.

## Logique

1. `BasicAuthGuard` authentifie la requête.
2. `RolesGuard` vérifie que le rôle est autorisé.

### Pourquoi cet ordre a du sens

`RolesGuard` dépend de `req.user`, qui est fourni par `BasicAuthGuard`.  
Donc il faut d’abord authentifier, puis autoriser.

### Portée

Comme le décorateur est placé sur la classe, il s’applique à :

- `getOverview()`
- `getMatrix()`
- `getContainerDetails()`

Nest documente bien que `@UseGuards()` au niveau controller applique les guards à tous les handlers de la classe. [docs.nestjs](https://docs.nestjs.com/guards)

***

# Décorateur `@Roles(Role.ADMIN, Role.VIEWER)`

```ts
@Roles(Role.ADMIN, Role.VIEWER)
```

## Rôle

- Déclarer que toutes les routes du controller exigent l’un des rôles :
  - `ADMIN`
  - `VIEWER`

## Effet

Si `req.user.role` vaut :

- `Role.ADMIN` → accès autorisé
- `Role.VIEWER` → accès autorisé
- `Role.AGENT` → accès refusé

### Important

Comme ce décorateur est au niveau classe, toute la classe hérite de cette restriction, sauf si une méthode la surcharge avec un autre `@Roles(...)`. Le pattern méthode > classe est justement celui géré par `Reflector.getAllAndOverride(...)` dans ton `RolesGuard`. [docs.nestjs](https://docs.nestjs.com/security/authorization)

***

# Classe `ReportsController`

```ts
export class ReportsController {
```

## Rôle

- Définir le controller des rapports.
- Il regroupe les endpoints de consultation/reporting.

***

# Constructeur

```ts
constructor(private readonly reportsService: ReportsService) {}
```

## Variable / propriété

- `reportsService` : instance injectée de `ReportsService`.

## Rôle

- Permettre au controller d’appeler la logique métier du service.

## Injection de dépendance

Nest utilise l’injection de dépendances pour instancier le service et l’injecter automatiquement dans le controller, à condition qu’il soit enregistré comme provider dans le module. [docs.nestjs](https://docs.nestjs.com/providers)

## Intérêt

Le controller ne calcule rien lui-même, il délègue :

- `getOverview()` → `reportsService.getOverview()`
- `getMatrix()` → `reportsService.getMatrix()`
- `getContainerDetails()` → `reportsService.getContainerDetails(containerId)`

C’est une très bonne séparation des responsabilités.

***

# Méthode `getOverview`

```ts
@Get("overview")
getOverview() {
  return this.reportsService.getOverview();
}
```

## Route

- `GET /api/reports/overview`

## Rôle

- Exposer un endpoint de vue d’ensemble des rapports.

## Comportement

- Appelle directement `reportsService.getOverview()`
- Retourne son résultat au client

## Lecture métier probable

Cette route sert probablement à fournir des données agrégées :
- résumé global,
- totaux,
- métriques haut niveau,
- état général des scans ou vulnérabilités.

***

# Méthode `getMatrix`

```ts
@Get("matrix")
getMatrix() {
  return this.reportsService.getMatrix();
}
```

## Route

- `GET /api/reports/matrix`

## Rôle

- Exposer un endpoint de matrice de reporting.

## Comportement

- Appelle `reportsService.getMatrix()`
- Retourne le résultat brut

## Lecture métier probable

Le mot **matrix** suggère une représentation croisée de données, par exemple :
- sévérité × conteneur,
- image × vulnérabilités,
- catégorie × état,
- score × exposition.

Le détail exact dépend du service.

***

# Méthode `getContainerDetails`

```ts
@Get("details/:containerId")
getContainerDetails(@Param("containerId") containerId: string) {
  return this.reportsService.getContainerDetails(containerId);
}
```

## Route

- `GET /api/reports/details/:containerId`

### Exemple

- `GET /api/reports/details/container-123`

***

## Paramètre `@Param("containerId")`

### Rôle

- Extraire la valeur du segment dynamique `:containerId` de l’URL.
- La stocker dans la variable `containerId`.

Nest documente `@Param('token')` comme la manière standard d’accéder à un paramètre de route précis. [docs.nestjs](https://docs.nestjs.com/controllers)

***

## Comportement

- Reçoit l’ID de conteneur depuis l’URL
- appelle :

```ts
this.reportsService.getContainerDetails(containerId)
```

- retourne le détail du conteneur demandé

## Lecture métier probable

Cette route sert probablement à consulter :
- les métadonnées du conteneur,
- ses vulnérabilités,
- son image,
- son état,
- son historique ou ses détails de scan.

***

# Flux complet d’une requête

Prenons `GET /api/reports/details/abc123`.

## Étapes

1. La requête arrive sur `ReportsController`. [docs.nestjs](https://docs.nestjs.com/controllers)
2. `BasicAuthGuard` s’exécute :
   - lit le token,
   - valide la requête,
   - injecte `req.user`. [docs.nestjs](https://docs.nestjs.com/guards)
3. `RolesGuard` s’exécute :
   - lit `@Roles(Role.ADMIN, Role.VIEWER)`,
   - vérifie `req.user.role`. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-nestjs-guards-authorization/view)
4. Si l’utilisateur a le bon rôle :
   - Nest appelle `getContainerDetails(...)`.  
5. `@Param("containerId")` extrait `abc123`. [docs.nestjs](https://docs.nestjs.com/controllers)
6. La méthode appelle `reportsService.getContainerDetails("abc123")`.  
7. Le résultat est renvoyé en HTTP.

***

# Variables / éléments importants

| Élément | Type logique | Rôle |
|---|---|---|
| `ReportsController` | controller Nest | expose les routes de reporting |
| `@Controller("api/reports")` | décorateur | définit le préfixe de route |
| `@UseGuards(...)` | décorateur | protège toutes les routes du controller |
| `BasicAuthGuard` | guard | authentifie la requête |
| `RolesGuard` | guard | vérifie les rôles autorisés |
| `@Roles(Role.ADMIN, Role.VIEWER)` | décorateur custom | déclare les rôles autorisés |
| `reportsService` | service injecté | contient la logique métier |
| `@Get("overview")` | route GET | retourne la vue d’ensemble |
| `@Get("matrix")` | route GET | retourne une matrice de reporting |
| `@Get("details/:containerId")` | route GET paramétrée | retourne le détail d’un conteneur |
| `@Param("containerId")` | décorateur de paramètre | extrait l’ID de conteneur de l’URL |

***

# Lecture architecturale

## 1. Très bonne séparation des responsabilités

Ce controller est proprement structuré :

- le controller gère HTTP + sécurité déclarative,
- les guards gèrent auth et autorisation,
- le service gère la logique métier.

C’est exactement l’architecture idiomatique NestJS. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

## 2. Sécurité appliquée au niveau classe

Le choix d’appliquer `@UseGuards(...)` et `@Roles(...)` au niveau controller est bon ici, car toutes les routes du controller semblent partager les mêmes contraintes d’accès. Nest permet justement ce scope classe pour éviter de répéter les décorateurs sur chaque méthode. [github](https://github.com/nestjs/nest/blob/master/packages/common/decorators/core/use-guards.decorator.ts)

## 3. Endpoint de lecture réservé aux humains

Le fait d’autoriser `ADMIN` et `VIEWER`, mais pas `AGENT`, suggère que ce controller sert à la consultation/reporting côté utilisateur humain, pas à l’agent technique de scan. C’est cohérent avec le nom `ReportsController`.

## 4. Controller fin, service épais

Chaque méthode du controller délègue directement au service sans logique parasite. C’est généralement un très bon signe de design.

***

# Traduction simple pour débutant

Tu peux voir ce controller comme :

> “la porte d’entrée HTTP pour lire les rapports”.

Il dit :
- toutes les routes commencent par `/api/reports`,
- il faut être authentifié,
- il faut être `ADMIN` ou `VIEWER`,
- puis on peut :
  - voir la vue d’ensemble,
  - voir une matrice,
  - voir le détail d’un conteneur.

***

# Conclusion technique

`reports.controller.ts` définit un **controller NestJS de reporting** sous le préfixe `/api/reports`, protégé au niveau classe par `BasicAuthGuard` et `RolesGuard`, avec une restriction de rôles `ADMIN` ou `VIEWER`. Il expose trois handlers GET qui délèguent entièrement la logique métier à `ReportsService`, avec usage standard de `@Controller()`, `@Get()`, `@UseGuards()`, `@Roles()` et `@Param()`. [docs.nestjs](https://docs.nestjs.com/security/authorization)

***
`scan.module.ts` définit un **feature module NestJS** pour la partie scans, en regroupant un controller (`ScansController`) et un service (`ScansService`), puis en exportant ce service pour qu’il soit injectable ailleurs. Dans Nest, un module organise les controllers et providers d’un domaine fonctionnel, et les providers ne sont visibles hors du module que s’ils sont explicitement exportés. [docs.nestjs](https://docs.nestjs.com/modules)

## Le code

```ts
import { Module } from "@nestjs/common";
import { ScansController } from "./scans.controller";
import { ScansService } from "./scans.service";

@Module({
  controllers: [ScansController],
  providers: [ScansService],
  exports: [ScansService]
})
export class ScansModule {}
```

## Imports

`Module` est le décorateur NestJS utilisé pour déclarer un module et lui fournir sa configuration structurelle. `ScansController` représente la couche HTTP du domaine scans, tandis que `ScansService` représente la couche provider/service contenant la logique métier associée. [docs.nestjs](https://docs.nestjs.com/providers)

## `@Module(...)`

Le décorateur `@Module({...})` prend ici trois champs : `controllers`, `providers` et `exports`, qui sont trois éléments centraux de la composition d’un module Nest. La documentation Nest décrit `controllers` comme les handlers HTTP du module, `providers` comme les services injectables instanciés par le conteneur Nest, et `exports` comme le sous-ensemble de providers rendu disponible aux autres modules qui importent ce module. [docs.nest-js](https://docs.nest-js.fr/modules)

## `controllers: [ScansController]`

Cette ligne enregistre `ScansController` dans le module, ce qui signifie que Nest va l’instancier et l’utiliser pour traiter les requêtes HTTP liées au domaine scans. Un controller est précisément responsable de recevoir les requêtes entrantes et de renvoyer les réponses, généralement en délégant la logique métier à un service. [docs.nestjs](https://docs.nestjs.com/controllers)

## `providers: [ScansService]`

Cette ligne déclare `ScansService` comme provider du module, donc Nest pourra l’injecter dans `ScansController` ou dans d’autres providers du même module. Les services Nest sont des providers classiques, et leur rôle est généralement de concentrer la logique métier ou l’accès aux données. [docs.nestjs](https://docs.nestjs.com/modules)

## `exports: [ScansService]`

Cette ligne expose `ScansService` à l’extérieur du module, afin qu’un autre module qui importe `ScansModule` puisse injecter ce service sans le redéclarer. Sans cet export, `ScansService` resterait encapsulé à l’intérieur de `ScansModule` et ne pourrait pas être injecté directement depuis d’autres modules. [stackoverflow](https://stackoverflow.com/questions/51819504/inject-nestjs-service-from-another-module)

## `ScansModule`

La classe `ScansModule` elle-même est vide, ce qui est normal pour un module Nest simple, car la vraie configuration se trouve dans le décorateur `@Module`. C’est donc un module de fonctionnalité classique, comparable aux exemples officiels où un controller et un service sont regroupés dans un même domaine métier. [mindbowser](https://www.mindbowser.com/understanding-nestjs-architecture/)

## Lecture architecturale

Ce module suit le pattern NestJS standard :  
- `ScansController` = couche HTTP,  
- `ScansService` = logique métier,  
- `ScansModule` = frontière du domaine scans. [docs.nestjs](https://docs.nestjs.com/providers)

Le fait d’exporter `ScansService` suggère qu’un autre module du projet a probablement besoin de consommer la logique scans, par exemple un module de reports, de tasks, ou d’orchestration. C’est justement l’usage normal de `exports` dans Nest : partager un provider sans en recréer une nouvelle instance ailleurs. [reddit](https://www.reddit.com/r/nestjs/comments/1cx8p98/clarification_on_exporting_services_in_nestjs_am/)

## Traduction simple

Tu peux voir ce fichier comme :

- “je crée un module `Scans`”,
- “ce module possède un controller pour les routes scans”,
- “et un service pour la logique scans”,
- “et j’autorise les autres modules à réutiliser ce service”.

## Conclusion technique

`scan.module.ts` est un **module NestJS de fonctionnalité** qui enregistre `ScansController` comme controller HTTP, `ScansService` comme provider métier, puis exporte `ScansService` pour le rendre disponible aux autres modules qui importent `ScansModule`. C’est un pattern standard et propre de structuration modulaire dans NestJS. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

***
Voici le breakdown de `scan.services.ts` — en pratique `ScansService` — qui est le **service métier d’écriture** des scans en base PostgreSQL. Les services NestJS sont des providers injectables, et ici l’écriture est encapsulée dans une transaction `node-postgres`, ce qui est la bonne manière de garantir l’atomicité de plusieurs `INSERT` liés. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

## Le code

```ts
import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DatabaseService } from "../../database/database.service";
import { CreateScanDto } from "./dto/create-scan.dto";

function severityFromCvss(cvss: number): "critical" | "high" | "medium" | "low" {
  if (cvss >= 9) return "critical";
  if (cvss >= 7) return "high";
  if (cvss >= 4) return "medium";
  return "low";
}

@Injectable()
export class ScansService {
  constructor(private readonly db: DatabaseService) {}

  async createScan(payload: CreateScanDto): Promise<{ scanId: string }> {
    const scanId = randomUUID();
    const scanTimestamp = payload.timestamp;

    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO scans (
          id,
          agent_id,
          scan_type,
          started_at,
          finished_at,
          summary_total_containers,
          summary_healthy_containers,
          summary_vulnerable_containers,
          summary_total_vulnerabilities,
          summary_global_risk_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          scanId,
          payload.agent_id,
          payload.scan_type,
          scanTimestamp,
          scanTimestamp,
          payload.summary.total_containers,
          payload.summary.healthy_containers,
          payload.summary.vulnerable_containers,
          payload.summary.total_vulnerabilities,
          payload.summary.global_risk_score
        ]
      );

      for (const container of payload.containers) {
        const containerInsert = await client.query<{ id: string }>(
          `INSERT INTO scan_containers (scan_id, container_id, name, image, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [scanId, container.id, container.name, container.image, container.status, container.created_at ?? null]
        );

        const containerRowId = containerInsert.rows[0].id;

        for (const vuln of container.vulnerabilities) {
          await client.query(
            `INSERT INTO vulnerabilities
              (container_row_id, cve, cwe, package_name, installed_version, fixed_version, cvss, severity, title, remediation, description, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              containerRowId,
              vuln.cve,
              vuln.cwe ? JSON.stringify(vuln.cwe) : null,
              vuln.package_name,
              vuln.installedVersion ?? null,
              vuln.fixedVersion ?? null,
              vuln.cvss,
              severityFromCvss(vuln.cvss),
              vuln.title ?? null,
              vuln.remediation ?? null,
              vuln.description ?? null,
              vuln.source ?? null
            ]
          );
        }
      }

      return { scanId };
    });

    return { scanId };
  }
}
```

## Imports

`Injectable` marque la classe comme provider géré par le conteneur DI de NestJS, ce qui permet l’injection par constructeur. `DatabaseService` est ici une dépendance injectée, et Nest recommande justement ce modèle de constructor injection pour relier services et providers. [docs.nestjs](https://docs.nestjs.com/providers)

`randomUUID` sert à générer un UUID v4 aléatoire pour identifier le scan avant insertion. `crypto.randomUUID()` est bien une API standard côté Node pour produire un UUID v4. [geeksforgeeks](https://www.geeksforgeeks.org/node-js/node-js-crypto-randomuuid-function/)

`CreateScanDto` représente le contrat d’entrée de la méthode `createScan`, donc la forme attendue du payload reçu côté application. En Nest, les DTO servent précisément à structurer les données entrantes dans une couche claire entre HTTP et logique métier. [docs.nestjs](https://docs.nestjs.com)

## Fonction `severityFromCvss`

Cette fonction transforme un score CVSS numérique en niveau de sévérité textuel parmi `critical`, `high`, `medium` et `low`. La logique est simple : `>= 9` devient `critical`, `>= 7` devient `high`, `>= 4` devient `medium`, sinon `low`. [docs.nestjs](https://docs.nestjs.com)

## Rôle métier

Elle normalise les scores avant insertion en base, pour stocker à la fois :
- la valeur numérique `cvss`,
- une catégorie lisible `severity`.

## Lecture du mapping

Le mapping est purement applicatif ici, défini en dur dans le service, ce qui veut dire que l’application ne dépend pas d’une source externe pour classer les vulnérabilités. Cela rend le comportement prévisible et stable.

## Décorateur `@Injectable()`

Le décorateur `@Injectable()` indique à Nest que `ScansService` peut être instancié et injecté par le conteneur IoC. C’est le mécanisme standard pour déclarer un service Nest comme provider réutilisable. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

## Classe `ScansService`

`ScansService` contient la logique métier de création d’un scan complet en base, avec ses conteneurs et ses vulnérabilités associées. Le controller appellera probablement cette méthode pour persister un rapport de scan reçu d’un agent.

## Constructeur

```ts
constructor(private readonly db: DatabaseService) {}
```

Cette ligne injecte `DatabaseService` dans le service via le constructeur. En NestJS, ce pattern est le mécanisme normal d’injection de dépendances entre providers. [dev](https://dev.to/medianova/the-ultimate-guide-to-dependency-injection-in-nestjs-3l22)

### Rôle de `db`

`db` est l’abstraction locale d’accès à PostgreSQL :
- `db.transaction(...)` fournit un client transactionnel,
- le service n’instancie pas lui-même `Pool` ni `Client`,
- la logique SQL reste couplée à une couche de base maîtrisée.

## Méthode `createScan`

```ts
async createScan(payload: CreateScanDto): Promise<{ scanId: string }>
```

### Signature

La méthode :
- reçoit `payload`, typé par `CreateScanDto`,
- renvoie un objet `{ scanId: string }`.

### Rôle global

Elle persiste un scan complet dans trois niveaux relationnels :
1. la ligne principale dans `scans`,
2. les lignes de conteneurs dans `scan_containers`,
3. les lignes de vulnérabilités dans `vulnerabilities`.

## Variables locales

```ts
const scanId = randomUUID();
const scanTimestamp = payload.timestamp;
```

`scanId` est l’identifiant unique du scan généré côté application avant insertion. `scanTimestamp` récupère le timestamp du payload, qui sera réutilisé comme `started_at` et `finished_at`. [developer.mozilla](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)

### Pourquoi générer l’ID côté application

Générer l’UUID avant l’insertion permet de le réutiliser immédiatement dans les inserts liés, notamment pour les clés étrangères comme `scan_id`. C’est très pratique dans les écritures relationnelles multi-table.

## Transaction

```ts
await this.db.transaction(async (client) => {
```

Cette partie enveloppe toute l’écriture dans une transaction unique. Avec `node-postgres`, il faut exécuter `BEGIN`, `COMMIT` et `ROLLBACK` sur **le même client**, et non via `pool.query`, pour que la transaction soit correcte. [node-postgres](https://node-postgres.com/features/transactions)

### Pourquoi c’est important

Si un insert de vulnérabilité échoue après l’insertion du scan principal, toute la transaction peut être rollback, ce qui évite une base incohérente avec un scan partiellement enregistré. [gist.github](https://gist.github.com/brianc/5547726)

## Insertion dans `scans`

Le premier `INSERT` crée la ligne principale du scan dans la table `scans`. Les valeurs proviennent du payload : agent, type, timestamp et résumé agrégé. [node-postgres](https://node-postgres.com/features/transactions)

### Colonnes écrites

- `id`
- `agent_id`
- `scan_type`
- `started_at`
- `finished_at`
- `summary_total_containers`
- `summary_healthy_containers`
- `summary_vulnerable_containers`
- `summary_total_vulnerabilities`
- `summary_global_risk_score`

### Détail notable

`started_at` et `finished_at` reçoivent tous les deux `scanTimestamp`, donc ce service traite ce rapport comme un snapshot déjà fini plutôt que comme un scan en cours de suivi.

## Boucle sur les conteneurs

```ts
for (const container of payload.containers) {
```

Après insertion du scan principal, le service parcourt tous les conteneurs du payload pour les rattacher à ce scan.

## Insertion dans `scan_containers`

Le code insère chaque conteneur dans `scan_containers` avec :
- `scan_id` qui référence le scan parent,
- `container_id`,
- `name`,
- `image`,
- `status`,
- `created_at`.

Puis il utilise `RETURNING id` pour récupérer l’identifiant technique de la ligne insérée. PostgreSQL supporte `RETURNING` pour récupérer immédiatement les colonnes générées ou retournées après un `INSERT`. [github](https://github.com/brianc/node-postgres/issues/1269)

### `containerInsert`

```ts
const containerInsert = await client.query<{ id: string }>(...)
```

Le résultat contient les lignes retournées par PostgreSQL, ici la colonne `id`.

### `containerRowId`

```ts
const containerRowId = containerInsert.rows[0].id;
```

Cette valeur devient la clé étrangère utilisée pour relier les vulnérabilités à la ligne `scan_containers`.

### Point de typage

La table `scan_containers.id` est un `BIGSERIAL` dans ton schéma précédent, donc côté PostgreSQL c’est un entier auto-incrémenté. Le code le type ici comme `{ id: string }`, ce qui peut être cohérent en pratique avec `pg`, car `node-postgres` retourne certains types numériques PostgreSQL comme chaînes pour éviter des pertes de précision selon le type concerné et la configuration du parser. [node-postgres](https://node-postgres.com/features/transactions)

## Boucle sur les vulnérabilités

```ts
for (const vuln of container.vulnerabilities) {
```

Pour chaque conteneur, le service parcourt la liste des vulnérabilités détectées et les insère une par une dans la table `vulnerabilities`.

## Insertion dans `vulnerabilities`

Chaque vulnérabilité enregistre :
- le lien vers le conteneur (`container_row_id`),
- les identifiants de vulnérabilité (`cve`, `cwe`),
- les informations package/version,
- le score `cvss`,
- la sévérité dérivée,
- plusieurs champs de texte descriptifs.

### Gestion de `cwe`

```ts
vuln.cwe ? JSON.stringify(vuln.cwe) : null
```

Le champ `cwe` est sérialisé en JSON texte si présent, sinon `null`. Comme dans ton schéma SQL la colonne `cwe` est de type `TEXT`, ce code stocke donc une représentation JSON sérialisée et non un vrai type `JSONB`.

### Gestion des champs optionnels

Le code utilise fréquemment `?? null` pour convertir les `undefined` éventuels vers `NULL` SQL :
- `installedVersion ?? null`
- `fixedVersion ?? null`
- `title ?? null`
- `remediation ?? null`
- `description ?? null`
- `source ?? null`

C’est une bonne pratique quand on veut garder des inserts SQL explicites et cohérents.

### Sévérité calculée

```ts
severityFromCvss(vuln.cvss)
```

Le niveau textuel n’est pas fourni par le payload mais recalculé par le service à partir du score numérique. Cela garantit une convention unique de catégorisation dans la base.

## `return { scanId }` dans la transaction

```ts
return { scanId };
```

Cette valeur est renvoyée au callback transactionnel, mais elle n’est pas récupérée par le code appelant, car le résultat de `await this.db.transaction(...)` n’est pas stocké dans une variable. En l’état, ce `return` interne est donc redondant.

## Retour final

```ts
return { scanId };
```

Après le succès de la transaction, la méthode renvoie l’ID du scan créé. C’est cohérent pour permettre au controller ou au client de référencer ensuite ce scan.

## Flux complet

Le flux métier complet est :
1. générer un `scanId`,
2. ouvrir une transaction,
3. insérer la ligne `scans`,
4. pour chaque conteneur, insérer `scan_containers` et récupérer son `id`,
5. pour chaque vulnérabilité du conteneur, insérer dans `vulnerabilities`,
6. commit implicite via `DatabaseService` si tout réussit,
7. renvoyer `{ scanId }`. [node-postgres](https://node-postgres.com/features/transactions)

## Lecture architecturale

Ce service suit bien les principes NestJS :
- service injectable,
- dépendance DB injectée,
- logique métier hors controller. [digitalocean](https://www.digitalocean.com/community/tutorials/a-guide-on-dependency-injection-in-nestjs)

Il suit aussi une bonne logique relationnelle :
- un scan parent,
- plusieurs conteneurs enfants,
- plusieurs vulnérabilités petites-filles,
- le tout dans une seule transaction atomique. [node-postgres](https://node-postgres.com/features/transactions)

## Points d’attention

- Le fichier s’appelle `scan.services.ts`, mais la convention Nest habituelle serait plutôt `scans.service.ts`.
- `containerInsert` est typé avec `{ id: string }` alors que la colonne vient d’un `BIGSERIAL`, donc il faut être sûr que le reste du code accepte ce type sans ambiguïté.
- Le champ `cwe` est stocké comme texte JSON sérialisé, ce qui fonctionne mais est moins exploitable qu’un vrai `JSONB`.
- Le `return { scanId }` à l’intérieur du callback transactionnel est inutile tant que son résultat n’est pas capturé.

## Traduction simple

Ce service fait exactement ça :
- il crée un nouvel identifiant de scan,
- il enregistre le scan principal,
- il enregistre tous les conteneurs du scan,
- il enregistre toutes les vulnérabilités de chaque conteneur,
- et il fait tout ça en une seule opération transactionnelle.

## Conclusion technique

`ScansService` est le **service NestJS de persistance des scans**. Il injecte `DatabaseService`, génère un UUID pour le scan, transforme le score CVSS en sévérité textuelle, puis insère le scan, ses conteneurs et leurs vulnérabilités dans PostgreSQL au sein d’une transaction unique, ce qui garantit la cohérence de l’écriture relationnelle. [geeksforgeeks](https://www.geeksforgeeks.org/node-js/node-js-crypto-randomuuid-function/)

***
Ce fichier définit deux **DTO NestJS** pour les scan tasks : un pour créer une tâche, l’autre pour la compléter, avec validation déclarative via `class-validator`. Dans Nest, les DTO sont généralement validés par `ValidationPipe`, et les décorateurs comme `@IsIn()`, `@IsArray()` et `@IsString()` servent précisément à contrôler les payloads entrants avant d’atteindre la logique métier. [docs.nestjs](https://docs.nestjs.com/techniques/validation)

## Le code

```ts
import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

const TASK_MODES = ["MANUAL_GLOBAL", "MANUAL_TARGET", "AUTO_CRON"] as const;
const TASK_STATUSES = ["queued", "processing", "completed", "failed"] as const;

export class CreateScanTaskDto {
  @IsIn(TASK_MODES)
  mode!: (typeof TASK_MODES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  container_ids?: string[];

  @IsOptional()
  @IsString()
  message?: string;
}

export class CompleteScanTaskDto {
  @IsOptional()
  @IsString()
  scan_id?: string;

  @IsIn(TASK_STATUSES)
  status!: (typeof TASK_STATUSES)[number];

  @IsOptional()
  @IsString()
  message?: string;
}
```

## Imports

`IsArray`, `IsIn`, `IsOptional` et `IsString` viennent de `class-validator`, la bibliothèque que Nest utilise couramment avec `ValidationPipe` pour valider les DTO. `ValidationPipe` applique les règles déclarées sur la classe DTO aux données reçues dans les requêtes entrantes. [github](https://github.com/typestack/class-validator)

## Constantes `TASK_MODES` et `TASK_STATUSES`

```ts
const TASK_MODES = ["MANUAL_GLOBAL", "MANUAL_TARGET", "AUTO_CRON"] as const;
const TASK_STATUSES = ["queued", "processing", "completed", "failed"] as const;
```

Ces deux constantes centralisent les valeurs autorisées pour les modes et les statuts des tâches. Le `as const` dit à TypeScript de conserver les valeurs littérales exactes au lieu de les élargir vers `string[]`, ce qui permet ensuite de dériver des unions de types précises à partir du tableau. [docs.nestjs](https://docs.nestjs.com)

## Pourquoi c’est utile

Cela évite de dupliquer :
- une liste de validation runtime,
- et une union de types TypeScript séparée.

Ici, les mêmes constantes servent à la fois :
- pour `@IsIn(...)` côté validation,
- pour typer les propriétés côté compilation.

## `CreateScanTaskDto`

Cette classe décrit le payload attendu pour créer une tâche de scan. En Nest, une classe DTO sert de contrat d’entrée entre la couche HTTP et la logique métier. [devcentrehouse](https://www.devcentrehouse.eu/blogs/nestjs-dtos-pipes-scalable-backend-apps/)

### Champ `mode`

```ts
@IsIn(TASK_MODES)
mode!: (typeof TASK_MODES)[number];
```

`@IsIn(TASK_MODES)` exige que la valeur reçue soit exactement l’une des trois valeurs de `TASK_MODES`. Le type `(typeof TASK_MODES)[number]` signifie “une des valeurs contenues dans ce tuple”, donc ici `"MANUAL_GLOBAL" | "MANUAL_TARGET" | "AUTO_CRON"`.  [github](https://github.com/typestack/class-validator)

#### Rôle métier

Ce champ indique le type de tâche à lancer :
- globale,
- ciblée,
- ou automatique via cron.

#### Le `!`

Le `!` est l’assertion definite assignment de TypeScript, souvent utilisée dans les DTO Nest parce que les propriétés sont remplies dynamiquement à l’exécution par le framework. [docs.nestjs](https://docs.nestjs.com/techniques/validation)

### Champ `container_ids`

```ts
@IsOptional()
@IsArray()
@IsString({ each: true })
container_ids?: string[];
```

Ce champ est optionnel, mais s’il est présent :
- il doit être un tableau,
- et chaque élément du tableau doit être une chaîne de caractères. `@IsString({ each: true })` applique la validation à chaque élément du tableau, et ce pattern est explicitement documenté et recommandé pour les tableaux d’éléments primitifs. [stackoverflow](https://stackoverflow.com/questions/69438275/nest-js-validate-array-of-strings-if-there-are-defined-strings-only)

#### Interprétation métier

Ce champ sert probablement pour le mode `MANUAL_TARGET`, où l’on veut préciser une liste de conteneurs à scanner.

#### Point important

Le couple `@IsArray()` + `@IsString({ each: true })` est le bon pattern ici, car `each: true` seul n’impose pas forcément qu’on ait vraiment un tableau dans tous les cas. [github](https://github.com/typestack/class-validator/issues/1858)

### Champ `message`

```ts
@IsOptional()
@IsString()
message?: string;
```

Ce champ est optionnel et, s’il est fourni, doit être une chaîne de caractères. Il sert probablement à ajouter un commentaire ou un contexte humain à la demande de tâche.

## `CompleteScanTaskDto`

Cette classe décrit le payload attendu pour finaliser une tâche de scan. Elle contient le statut final, éventuellement l’ID du scan produit, et un message optionnel.

### Champ `scan_id`

```ts
@IsOptional()
@IsString()
scan_id?: string;
```

Ce champ est optionnel et doit être une chaîne si présent. Il permet probablement d’associer la tâche terminée à un scan réel créé dans la table `scans`.

### Champ `status`

```ts
@IsIn(TASK_STATUSES)
status!: (typeof TASK_STATUSES)[number];
```

Ce champ est obligatoire et doit valoir exactement :
- `"queued"`
- `"processing"`
- `"completed"`
- `"failed"`.

Le type associé devient donc l’union littérale de ces quatre valeurs. `@IsIn(...)` vérifie au runtime que la valeur reçue fait partie de cette liste autorisée. [github](https://github.com/typestack/class-validator)

#### Lecture métier

Dans un DTO de complétion, les valeurs les plus réalistes seront probablement surtout :
- `completed`
- `failed`.

Mais le DTO autorise aussi `queued` et `processing`, donc il semble conçu pour être souple et couvrir plusieurs transitions possibles.

### Champ `message`

```ts
@IsOptional()
@IsString()
message?: string;
```

Même logique que dans `CreateScanTaskDto` : texte libre optionnel, probablement pour un message de succès, d’erreur, ou de contexte.

## Lecture architecturale

Ces DTO montrent une validation **déclarative, compacte et propre** :
- les règles métier simples sont visibles directement dans la classe,
- TypeScript garantit les unions de types à la compilation,
- `class-validator` garantit les valeurs à l’exécution. [devcentrehouse](https://www.devcentrehouse.eu/blogs/nestjs-dtos-pipes-scalable-backend-apps/)

Le design est aussi cohérent avec le modèle SQL que tu as montré plus tôt pour `scan_tasks`, où `mode` et `status` sont eux aussi limités par des `CHECK` en base. Autrement dit, la validation existe à deux niveaux :
- côté API avec DTO,
- côté base avec contraintes SQL.

## Points d’attention

Le DTO valide que `scan_id` est une chaîne, mais pas qu’il s’agit d’un UUID valide. Si tu veux renforcer le contrat, `@IsUUID()` serait plus précis que `@IsString()`. `class-validator` fournit justement des validateurs spécialisés de ce type. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-nestjs-class-validator/view)

Même chose pour `container_ids` : aujourd’hui on valide “tableau de strings”, pas “tableau d’UUIDs” ou “tableau d’identifiants non vides”. Si les IDs ont un format strict, la validation peut être durcie.

Le DTO `CompleteScanTaskDto` autorise `queued` et `processing`, ce qui n’est pas forcément intuitif pour une action de “complete”. Ce n’est pas faux, mais le nom de la classe suggère surtout une transition terminale.

## Traduction simple

Ce fichier dit au backend :

- pour **créer** une tâche, il faut un `mode` valide, et éventuellement une liste de conteneurs et un message ;
- pour **terminer** une tâche, il faut un `status` valide, et éventuellement un `scan_id` et un message.

Et Nest peut vérifier ça automatiquement avant d’exécuter ton controller grâce au `ValidationPipe`. [docs.nestjs](https://docs.nestjs.com/techniques/validation)

## Conclusion technique

Ce fichier définit deux **DTO de scan tasks** avec validation déclarative via `class-validator`. `CreateScanTaskDto` contrôle le mode, une liste optionnelle de `container_ids` et un message, tandis que `CompleteScanTaskDto` contrôle un `status` obligatoire, plus `scan_id` et `message` optionnels, avec typage littéral dérivé des constantes `TASK_MODES` et `TASK_STATUSES`. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-nestjs-class-validator/view)

***
Ce service NestJS lance et planifie une **mise à jour périodique des métadonnées NVD** au démarrage de l’application, puis toutes les 6 heures via `node-cron`. `OnModuleInit` et `OnModuleDestroy` sont bien des hooks lifecycle NestJS, et l’expression cron `0 */6 * * *` correspond à une exécution à minute 0 toutes les 6 heures. [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)

## Vue d’ensemble

`CveUpdaterService` ne télécharge pas ici la base complète des CVE : il récupère seulement le fichier `.meta` du feed NVD “modified”, extrait un petit résumé texte, puis journalise le résultat en base dans `cve_updates`. Le site NVD indique que les fichiers `.meta` accompagnent les feeds et contiennent notamment la date de dernière modification, la taille et un SHA256, et que le feed “modified” couvre les vulnérabilités modifiées sur les 8 derniers jours avec des mises à jour environ toutes les 2 heures. [nvd.nist](https://nvd.nist.gov/vuln/data-feeds)

## Le code

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import cron, { ScheduledTask } from "node-cron";
import { DatabaseService } from "../../database/database.service";

const NVD_META_URL = "https://nvd.nist.gov/feeds/json/cve/2.0/nvdcve-2.0-modified.meta";

@Injectable()
export class CveUpdaterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CveUpdaterService.name);
  private task?: ScheduledTask;

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.runUpdate();

    this.task = cron.schedule("0 */6 * * *", async () => {
      await this.runUpdate();
    });
  }

  onModuleDestroy(): void {
    if (this.task) {
      this.task.stop();
    }
  }

  private async runUpdate(): Promise<void> {
    try {
      const response = await fetch(NVD_META_URL);
      if (!response.ok) {
        throw new Error(`NVD response status ${response.status}`);
      }

      const meta = await response.text();
      const summary = meta.split("\\n").slice(0, 2).join(" | ");

      await this.db.query(
        `INSERT INTO cve_updates (source, status, message) VALUES ($1, $2, $3)`,
        ["nvd", "success", summary]
      );

      this.logger.log("CVE feed metadata refreshed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";

      await this.db.query(
        `INSERT INTO cve_updates (source, status, message) VALUES ($1, $2, $3)`,
        ["nvd", "failure", message]
      );

      this.logger.error(`CVE update failed: ${message}`);
    }
  }
}
```

## Imports et constantes

`Injectable`, `Logger`, `OnModuleInit` et `OnModuleDestroy` viennent de NestJS et servent respectivement à déclarer un provider injectable, journaliser, exécuter du code à l’initialisation et faire du nettoyage à l’arrêt. La doc Nest précise bien que `onModuleInit()` est appelé une fois les dépendances résolues, et `onModuleDestroy()` lors de la destruction déclenchée par un signal d’arrêt si les hooks de shutdown sont activés. [nestjs](https://nestjs.fr/fundamentals/lifecycle-events/)

`cron` et `ScheduledTask` viennent de `node-cron`, utilisé ici pour planifier l’exécution récurrente. `DatabaseService` sert à persister l’état de mise à jour dans PostgreSQL. [blog.logrocket](https://blog.logrocket.com/task-scheduling-or-cron-jobs-in-node-using-node-cron/)

`NVD_META_URL` pointe vers le fichier `.meta` du feed “modified” en version JSON 2.0. Le NVD documente bien cette convention de nommage `nvdcve-2.0-modified.meta`. [nvd.nist](https://nvd.nist.gov/vuln/data-feeds)

## Classe `CveUpdaterService`

La classe est un provider NestJS injectable qui vit dans le cycle de vie du module. Son rôle est d’automatiser une petite routine de synchronisation/monitoring liée au NVD. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

### `logger`

```ts
private readonly logger = new Logger(CveUpdaterService.name);
```

Ce logger Nest permet d’émettre des messages contextualisés avec le nom du service. Il est utilisé pour les cas de succès et d’échec.

### `task?: ScheduledTask`

```ts
private task?: ScheduledTask;
```

Cette propriété stocke la tâche cron planifiée, afin de pouvoir l’arrêter proprement dans `onModuleDestroy()`. `node-cron` renvoie bien un objet représentant la tâche planifiée, sur lequel on peut appeler `stop()`. [oneuptime](https://oneuptime.com/blog/post/2026-01-22-nodejs-cron-jobs/view)

## Constructeur

```ts
constructor(private readonly db: DatabaseService) {}
```

Le service dépend de `DatabaseService`, injecté par Nest via constructor injection. Cela suit le pattern standard de provider NestJS consommant un autre provider pour accéder à la base. [docs.nestjs](https://docs.nestjs.com/providers)

## `onModuleInit()`

```ts
async onModuleInit(): Promise<void> {
  await this.runUpdate();

  this.task = cron.schedule("0 */6 * * *", async () => {
    await this.runUpdate();
  });
}
```

Cette méthode est appelée au démarrage du module. Elle fait deux choses :
1. exécute immédiatement une mise à jour,
2. programme ensuite les mises à jour périodiques.

### Exécution immédiate

Le `await this.runUpdate()` au démarrage garantit qu’une première tentative de récupération NVD a lieu dès que le module est prêt. C’est utile pour ne pas attendre la prochaine fenêtre cron avant d’avoir un état initial.

### Planification cron

L’expression `"0 */6 * * *"` signifie “à la minute 0, toutes les 6 heures”, donc typiquement à 00:00, 06:00, 12:00 et 18:00. Cette interprétation est cohérente avec le format cron standard de `node-cron`, et le piège inverse documenté est justement `* */6 * * *`, qui tournerait chaque minute pendant ces heures. [stackoverflow](https://stackoverflow.com/questions/49416455/nodejs-script-execute-every-6-hours)

### Lecture métier

Comme le NVD annonce des mises à jour du feed “modified” environ toutes les deux heures, une fréquence de 6 heures est plus espacée que la fréquence source, donc on est ici sur une stratégie de rafraîchissement modérée et non maximale. [nvd.nist](https://nvd.nist.gov/vuln/data-feeds)

## `onModuleDestroy()`

```ts
onModuleDestroy(): void {
  if (this.task) {
    this.task.stop();
  }
}
```

Cette méthode est appelée lors de la destruction du module. Si une tâche cron existe, elle est stoppée proprement via `stop()`. Nest documente `onModuleDestroy()` comme le bon hook pour ce type de nettoyage. [docs.nest-js](https://docs.nest-js.fr/fundamentals/lifecycle-events)

### Intérêt

Cela évite de laisser tourner une tâche planifiée dans un contexte de shutdown contrôlé, ce qui est particulièrement important dans des environnements comme Kubernetes ou lors de redéploiements. [stackoverflow](https://stackoverflow.com/questions/51707348/nestjs-request-and-application-lifecycle)

## `runUpdate()`

```ts
private async runUpdate(): Promise<void> {
```

C’est le cœur métier du service. Cette méthode :
- interroge le NVD,
- construit un résumé,
- persiste un succès ou un échec en base,
- loggue le résultat.

## Étape 1 : `fetch(NVD_META_URL)`

```ts
const response = await fetch(NVD_META_URL);
if (!response.ok) {
  throw new Error(`NVD response status ${response.status}`);
}
```

Le service récupère le fichier `.meta` via HTTP. Si la réponse n’est pas dans la plage OK, il force une erreur explicite. Le check `response.ok` est un pattern standard de contrôle des réponses HTTP fetch.

### Intérêt

Cela évite de considérer comme “succès” une réponse HTTP 404, 500 ou similaire.

## Étape 2 : lecture du texte

```ts
const meta = await response.text();
const summary = meta.split("\n").slice(0, 2).join(" | ");
```

Le contenu `.meta` est lu comme texte brut. Ensuite, le service ne garde que les deux premières lignes, qu’il assemble avec `" | "` pour produire un résumé court.

### Ce que ça veut dire

Le service ne parse pas complètement le format `.meta`. Il s’appuie juste sur le fait que les premières lignes sont suffisamment utiles pour un journal succinct.

### Limite

C’est un résumé opportuniste, pas un parsing sémantique robuste. Si le format des premières lignes change, le message stocké changera aussi.

## Étape 3 : journalisation du succès en base

```ts
await this.db.query(
  `INSERT INTO cve_updates (source, status, message) VALUES ($1, $2, $3)`,
  ["nvd", "success", summary]
);
```

En cas de succès, une ligne est insérée dans `cve_updates` avec :
- `source = "nvd"`,
- `status = "success"`,
- `message = summary`.

### Lecture métier

Cette table joue ici le rôle d’un journal d’exécution des mises à jour, pas celui d’un miroir complet des CVE.

## Étape 4 : log applicatif

```ts
this.logger.log("CVE feed metadata refreshed");
```

Le service produit ensuite un log applicatif positif.

## Gestion des erreurs

Si une erreur survient, le `catch` convertit l’erreur en message texte :

```ts
const message = error instanceof Error ? error.message : "unknown error";
```

Puis il enregistre une ligne d’échec dans `cve_updates` :

```ts
await this.db.query(
  `INSERT INTO cve_updates (source, status, message) VALUES ($1, $2, $3)`,
  ["nvd", "failure", message]
);
```

et loggue l’erreur côté application :

```ts
this.logger.error(`CVE update failed: ${message}`);
```

### Intérêt

Le service conserve ainsi une trace en base des succès comme des échecs, ce qui est très utile pour l’observabilité et le diagnostic.

## Flux complet

Le flux complet du service est donc :
1. démarrage du module,
2. exécution immédiate de `runUpdate()`, [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)
3. planification d’une exécution toutes les 6 heures, [stackoverflow](https://stackoverflow.com/questions/49416455/nodejs-script-execute-every-6-hours)
4. à chaque run, requête HTTP sur le `.meta` NVD, [nvd.nist](https://nvd.nist.gov/vuln/data-feeds)
5. insertion d’un statut `success` ou `failure` dans `cve_updates`,
6. arrêt propre de la tâche cron à la destruction du module. [docs.nest-js](https://docs.nest-js.fr/fundamentals/lifecycle-events)

## Lecture architecturale

Le service est bien conçu pour un rôle de **background job léger** :
- lifecycle hook Nest pour bootstrap et teardown, [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)
- scheduler simple via `node-cron`, [blog.logrocket](https://blog.logrocket.com/task-scheduling-or-cron-jobs-in-node-using-node-cron/)
- stockage en base du résultat pour audit/monitoring,
- séparation claire entre logique HTTP externe, persistance et logs.

Il ne s’agit cependant pas d’un vrai synchroniseur de CVE complet : il ne télécharge ni ne parse les vulnérabilités elles-mêmes, il ne met à jour aucune table CVE détaillée, et il ne consomme que les métadonnées du feed.

## Points d’attention

- `fetch` suppose un runtime Node récent ou un polyfill adapté.
- La fréquence de 6 heures est plus lente que la cadence annoncée d’environ 2 heures du feed “modified”. [nvd.nist](https://nvd.nist.gov/vuln/data-feeds)
- Le parsing des deux premières lignes est fragile si le format `.meta` évolue.
- Si l’`INSERT` dans `cve_updates` échoue dans le bloc `catch`, cette erreur secondaire n’est pas elle-même protégée, donc elle remontera.

## Traduction simple

Ce service fait :
- au démarrage, il va voir si le feed NVD “modified” a changé,
- il note en base si ça a marché ou non,
- puis il recommence automatiquement toutes les 6 heures.

## Conclusion technique

`CveUpdaterService` est un **service NestJS planifié** qui utilise les hooks `OnModuleInit` et `OnModuleDestroy` pour lancer et arrêter une tâche `node-cron`. À chaque exécution, il récupère le fichier `.meta` du feed NVD “modified”, en extrait un résumé minimal, enregistre en base un statut `success` ou `failure` dans `cve_updates`, puis journalise le résultat côté application. [stackoverflow](https://stackoverflow.com/questions/49416455/nodejs-script-execute-every-6-hours)

***
Ce fichier définit un **controller NestJS de gestion de file de tâches de scan** sous `/api/scan-tasks`, protégé par authentification et contrôle de rôle. Dans Nest, les guards décident si une requête peut atteindre le handler, et les décorateurs `@Body()`, `@Param()` et `@Req()` permettent d’injecter respectivement le corps, les paramètres d’URL et l’objet requête dans les méthodes du controller. [docs.nestjs](https://docs.nestjs.com/controllers)

## Vue d’ensemble

`ScanQueueController` expose quatre actions distinctes avec des permissions différentes :
- création d’une tâche par un `ADMIN`,
- listing des tâches par `ADMIN` ou `VIEWER`,
- claim de la prochaine tâche par un `AGENT`,
- complétion d’une tâche par un `AGENT`. Le contrôle d’accès par rôles via guards et décorateurs de metadata est un pattern RBAC standard dans NestJS. [docs.nestjs](https://docs.nestjs.com/guards)

## Le code

```ts
import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestWithUser } from "../../common/types/request-with-user";
import { CompleteScanTaskDto, CreateScanTaskDto } from "./dto/scan-task.dto";
import { ScanQueueService } from "./scan-queue.service";

@Controller("api/scan-tasks")
@UseGuards(BasicAuthGuard, RolesGuard)
export class ScanQueueController {
  constructor(private readonly scanQueueService: ScanQueueService) {}

  @Post()
  @Roles(Role.ADMIN)
  createTask(@Body() payload: CreateScanTaskDto, @Req() request: RequestWithUser) {
    return this.scanQueueService.createTask(payload, request.user?.subject ?? "admin");
  }

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  listTasks() {
    return this.scanQueueService.listTasks();
  }

  @Post("claim")
  @Roles(Role.AGENT)
  claimTask(@Req() request: RequestWithUser) {
    return this.scanQueueService.claimNextTask(request.user?.subject ?? "agent");
  }

  @Post(":taskId/complete")
  @Roles(Role.AGENT)
  completeTask(
    @Param("taskId") taskId: string,
    @Body() payload: CompleteScanTaskDto,
    @Req() request: RequestWithUser
  ) {
    return this.scanQueueService.completeTask(taskId, request.user?.subject ?? "agent", payload);
  }
}
```

## Imports principaux

`Controller`, `Get`, `Post`, `Param`, `Body`, `Req` et `UseGuards` sont les décorateurs NestJS de base pour construire des routes HTTP. La documentation Nest décrit `@Body()` comme l’accès au corps de requête, `@Param()` comme l’accès aux paramètres de route, et `@Req()` comme l’accès à l’objet requête natif sous-jacent. [docs.nestjs](https://docs.nestjs.com/custom-decorators)

`Roles`, `Role`, `BasicAuthGuard` et `RolesGuard` forment ici la couche de sécurité RBAC :
- `BasicAuthGuard` authentifie,
- `RolesGuard` autorise selon la metadata `@Roles(...)`. C’est exactement le pattern documenté par Nest pour l’autorisation basée sur les rôles. [docs.nestjs](https://docs.nestjs.com/security/authorization)

`RequestWithUser` est un type applicatif permettant de typer `request.user`, ce qui suit une pratique courante quand un guard enrichit l’objet requête avec un utilisateur authentifié. [reddit](https://www.reddit.com/r/nestjs/comments/1j7v2ee/how_to_properly_type_the_request_object_in_a/)

`CreateScanTaskDto` et `CompleteScanTaskDto` sont les DTO déjà vus, utilisés pour valider les corps de requête des endpoints de création et de complétion. [docs.nestjs](https://docs.nestjs.com/techniques/validation)

## `@Controller("api/scan-tasks")`

Ce décorateur fixe le préfixe commun de toutes les routes du controller à `/api/scan-tasks`. En NestJS, les controllers regroupent les handlers HTTP sous une même racine logique. [docs.nestjs](https://docs.nestjs.com/controllers)

### Routes résultantes

Avec ce préfixe, les méthodes deviennent :
- `POST /api/scan-tasks`
- `GET /api/scan-tasks`
- `POST /api/scan-tasks/claim`
- `POST /api/scan-tasks/:taskId/complete`

## `@UseGuards(BasicAuthGuard, RolesGuard)`

Ce décorateur est appliqué au niveau classe, donc il protège toutes les routes du controller. Nest documente que les guards peuvent être appliqués à l’échelle globale, controller ou méthode, et qu’ils s’exécutent avant que le handler ne soit appelé. [blog.logrocket](https://blog.logrocket.com/understanding-guards-nestjs/)

### Ordre logique

Ici l’ordre fait sens :
1. `BasicAuthGuard` authentifie et enrichit probablement `request.user`,
2. `RolesGuard` lit la metadata `@Roles(...)` et décide si le rôle courant est autorisé. [docs.nestjs](https://docs.nestjs.com/guards)

## Classe `ScanQueueController`

Cette classe représente la couche HTTP du domaine “scan tasks”. Elle ne contient pas la logique métier elle-même, mais délègue à `ScanQueueService`, ce qui correspond bien à la séparation controller/service encouragée par Nest. [docs.nestjs](https://docs.nestjs.com/providers)

## Constructeur

```ts
constructor(private readonly scanQueueService: ScanQueueService) {}
```

Le service métier est injecté par constructeur. C’est le pattern standard d’injection de dépendances dans NestJS. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

## Méthode `createTask`

```ts
@Post()
@Roles(Role.ADMIN)
createTask(@Body() payload: CreateScanTaskDto, @Req() request: RequestWithUser) {
  return this.scanQueueService.createTask(payload, request.user?.subject ?? "admin");
}
```

Cette méthode gère `POST /api/scan-tasks` et n’est accessible qu’au rôle `ADMIN`. La metadata `@Roles(Role.ADMIN)` sera lue par `RolesGuard` pour autoriser ou refuser l’accès. [docs.nestjs](https://docs.nestjs.com/security/authorization)

### Paramètres

`@Body() payload: CreateScanTaskDto` injecte le corps HTTP validé comme DTO. `@Req() request: RequestWithUser` donne accès à l’utilisateur authentifié injecté dans la requête. [docs.nestjs](https://docs.nestjs.com/custom-decorators)

### Comportement

Le controller appelle `scanQueueService.createTask(payload, request.user?.subject ?? "admin")`. Il transmet donc :
- les données métier de la tâche,
- le sujet de l’utilisateur courant comme `requested_by`, ou `"admin"` en fallback implicite.

### Lecture métier

Cela suggère que le service va enregistrer qui a demandé la tâche de scan. Le fallback `"admin"` est une sécurité défensive, mais si le guard garantit toujours `request.user`, ce fallback ne devrait normalement jamais être utilisé.

## Méthode `listTasks`

```ts
@Get()
@Roles(Role.ADMIN, Role.VIEWER)
listTasks() {
  return this.scanQueueService.listTasks();
}
```

Cette méthode gère `GET /api/scan-tasks` et autorise `ADMIN` et `VIEWER`. Elle n’a pas besoin du corps ni de la requête, car elle délègue simplement au service la récupération de la liste des tâches. [docs.nestjs](https://docs.nestjs.com/controllers)

### Lecture métier

On voit bien la séparation des rôles :
- `ADMIN` peut créer et consulter,
- `VIEWER` peut consulter,
- `AGENT` n’est pas autorisé à lister selon ce controller.

## Méthode `claimTask`

```ts
@Post("claim")
@Roles(Role.AGENT)
claimTask(@Req() request: RequestWithUser) {
  return this.scanQueueService.claimNextTask(request.user?.subject ?? "agent");
}
```

Cette méthode gère `POST /api/scan-tasks/claim` et n’est accessible qu’au rôle `AGENT`. Elle récupère l’identité de l’agent courant via `request.user?.subject` et la transmet au service. [docs.nestjs](https://docs.nestjs.com/guards)

### Lecture métier

C’est typiquement un endpoint de worker/agent :
- un agent appelle l’API,
- l’API lui attribue la prochaine tâche disponible,
- l’identité de l’agent est stockée comme “claimer”.

Le fallback `"agent"` joue ici le même rôle défensif que dans `createTask`.

## Méthode `completeTask`

```ts
@Post(":taskId/complete")
@Roles(Role.AGENT)
completeTask(
  @Param("taskId") taskId: string,
  @Body() payload: CompleteScanTaskDto,
  @Req() request: RequestWithUser
) {
  return this.scanQueueService.completeTask(taskId, request.user?.subject ?? "agent", payload);
}
```

Cette méthode gère `POST /api/scan-tasks/:taskId/complete` et reste réservée au rôle `AGENT`. Elle combine trois sources d’entrée :
- `taskId` depuis l’URL via `@Param("taskId")`,
- `payload` depuis le corps via `@Body()`,
- `request.user` via `@Req()`. [dev](https://dev.to/wakeup_flower_8591a6cb6a9/parameter-decorators-in-nestjs-2l5f)

### Comportement

Le controller transmet au service :
- l’identifiant de la tâche,
- le sujet de l’agent courant,
- les données de complétion validées par `CompleteScanTaskDto`.

### Lecture métier

Le service pourra ainsi vérifier :
- quelle tâche est concernée,
- quel agent essaie de la compléter,
- avec quel statut final,
- et éventuellement quel `scan_id` ou message associer.

## Flux de sécurité

Le flux d’une requête typique est :
1. la requête atteint le controller,
2. `BasicAuthGuard` authentifie et enrichit la requête, [docs.nestjs](https://docs.nestjs.com/guards)
3. `RolesGuard` compare le rôle courant à la metadata `@Roles(...)`, [docs.nestjs](https://docs.nestjs.com/security/authorization)
4. si tout passe, Nest injecte `@Body()`, `@Param()` et `@Req()` dans la méthode, [docs.nestjs](https://docs.nestjs.com/controllers)
5. le controller délègue au service.

Ce flux est conforme au cycle de vie standard d’une requête Nest, où les guards précèdent l’exécution du handler. [docs.nestjs](https://docs.nestjs.com/faq/request-lifecycle)

## Lecture architecturale

Ce controller est propre et cohérent :
- sécurité factorisée au niveau classe,
- permissions précises au niveau méthode,
- aucune logique SQL ou métier lourde dans le controller,
- délégation complète à `ScanQueueService`.

La séparation des rôles est aussi très claire :
- **ADMIN** crée les tâches,
- **VIEWER** consulte,
- **AGENT** consomme et termine les tâches.

C’est un design RBAC lisible et assez naturel pour un système d’orchestration de scans. [developer.auth0](https://developer.auth0.com/resources/code-samples/api/nestjs/basic-role-based-access-control)

## Point d’attention

L’usage répété de `@Req()` pour lire `request.user?.subject` fonctionne, mais Nest recommande souvent des décorateurs paramétriques plus ciblés ou custom decorators pour alléger les handlers quand on lit souvent les mêmes données. La documentation Nest montre justement que les custom param decorators peuvent rendre les handlers plus lisibles. [stackoverflow](https://stackoverflow.com/questions/77232416/nest-js-custom-decorator-that-will-return-parameter-from-request)

Les fallbacks `"admin"` et `"agent"` sont défensifs, mais ils peuvent masquer un problème d’auth si `request.user` est absent alors qu’il ne devrait pas l’être. En prod, certains projets préfèrent échouer explicitement dans ce cas.

## Traduction simple

Ce controller sert à piloter la **file de tâches de scan** :
- un admin ajoute une tâche,
- un admin ou viewer regarde la file,
- un agent prend la prochaine tâche,
- un agent dit ensuite qu’il a fini la tâche.

## Conclusion technique

`ScanQueueController` est un **controller NestJS RBAC** sous `/api/scan-tasks`, protégé par `BasicAuthGuard` et `RolesGuard`, avec quatre endpoints qui répartissent les droits entre `ADMIN`, `VIEWER` et `AGENT`. Il utilise `@Body()`, `@Param()` et `@Req()` pour extraire les données de requête, puis délègue toute la logique métier à `ScanQueueService`. [docs.nestjs](https://docs.nestjs.com/security/authorization)

***
Ce service implémente la **logique métier de file de tâches de scan** au-dessus de PostgreSQL : création, listing, claim concurrent-safe et complétion. Le point le plus important est `SELECT ... FOR UPDATE SKIP LOCKED`, un pattern PostgreSQL classique pour distribuer des jobs entre plusieurs workers sans qu’ils prennent la même ligne, à condition de rester dans une transaction unique sur le même client. [postgresql](https://www.postgresql.org/docs/current/sql-select.html)

## Le code

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DatabaseService } from "../../database/database.service";
import { CompleteScanTaskDto, CreateScanTaskDto } from "./dto/scan-task.dto";

@Injectable()
export class ScanQueueService {
  constructor(private readonly db: DatabaseService) {}

  async createTask(payload: CreateScanTaskDto, requestedBy: string): Promise<Record<string, unknown>> {
    const id = randomUUID();
    const containerIds = payload.container_ids ?? [];

    const result = await this.db.query(
      `INSERT INTO scan_tasks (id, mode, status, requested_by, target_container_ids, message)
       VALUES ($1, $2, 'queued', $3, $4::jsonb, $5)
       RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`,
      [id, payload.mode, requestedBy, JSON.stringify(containerIds), payload.message ?? null]
    );

    return this.normalizeTask(result.rows[0]);
  }

  async listTasks(): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `SELECT id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at
       FROM scan_tasks
       ORDER BY requested_at DESC`
    );

    return result.rows.map((row) => this.normalizeTask(row));
  }

  async claimNextTask(agentId: string): Promise<Record<string, unknown> | null> {
    return this.db.transaction(async (client) => {
      const candidate = await client.query<{ id: string }>(
        `SELECT id
         FROM scan_tasks
         WHERE status = 'queued'
         ORDER BY requested_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`
      );

      if (candidate.rows.length === 0) {
        return null;
      }

      const result = await client.query(
        `UPDATE scan_tasks
         SET status = 'processing', claimed_by = $2, claimed_at = NOW()
         WHERE id = $1
         RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`,
        [candidate.rows[0].id, agentId]
      );

      return this.normalizeTask(result.rows[0]);
    });
  }

  async completeTask(taskId: string, agentId: string, payload: CompleteScanTaskDto): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `UPDATE scan_tasks
       SET status = $2,
           scan_id = COALESCE($3, scan_id),
           completed_at = NOW(),
           claimed_by = COALESCE(claimed_by, $4),
           message = COALESCE($5, message)
       WHERE id = $1
       RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`,
      [taskId, payload.status, payload.scan_id ?? null, agentId, payload.message ?? null]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Task not found");
    }

    return this.normalizeTask(result.rows[0]);
  }

  private normalizeTask(row: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!row) {
      return {};
    }

    return {
      ...row,
      container_ids: row.target_container_ids ?? []
    };
  }
}
```

## Vue d’ensemble

`ScanQueueService` est le service métier derrière le controller de scan tasks. Il injecte `DatabaseService`, génère les IDs de tâches avec `randomUUID()`, manipule la table `scan_tasks`, et convertit le format de sortie DB en format d’API via `normalizeTask()`. `crypto.randomUUID()` est bien utilisé pour produire des UUID v4 côté Node. [geeksforgeeks](https://www.geeksforgeeks.org/node-js/node-js-crypto-randomuuid-function/)

## Imports

`Injectable` rend le service injectable dans Nest. `NotFoundException` est une exception HTTP native de Nest qui produit une réponse 404 quand elle n’est pas interceptée plus tôt. [github](https://github.com/nestjs/nest/blob/master/packages/common/exceptions/not-found.exception.ts)

`DatabaseService` apporte l’accès à PostgreSQL, y compris l’exécution transactionnelle correcte. `CreateScanTaskDto` et `CompleteScanTaskDto` typent les entrées métier déjà validées plus haut par la couche controller/pipe. [node-postgres](https://node-postgres.com/features/transactions)

## Constructeur

```ts
constructor(private readonly db: DatabaseService) {}
```

Le service reçoit sa dépendance DB via injection de dépendances Nest. Cela suit le pattern standard des providers Nest qui consomment d’autres providers au constructeur. [docs.nestjs](https://docs.nestjs.com/providers)

## `createTask(...)`

```ts
async createTask(payload: CreateScanTaskDto, requestedBy: string): Promise<Record<string, unknown>>
```

Cette méthode crée une nouvelle tâche dans l’état initial `queued`.

### Variables locales

```ts
const id = randomUUID();
const containerIds = payload.container_ids ?? [];
```

`id` est l’UUID de la tâche. `containerIds` vaut soit la liste fournie dans le DTO, soit un tableau vide si rien n’a été envoyé. [geeksforgeeks](https://www.geeksforgeeks.org/node-js/node-js-crypto-randomuuid-function/)

### Requête SQL

La requête fait un `INSERT` dans `scan_tasks` avec :
- `id`
- `mode`
- `status = 'queued'`
- `requested_by`
- `target_container_ids`
- `message`

Elle caste explicitement `JSON.stringify(containerIds)` en `jsonb` via `$4::jsonb`, ce qui correspond bien au type `JSONB` de la colonne dans ton schéma précédent.

### `RETURNING`

La requête utilise `RETURNING` pour récupérer immédiatement la ligne créée sans faire de second `SELECT`. PostgreSQL documente `RETURNING` précisément comme un moyen d’obtenir les données modifiées au moment du `INSERT` ou `UPDATE`. [postgresql](https://www.postgresql.org/docs/current/dml-returning.html)

### Retour

```ts
return this.normalizeTask(result.rows[0]);
```

Le service renvoie la ligne normalisée pour l’API.

## `listTasks()`

```ts
async listTasks(): Promise<Record<string, unknown>[]>
```

Cette méthode lit toutes les tâches de `scan_tasks` triées par `requested_at DESC`, donc de la plus récente à la plus ancienne.

### SQL

La requête sélectionne :
- les métadonnées d’identité,
- le statut,
- l’assignation,
- l’éventuel `scan_id`,
- les `target_container_ids`,
- les timestamps.

### Retour

Chaque ligne est transformée via `normalizeTask(row)` pour harmoniser le champ `container_ids`.

## `claimNextTask(agentId)`

```ts
async claimNextTask(agentId: string): Promise<Record<string, unknown> | null>
```

C’est la méthode la plus importante du service, car elle gère la concurrence entre plusieurs agents.

### Pourquoi une transaction

Elle utilise :

```ts
return this.db.transaction(async (client) => { ... })
```

C’est indispensable, car avec `node-postgres`, toutes les instructions d’une transaction doivent être exécutées avec le même client. [node-postgres](https://node-postgres.com/features/transactions)

### Étape 1 : sélectionner une candidate

```ts
SELECT id
FROM scan_tasks
WHERE status = 'queued'
ORDER BY requested_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1
```

Cette requête choisit la plus ancienne tâche `queued`, verrouille la ligne pour la transaction courante, et ignore celles déjà verrouillées par d’autres workers grâce à `SKIP LOCKED`. PostgreSQL documente bien que `SKIP LOCKED` saute les lignes qu’on ne peut pas verrouiller immédiatement, ce qui est très utile pour les queues concurrentes. [w3resource](https://www.w3resource.com/postgresql-exercises/postgresql-query-to-lock-rows-using-select-for-update-with-the-skip-locked-option-to-process-only-unlocked-rows.php)

### Pourquoi c’est bon pour une queue

Si deux agents appellent `claimNextTask()` en même temps :
- le premier locke une ligne,
- le second ignore cette ligne verrouillée,
- et tente la suivante disponible.

C’est exactement le pattern de distribution concurrente de jobs. [inferable](https://www.inferable.ai/blog/posts/postgres-skip-locked)

### Cas vide

```ts
if (candidate.rows.length === 0) {
  return null;
}
```

S’il n’y a aucune tâche `queued`, la méthode renvoie `null`.

### Étape 2 : marquer la tâche comme en cours

```ts
UPDATE scan_tasks
SET status = 'processing', claimed_by = $2, claimed_at = NOW()
WHERE id = $1
RETURNING ...
```

Une fois la ligne sélectionnée et verrouillée, la méthode la met à jour en :
- `processing`,
- `claimed_by = agentId`,
- `claimed_at = NOW()`.

Puis elle retourne la ligne mise à jour via `RETURNING`. Là encore, `RETURNING` évite une requête supplémentaire. [postgresql](https://www.postgresql.org/docs/current/dml-returning.html)

### Retour

La méthode renvoie la tâche normalisée, ou `null` s’il n’y avait rien à prendre.

## `completeTask(taskId, agentId, payload)`

```ts
async completeTask(taskId: string, agentId: string, payload: CompleteScanTaskDto): Promise<Record<string, unknown>>
```

Cette méthode finalise une tâche existante.

### SQL

La requête fait un `UPDATE scan_tasks` avec plusieurs règles intéressantes :

- `status = $2` : met le statut final reçu du DTO
- `scan_id = COALESCE($3, scan_id)` : ne remplace `scan_id` que si un nouveau `scan_id` est fourni
- `completed_at = NOW()` : marque la date de fin
- `claimed_by = COALESCE(claimed_by, $4)` : renseigne l’agent seulement si personne n’était déjà renseigné
- `message = COALESCE($5, message)` : remplace le message uniquement si un nouveau message est fourni

### Utilisation de `COALESCE`

`COALESCE(a, b)` retourne la première valeur non nulle. Ici, cela permet de faire des mises à jour partielles sans écraser les valeurs déjà présentes si le payload ne fournit rien. C’est une manière simple et efficace d’encoder un “patch” SQL.

### Vérification d’existence

```ts
if (result.rows.length === 0) {
  throw new NotFoundException("Task not found");
}
```

Si aucune ligne n’a été modifiée, cela veut dire que `id = taskId` n’existe pas. Le service lève alors une `NotFoundException`, ce qui devient une réponse HTTP 404 côté Nest. [docs.nestjs](https://docs.nestjs.com/exception-filters)

### Retour

Sinon, il renvoie la tâche normalisée après update.

## `normalizeTask(...)`

```ts
private normalizeTask(row: Record<string, unknown> | undefined): Record<string, unknown>
```

Cette méthode convertit un enregistrement DB brut vers un format de réponse plus pratique côté API.

### Cas vide

```ts
if (!row) {
  return {};
}
```

Si la ligne est absente ou indéfinie, elle renvoie un objet vide.

### Transformation

```ts
return {
  ...row,
  container_ids: row.target_container_ids ?? []
};
```

Elle conserve tous les champs originaux et ajoute `container_ids`, alias de `target_container_ids`.

### Intérêt

Cela permet au client API de consommer un nom plus naturel ou plus cohérent avec les DTO d’entrée, sans changer immédiatement le schéma SQL.

### Limite

Le champ `target_container_ids` n’est pas supprimé, donc le résultat contient à la fois :
- `target_container_ids`
- `container_ids`

C’est parfois pratique, mais parfois ambigu.

## Flux global

Le workflow complet du service est :

- `createTask()` : ajoute une ligne `queued`
- `listTasks()` : lit toutes les lignes
- `claimNextTask()` : choisit atomiquement la plus ancienne tâche disponible et la passe en `processing`
- `completeTask()` : termine une tâche avec statut, scan éventuel et message
- `normalizeTask()` : harmonise la forme de sortie

## Lecture architecturale

Ce service est bien pensé pour un système de queue simple basé sur PostgreSQL :

- pas besoin de Redis ou RabbitMQ pour un volume modéré,
- la DB joue à la fois le rôle de persistance et de file,
- `FOR UPDATE SKIP LOCKED` permet de faire du multi-worker sans doublon de claim. [alexstoica](https://alexstoica.com/blog/postgres-select-for-update-perf)

C’est un pattern très courant et robuste pour des workloads backend modestes à intermédiaires.

## Points d’attention

`completeTask()` ne vérifie pas que l’agent qui complète la tâche est bien celui qui l’a claimée. En l’état, n’importe quel agent authentifié avec le bon rôle pourrait compléter n’importe quelle tâche existante. C’est un choix métier possible, mais il faut en être conscient.

`completeTask()` n’empêche pas non plus :
- de compléter une tâche déjà `completed`,
- ou de passer une tâche de `failed` à `processing`,
puisque la transition d’état n’est pas contrainte ici au niveau applicatif.

`normalizeTask()` ajoute `container_ids` mais garde `target_container_ids`, donc l’API expose deux représentations proches de la même donnée.

Le type de retour `Record<string, unknown>` est fonctionnel mais peu expressif. Un type dédié `ScanTaskResponseDto` ou `ScanTask` serait plus propre pour la lisibilité et l’outillage TypeScript.

## Traduction simple

Ce service fait fonctionner la file de tâches :
- on crée une tâche,
- on peut lister les tâches,
- un agent prend la prochaine tâche libre,
- puis il la marque comme terminée.

Le point malin, c’est que PostgreSQL évite que deux agents prennent la même tâche en même temps grâce à `FOR UPDATE SKIP LOCKED`. [postgresql](https://www.postgresql.org/docs/current/sql-select.html)

## Conclusion technique

`ScanQueueService` est le **service métier de queue** pour `scan_tasks`. Il crée les tâches en `queued`, les liste, attribue la prochaine tâche libre via une transaction `SELECT ... FOR UPDATE SKIP LOCKED`, puis permet de compléter une tâche avec mise à jour partielle via `COALESCE`, en levant une `NotFoundException` si l’ID n’existe pas. [github](https://github.com/nestjs/nest/blob/master/packages/common/exceptions/not-found.exception.ts)

***
`scheduling.module` est un **feature module NestJS** qui regroupe deux responsabilités liées à l’orchestration : la file de tâches de scan et la mise à jour périodique des métadonnées CVE. Dans Nest, un module déclare ses controllers, ses providers, et éventuellement les providers qu’il rend visibles à d’autres modules via `exports`. [docs.nestjs](https://docs.nestjs.com/modules)

## Le code

```ts
import { Module } from "@nestjs/common";
import { CveUpdaterService } from "./cve-updater.service";
import { ScanQueueController } from "./scan-queue.controller";
import { ScanQueueService } from "./scan-queue.service";

@Module({
  controllers: [ScanQueueController],
  providers: [CveUpdaterService, ScanQueueService],
  exports: [ScanQueueService]
})
export class SchedulingModule {}
```

## Import `Module`

`Module` est le décorateur NestJS utilisé pour définir un module et sa metadata structurelle. La documentation Nest décrit `controllers`, `providers`, `imports` et `exports` comme les principaux champs de composition d’un module. [docs.nestjs](https://docs.nestjs.com/modules)

## `@Module({...})`

L’objet passé à `@Module()` décrit ce que le module contient et ce qu’il expose :
- `controllers: [ScanQueueController]`
- `providers: [CveUpdaterService, ScanQueueService]`
- `exports: [ScanQueueService]` [docs.nest-js](https://docs.nest-js.fr/modules)

Cela signifie que le module :
- instancie un controller HTTP,
- instancie deux services,
- rend `ScanQueueService` injectable ailleurs.

## `controllers: [ScanQueueController]`

Cette ligne enregistre `ScanQueueController` comme controller du module. Les controllers Nest sont responsables de recevoir les requêtes HTTP et de déléguer la logique métier aux services. [docs.nestjs](https://docs.nestjs.com/controllers)

### Conséquence

Toutes les routes de scan tasks définies dans `ScanQueueController` appartiennent fonctionnellement à `SchedulingModule`.

## `providers: [CveUpdaterService, ScanQueueService]`

Cette ligne déclare deux providers injectables dans le scope du module :
- `CveUpdaterService`
- `ScanQueueService`

Les providers sont les classes instanciées par l’injecteur Nest, comme les services, repositories, factories ou helpers. [docs.nestjs](https://docs.nestjs.com/providers)

### `ScanQueueService`

Il porte la logique métier de la queue :
- création,
- listing,
- claim,
- complétion des tâches.

### `CveUpdaterService`

Il porte la logique de fond planifiée :
- exécution au démarrage,
- cron périodique,
- journalisation des tentatives de refresh NVD.

Comme ces deux classes sont dans `providers`, Nest les instanciera dans le cycle de vie du module. Les hooks lifecycle comme `onModuleInit()` et `onModuleDestroy()` font partie du cycle de vie applicatif géré par Nest. [docs.nestjs](https://docs.nestjs.com/fundamentals/lifecycle-events)

## `exports: [ScanQueueService]`

Cette ligne expose `ScanQueueService` à d’autres modules qui importeraient `SchedulingModule`. Nest encapsule les providers par défaut, donc un provider doit être explicitement exporté pour devenir injectable à l’extérieur de son module hôte. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

### Conséquence

Un autre module pourra faire :

- `imports: [SchedulingModule]`
- puis injecter `ScanQueueService`

sans avoir à le redéclarer localement.

### Détail important

`CveUpdaterService` n’est pas exporté, donc il reste interne à `SchedulingModule`. Cela suggère que ce service est considéré comme une mécanique interne de scheduling, pas comme une API métier réutilisable.

## Classe `SchedulingModule`

```ts
export class SchedulingModule {}
```

La classe elle-même est vide, ce qui est normal pour un module Nest classique. La vraie configuration du module se trouve dans le décorateur `@Module(...)`. [docs.nestjs](https://docs.nestjs.com/modules)

## Lecture architecturale

Ce module mélange deux sous-domaines proches :
- la **queue de scan** exposée en HTTP,
- le **job périodique CVE** exécuté en arrière-plan.

Ce regroupement a du sens si tu interprètes “scheduling” comme “tout ce qui orchestre des traitements asynchrones ou planifiés”. `ScanQueueController` et `ScanQueueService` gèrent des tâches distribuées aux agents, tandis que `CveUpdaterService` gère une tâche périodique interne au backend.

## Point intéressant sur le cycle de vie

Comme `CveUpdaterService` est un provider du module et implémente des hooks lifecycle, il sera démarré avec le module. Nest documente le cycle de vie global, mais il existe aussi une subtilité récente discutée côté framework : l’ordre exact des hooks entre providers d’un même module n’est pas toujours garanti de manière topologique stricte. [github](https://github.com/nestjs/nest/issues/14773)

Dans ton cas, ce n’est pas forcément problématique, car :
- `CveUpdaterService` dépend surtout de `DatabaseService`,
- pas de `ScanQueueService`,
- donc il n’y a pas ici de dépendance croisée évidente entre providers du même module.

## Lecture par responsabilité

| Élément | Rôle |
|---|---|
| `SchedulingModule` | frontière fonctionnelle du domaine scheduling |
| `ScanQueueController` | couche HTTP pour `scan_tasks` |
| `ScanQueueService` | logique métier de queue |
| `CveUpdaterService` | job de fond périodique NVD |
| `exports: [ScanQueueService]` | partage la logique de queue avec d’autres modules |

## Traduction simple

Tu peux voir ce module comme :

- la boîte “orchestration / scheduling”,
- dedans il y a un endpoint HTTP pour gérer les tâches de scan,
- et un service de fond qui vérifie régulièrement les métadonnées CVE,
- et seul le service de queue est réutilisable depuis d’autres modules.

## Conclusion technique

`SchedulingModule` est un **module NestJS de scheduling/orchestration** qui enregistre `ScanQueueController` comme controller HTTP, `ScanQueueService` et `CveUpdaterService` comme providers internes, puis exporte `ScanQueueService` pour le rendre injectable dans d’autres modules. Cela reflète bien l’encapsulation des providers par module dans Nest et l’usage des hooks lifecycle pour les services de fond comme `CveUpdaterService`. [docs.nestjs](https://docs.nestjs.com/fundamentals/custom-providers)

Le fichier le plus logique à analyser ensuite, c’est soit `app.module.ts` pour voir l’assemblage global, soit `scans.controller.ts` s’il te manque encore la couche HTTP des scans.
