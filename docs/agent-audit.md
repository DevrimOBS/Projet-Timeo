Voici un breakdown détaillé du fichier, en Markdown, centré sur les variables et les fonctions.

***

## Vue d’ensemble du programme

Ce `main.go` est l’**agent** qui :  
- récupère une configuration, réclame une tâche de scan à l’API,  
- découvre les conteneurs Docker locaux,  
- scanne les images (via Trivy),  
- agrège les vulnérabilités par conteneur,  
- envoie un rapport à l’API puis marque la tâche comme complétée.

***

## Fonction `main`

```go
func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("configuration error: %v", err)
    }

    ctx, cancel := context.WithTimeout(context.Background(), cfg.ScanTimeout)
    defer cancel()

    task, err := transport.ClaimTask(ctx, cfg.TaskClaimEndpoint(), cfg.APIToken, cfg.RequestTimeout, cfg.InsecureSkipTLSVerify)
    if err != nil {
        log.Printf("task claim error: %v", err)
    }

    containers, err := dockerclient.Discover(ctx, cfg.DockerSocket)
    if err != nil {
        log.Fatalf("docker discovery error: %v", err)
    }

    scanType := cfg.ScanType
    if task != nil {
        if task.Mode != "" {
            scanType = task.Mode
        }
        containers = filterContainers(containers, task.ContainerIDs)
    }

    imageFindings := make(map[string][]models.Vulnerability)
    reports := make([]models.ContainerReport, 0, len(containers))
    for _, container := range containers {
        imageRef := container.ReferenceImage()
        findings, ok := imageFindings[imageRef]
        if !ok {
            if cfg.TrivyEnabled {
                findings, err = scanner.ScanImage(ctx, cfg.TrivyPath, imageRef)
                if err != nil {
                    log.Printf("scan error for %s: %v", imageRef, err)
                    findings = []models.Vulnerability{}
                }
            } else {
                findings = []models.Vulnerability{}
            }
            imageFindings[imageRef] = findings
        }

        highestScore := highestCVSS(findings)
        reports = append(reports, models.ContainerReport{
            ID:                 container.ID,
            Name:               container.DisplayName(),
            Image:              imageRef,
            Status:             container.Status,
            CreatedAt:          time.Unix(container.Created, 0).UTC(),
            Vulnerabilities:    findings,
            VulnerabilityCount: len(findings),
            HighestCVSS:        highestScore,
            RiskLevel:          riskLevel(highestScore),
        })
    }

    report := models.ScanReport{
        AgentID:    cfg.AgentID,
        Timestamp:  time.Now().UTC(),
        ScanType:   scanType,
        Containers: reports,
        Summary:    summarize(reports),
    }

    scanID, err := transport.SendReport(ctx, cfg.Endpoint(), report, cfg.APIToken, cfg.RequestTimeout, cfg.InsecureSkipTLSVerify)
    if err != nil {
        log.Fatalf("report send error: %v", err)
    }

    if task != nil {
        if err := transport.CompleteTask(ctx, cfg.TaskCompleteEndpoint(task.ID), cfg.APIToken, cfg.RequestTimeout, cfg.InsecureSkipTLSVerify, transport.TaskActionPayload{ScanID: scanID, Status: "completed"}); err != nil {
            log.Printf("task completion error: %v", err)
        }
    }

    log.Printf("scan completed: %d containers, %d vulnerabilities, avg risk %.2f", len(report.Containers), report.Summary.TotalVulnerabilities, report.Summary.GlobalRiskScore)
}
```

### Variables principales

- `cfg` (`config.Config` probable) : configuration de l’agent (timeouts, token API, endpoints, socket Docker, etc.), chargée via `config.Load()`.  
- `err` (`error`) : variable d’erreur réutilisée tout au long de la fonction pour tester les erreurs des appels.  
- `ctx` (`context.Context`) : contexte racine avec timeout, utilisé pour borner la durée totale des opérations (claim, discovery, scan, report). [pkg.go](https://pkg.go.dev/context)
- `cancel` (`context.CancelFunc`) : fonction appelée en `defer` pour libérer les ressources associées au contexte. [kelche](https://www.kelche.co/blog/go/golang-context/)
- `task` (type `*models.Task` ou similaire) : tâche de scan récupérée depuis l’API, peut être `nil` si aucun job n’est disponible.  
- `containers` (`[]dockerclient.Container`) : liste des conteneurs Docker découverts sur l’hôte via `dockerclient.Discover`.  
- `scanType` (`string`) : type de scan (par exemple “full”, “quick”, etc.), initialisé depuis la config puis éventuellement surchargé par `task.Mode`.  
- `imageFindings` (`map[string][]models.Vulnerability`) : cache associant chaque image Docker (`imageRef`) à la liste de vulnérabilités trouvées, pour éviter de rescanner la même image pour plusieurs conteneurs. [reintech](https://reintech.io/blog/working-with-maps-and-structs-in-go)
- `reports` (`[]models.ContainerReport`) : slice de rapports par conteneur, alimenté dans la boucle sur `containers`.  
- `imageRef` (`string`) : référence d’image Docker du conteneur courant (ex: `nginx:1.21`).  
- `findings` (`[]models.Vulnerability`) : liste de vulnérabilités associées à une image.  
- `ok` (`bool`) : indique si `imageRef` était déjà présent dans le `map` `imageFindings`.  
- `highestScore` (`float64`) : score CVSS maximal parmi les vulnérabilités de l’image courante.  
- `report` (`models.ScanReport`) : rapport global de scan envoyé à l’API, incluant conteneurs et résumé.  
- `scanID` (`string` ou `int`) : identifiant de scan renvoyé par l’API lors de `SendReport`, utilisé ensuite pour marquer la tâche comme complétée.

### Comportement étape par étape

1. Charge la configuration avec `config.Load()` et stoppe le programme si la configuration est invalide.  
2. Crée un contexte avec timeout global `cfg.ScanTimeout` pour contrôler la durée globale du scan et des appels réseau. [golang](https://golang.cafe/blog/golang-context-with-timeout-example)
3. Tente de réclamer une tâche de scan via `transport.ClaimTask(...)`. En cas d’erreur, loggue mais continue (scan “spontané” sans tâche).  
4. Découvre les conteneurs via `dockerclient.Discover(...)`. En cas d’échec, le programme s’arrête car il ne peut rien scanner.  
5. Détermine le `scanType` : valeur par défaut depuis la config, éventuellement remplacée par `task.Mode` si une tâche est présente.  
6. Si une tâche existe, restreint la liste de conteneurs à ceux dont l’ID est listé dans `task.ContainerIDs` via `filterContainers`.  
7. Prépare un cache `imageFindings` et un slice `reports` pour construire les rapports.  
8. Pour chaque conteneur :  
   - calcule `imageRef` (image utilisée),  
   - si l’image n’a pas encore été scannée :  
     - lance `scanner.ScanImage` si `cfg.TrivyEnabled` est vrai, sinon met une liste vide,  
     - en cas d’erreur de scan, loggue l’erreur et considère l’image comme sans vulnérabilité,  
     - stocke le résultat dans `imageFindings` pour réutilisation.  
   - calcule le `highestScore` avec `highestCVSS(findings)`,  
   - crée un `models.ContainerReport` avec ID, nom, image, statut, date de création, vulnérabilités, nombre et niveau de risque, et l’ajoute à `reports`.  
9. Construit un `models.ScanReport` global : agent, timestamp, type de scan, liste de rapports conteneur, résumé via `summarize(reports)`.  
10. Envoie ce rapport à l’API via `transport.SendReport`; si ça échoue, le programme s’arrête (échec critique).  
11. Si une tâche avait été réclamée, appelle `transport.CompleteTask` avec le `scanID` et le statut `"completed"`, loggue en cas d’erreur mais ne stoppe pas.  
12. Loggue un résumé final du scan (nombre de conteneurs, total de vulnérabilités, risque moyen).

***

## Fonction `highestCVSS`

```go
func highestCVSS(findings []models.Vulnerability) float64 {
    highest := 0.0
    for _, finding := range findings {
        if finding.CVSS > highest {
            highest = finding.CVSS
        }
    }
    return highest
}
```

### Variables

- Paramètre `findings` : slice de `models.Vulnerability`, chaque élément représentant une vulnérabilité avec au moins un champ `CVSS` (score numérique).  
- `highest` (`float64`) : accumulateur qui garde le score CVSS maximum rencontré lors de l’itération.

### Rôle

- Parcourt la liste des vulnérabilités et renvoie le **score CVSS maximal** trouvé.  
- Si la liste est vide, renvoie 0.0 (aucune vulnérabilité ou score non renseigné). [tsapps.nist](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=51198)

### Comportement

1. Initialise `highest` à 0.  
2. Pour chaque `finding` dans `findings`, compare `finding.CVSS` à `highest`.  
3. Si le score est plus grand, met à jour `highest`.  
4. À la fin de la boucle, renvoie `highest`.

***

## Fonction `riskLevel`

```go
func riskLevel(score float64) string {
    switch {
    case score >= 9.0:
        return "CRITIQUE"
    case score >= 7.0:
        return "HAUT"
    case score >= 4.0:
        return "MOYEN"
    case score > 0:
        return "FAIBLE"
    default:
        return "SAIN"
    }
}
```

### Variable

- Paramètre `score` (`float64`) : score CVSS maximal du conteneur, tel que renvoyé par `highestCVSS`.

### Rôle

- Convertit un **score CVSS** en une étiquette de **niveau de risque** lisible : `CRITIQUE`, `HAUT`, `MOYEN`, `FAIBLE`, ou `SAIN`.  
- Les seuils sont inspirés de découpages classiques (0–3.9 faible, 4–6.9 moyen, 7–8.9 haut, 9–10 critique). [knowledgebase.paloaltonetworks](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA14u0000004NCiCAM)

### Comportement

- `score >= 9.0` → `"CRITIQUE"`  
- `score >= 7.0` → `"HAUT"`  
- `score >= 4.0` → `"MOYEN"`  
- `score > 0` → `"FAIBLE"`  
- `score == 0` → `"SAIN"`  

***

## Fonction `summarize`

```go
func summarize(containers []models.ContainerReport) models.Summary {
    summary := models.Summary{TotalContainers: len(containers)}
    var totalRisk float64
    for _, container := range containers {
        if container.VulnerabilityCount == 0 {
            summary.HealthyContainers++
        } else {
            summary.VulnerableContainers++
        }
        summary.TotalVulnerabilities += container.VulnerabilityCount
        totalRisk += container.HighestCVSS
    }
    if len(containers) > 0 {
        summary.GlobalRiskScore = totalRisk / float64(len(containers))
    }
    return summary
}
```

### Variables

- Paramètre `containers` : slice de `models.ContainerReport`, rapports individuels générés dans `main`.  
- `summary` (`models.Summary`) : structure agrégée contenant statistiques globales (total de conteneurs, vulnérables, sains, total de vulnérabilités, score de risque global).  
- `totalRisk` (`float64`) : somme des `HighestCVSS` de chaque conteneur, utilisée pour calculer le risque moyen.

### Rôle

- Calculer un **résumé global** du scan à partir des rapports conteneurs.  
- Donne une vue synthétique : combien de conteneurs vulnérables, combien de vulnérabilités au total et un score de risque moyen.

### Comportement

1. Initialise `summary.TotalContainers` avec le nombre de conteneurs.  
2. Itère sur chaque `container` :  
   - incrémente `HealthyContainers` ou `VulnerableContainers` selon `VulnerabilityCount`,  
   - ajoute `container.VulnerabilityCount` à `TotalVulnerabilities`,  
   - ajoute `container.HighestCVSS` à `totalRisk`.  
3. Si la liste n’est pas vide, calcule `GlobalRiskScore` = `totalRisk / nombre de conteneurs`.  
4. Renvoie `summary`.

***

## Fonction `filterContainers`

```go
func filterContainers(containers []dockerclient.Container, containerIDs []string) []dockerclient.Container {
    if len(containerIDs) == 0 {
        return containers
    }

    allowed := make(map[string]struct{}, len(containerIDs))
    for _, id := range containerIDs {
        trimmed := strings.TrimSpace(id)
        if trimmed != "" {
            allowed[trimmed] = struct{}{}
        }
    }

    filtered := make([]dockerclient.Container, 0, len(containers))
    for _, container := range containers {
        if _, ok := allowed[container.ID]; ok {
            filtered = append(filtered, container)
        }
    }

    return filtered
}
```

### Variables

- Paramètre `containers` (`[]dockerclient.Container`) : liste de conteneurs découverte sur l’hôte.  
- Paramètre `containerIDs` (`[]string`) : liste d’IDs de conteneurs autorisés, fournie par la tâche.  
- `allowed` (`map[string]struct{}`) : ensemble d’IDs de conteneurs autorisés, utilisé pour tester en O(1) si un conteneur doit être gardé. [go](https://go.dev/blog/maps)
- `id` (`string`) : élément courant de `containerIDs` dans la première boucle.  
- `trimmed` (`string`) : version trimée de `id` (sans espaces autour), pour éviter les problèmes de formatage.  
- `filtered` (`[]dockerclient.Container`) : slice de conteneurs filtrés qui seront retournés.

### Rôle

- Restreindre la liste de conteneurs aux seuls IDs explicitement demandés.  
- Si `containerIDs` est vide, ne filtre rien et renvoie la liste entière.

### Comportement

1. Si `containerIDs` est vide, renvoie immédiatement `containers`.  
2. Crée un `map` `allowed` pour stocker les IDs autorisés.  
3. Pour chaque `id` dans `containerIDs` :  
   - enlève les espaces avec `strings.TrimSpace`,  
   - si `trimmed` n’est pas vide, l’ajoute dans `allowed` avec une valeur vide `struct{}` (pattern classique pour un set en Go). [go](https://go.dev/blog/maps)
4. Initialise `filtered` comme slice vide avec capacité max `len(containers)`.  
5. Parcourt chaque `container` de `containers` :  
   - si `container.ID` est dans `allowed`, l’ajoute à `filtered`.  
6. Renvoie `filtered`.

***

### Petit tableau récap des fonctions

| Fonction         | Entrées principales                           | Sortie                        | Rôle synthétique                                              |
|------------------|-----------------------------------------------|-------------------------------|---------------------------------------------------------------|
| `main`           | config, Docker, API, scanner                  | `void` (side-effects)         | Orchestration complète d’un scan + envoi du rapport          |
| `highestCVSS`    | `[]Vulnerability`                             | `float64`                     | Score CVSS maximal pour une image                            |
| `riskLevel`      | `float64` (score)                             | `string`                      | Traduction score → niveau de risque humain                   |
| `summarize`      | `[]ContainerReport`                           | `Summary`                     | Agrégation des stats globales du scan                        |
| `filterContainers` | `[]Container`, `[]string` (IDs autorisés)   | `[]Container`                 | Filtrage des conteneurs selon la tâche                       |

***

Voici le breakdown de `config.go`, toujours en mode explication fonctionnelle en Markdown.

***

## Vue d’ensemble

Ce fichier gère toute la **configuration** de l’agent : valeurs par défaut, lecture d’un fichier de config, surcharge par variables d’environnement, validation, puis construction des endpoints API. Les variables d’environnement sont un mécanisme standard pour injecter la configuration d’un programme, et `os.Getenv` renvoie une chaîne vide si la variable n’existe pas. [gobyexample](https://gobyexample.com/environment-variables)

***

## Struct `Config`

```go
type Config struct {
    AgentID                 string
    APIURL                  string
    APIToken                string
    DockerSocket            string
    TrivyPath               string
    TrivyEnabled            bool
    ScanType                string
    RequestTimeout          time.Duration
    ScanTimeout             time.Duration
    InsecureSkipTLSVerify   bool
    ConfigFile              string
}
```

### Variables / champs

- `AgentID` (`string`) : identifiant unique ou logique de l’agent, utilisé pour identifier la source d’un scan.  
- `APIURL` (`string`) : URL de base de l’API centrale à contacter.  
- `APIToken` (`string`) : token d’authentification envoyé aux endpoints API.  
- `DockerSocket` (`string`) : chemin du socket Docker, par exemple `/var/run/docker.sock`, utilisé pour découvrir les conteneurs.  
- `TrivyPath` (`string`) : chemin ou nom de l’exécutable Trivy à lancer.  
- `TrivyEnabled` (`bool`) : active ou désactive le scan de vulnérabilités via Trivy.  
- `ScanType` (`string`) : type logique du scan, par exemple un mode manuel/global.  
- `RequestTimeout` (`time.Duration`) : timeout des appels réseau individuels. Une `time.Duration` se parse via `time.ParseDuration` avec des formats comme `30s`, `5m`, `1h30m`. [gohugo](https://gohugo.io/functions/time/parseduration/)
- `ScanTimeout` (`time.Duration`) : durée maximale autorisée pour le scan global.  
- `InsecureSkipTLSVerify` (`bool`) : indique si la vérification TLS doit être désactivée côté client HTTP.  
- `ConfigFile` (`string`) : chemin du fichier de configuration réellement utilisé, pratique pour savoir d’où viennent les valeurs.

### Rôle

- Cette struct centralise toutes les options nécessaires au fonctionnement de l’agent.  
- Elle évite de disperser les paramètres dans plusieurs variables globales et donne un objet unique à transmettre au reste du programme.

***

## Fonction `Load`

```go
func Load() (Config, error) {
    cfg := Config{
        AgentID:        "novisec-agent-001",
        APIURL:         "http://api:3001",
        DockerSocket:   "/var/run/docker.sock",
        TrivyPath:      "trivy",
        TrivyEnabled:   true,
        ScanType:       "MANUAL_GLOBAL",
        RequestTimeout: 30 * time.Second,
        ScanTimeout:    15 * time.Minute,
    }

    for _, candidate := range candidateConfigFiles() {
        if _, err := os.Stat(candidate); err == nil {
            values, err := readKeyValueFile(candidate)
            if err != nil {
                return Config{}, err
            }
            applyValues(&cfg, values)
            cfg.ConfigFile = candidate
            break
        }
    }

    applyEnv(&cfg)
    if err := cfg.Validate(); err != nil {
        return Config{}, err
    }

    if cfg.ConfigFile == "" {
        cfg.ConfigFile = filepath.Join("configs", "agent.example.yaml")
    }

    return cfg, nil
}
```

### Variables

- `cfg` (`Config`) : structure de configuration en cours de construction.  
- `candidate` (`string`) : chemin candidat parmi les fichiers de configuration possibles.  
- `values` (`map[string]string`) : paires clé/valeur lues depuis le fichier de configuration.  
- `err` (`error`) : variable d’erreur utilisée à plusieurs étapes.

### Rôle

- Charger la configuration finale de l’agent en appliquant un ordre de priorité logique :  
  1. valeurs par défaut,  
  2. fichier de configuration trouvé,  
  3. variables d’environnement,  
  4. validation finale.  
- Ce pattern “defaults puis override” est très courant dans les applications Go configurées par environnement. [leapcell](https://leapcell.io/blog/understanding-environment-variables-in-golang)

### Comportement

1. Initialise `cfg` avec des **valeurs par défaut** sûres ou pratiques pour un environnement Docker local.  
2. Appelle `candidateConfigFiles()` pour obtenir la liste des fichiers à tester.  
3. Pour chaque `candidate`, utilise `os.Stat` pour vérifier si le fichier existe.  
4. Dès qu’un fichier existe :  
   - lit son contenu avec `readKeyValueFile`,  
   - applique ses valeurs à `cfg` avec `applyValues`,  
   - mémorise le chemin dans `cfg.ConfigFile`,  
   - puis sort de la boucle avec `break`.  
5. Appelle `applyEnv(&cfg)` pour surcharger les valeurs avec les variables d’environnement, qui ont donc la priorité sur le fichier.  
6. Appelle `cfg.Validate()` pour vérifier que les champs obligatoires sont présents.  
7. Si aucun fichier réel n’a été trouvé, affecte à `ConfigFile` la valeur `configs/agent.example.yaml` construite avec `filepath.Join`, qui sert alors surtout de référence/documentation. `filepath.Join` permet de construire un chemin portable selon l’OS. [gobyexample](https://gobyexample.com/file-paths)
8. Renvoie la configuration finale.

### Idée importante

L’ordre de priorité implicite est :

- défauts internes,
- fichier de config,
- variables d’environnement.

C’est souvent exactement ce qu’on veut dans une appli déployable en conteneur. [dev](https://dev.to/craicoverflow/a-no-nonsense-guide-to-environment-variables-in-go-a2f)

***

## Fonction `Validate`

```go
func (c Config) Validate() error {
    if strings.TrimSpace(c.AgentID) == "" {
        return errors.New("agent id is required")
    }
    if strings.TrimSpace(c.APIURL) == "" {
        return errors.New("api url is required")
    }
    if strings.TrimSpace(c.DockerSocket) == "" {
        return errors.New("docker socket path is required")
    }
    return nil
}
```

### Variable

- `c` (`Config`) : copie de la configuration à valider.

### Rôle

- Vérifier que les champs **minimums** nécessaires au fonctionnement sont bien renseignés.  
- `strings.TrimSpace` sert ici à éviter qu’une chaîne composée seulement d’espaces soit considérée comme valide. [github](https://github.com/go-swagger/go-swagger/issues/1530)

### Comportement

- Si `AgentID` est vide ou ne contient que des espaces, renvoie une erreur.  
- Même logique pour `APIURL` et `DockerSocket`.  
- Si tout est correct, renvoie `nil`.

### Remarque

- La validation ici est volontairement simple : elle vérifie la présence, pas le format détaillé de l’URL ni l’accessibilité réelle du socket.

***

## Fonction `Endpoint`

```go
func (c Config) Endpoint() string {
    trimmed := strings.TrimSpace(c.APIURL)
    if trimmed == "" {
        return ""
    }
    if strings.Contains(trimmed, "/api/") {
        return trimmed
    }
    if strings.HasSuffix(trimmed, "/") {
        return trimmed + "api/scans"
    }
    return trimmed + "/api/scans"
}
```

### Variables

- `c` (`Config`) : configuration courante.  
- `trimmed` (`string`) : version nettoyée de `c.APIURL` sans espaces autour.

### Rôle

- Construire l’endpoint complet utilisé pour envoyer les rapports de scan.  
- La fonction accepte soit une base d’URL simple, soit une URL qui contient déjà `/api/`.

### Comportement

1. Nettoie `APIURL` avec `TrimSpace`.  
2. Si l’URL est vide, renvoie `""`.  
3. Si `trimmed` contient déjà `"/api/"`, la fonction considère que l’URL est déjà suffisamment spécifique et la renvoie telle quelle.  
4. Sinon, si l’URL finit par `/`, ajoute `api/scans`.  
5. Sinon, ajoute `/api/scans`.

### Exemple

- `http://api:3001` → `http://api:3001/api/scans`  
- `http://api:3001/` → `http://api:3001/api/scans`  
- `http://api:3001/api/scans` → inchangé

***

## Fonction `TaskClaimEndpoint`

```go
func (c Config) TaskClaimEndpoint() string {
    trimmed := strings.TrimSpace(c.APIURL)
    if trimmed == "" {
        return ""
    }
    return strings.TrimRight(trimmed, "/") + "/api/scan-tasks/claim"
}
```

### Variables

- `trimmed` (`string`) : URL API nettoyée.  

### Rôle

- Construire l’endpoint utilisé pour **réclamer une tâche de scan** depuis l’API.

### Comportement

- Si `APIURL` est vide, renvoie `""`.  
- Sinon, supprime les `/` finaux avec `strings.TrimRight(trimmed, "/")`, puis concatène `/api/scan-tasks/claim`.

### Exemple

- `http://api:3001/` → `http://api:3001/api/scan-tasks/claim`

***

## Fonction `TaskCompleteEndpoint`

```go
func (c Config) TaskCompleteEndpoint(taskID string) string {
    trimmed := strings.TrimSpace(c.APIURL)
    taskID = strings.TrimSpace(taskID)
    if trimmed == "" || taskID == "" {
        return ""
    }
    return strings.TrimRight(trimmed, "/") + "/api/scan-tasks/" + taskID + "/complete"
}
```

### Variables

- `trimmed` (`string`) : URL API nettoyée.  
- `taskID` (`string`) : identifiant de la tâche, également nettoyé.

### Rôle

- Construire l’endpoint qui sert à marquer une tâche spécifique comme terminée.

### Comportement

1. Nettoie `APIURL` et `taskID`.  
2. Si l’un des deux est vide, renvoie `""`.  
3. Sinon, construit l’URL finale de la forme :  
   `/api/scan-tasks/{taskID}/complete`

### Exemple

- `APIURL = http://api:3001` et `taskID = abc123`  
  → `http://api:3001/api/scan-tasks/abc123/complete`

***

## Fonction `candidateConfigFiles`

```go
func candidateConfigFiles() []string {
    return []string{
        os.Getenv("AGENT_CONFIG_FILE"),
        filepath.Join("configs", "agent.yaml"),
        filepath.Join("configs", "agent.example.yaml"),
    }
}
```

### Variables

- Pas de variable locale importante hors retour direct.  
- Utilise `os.Getenv("AGENT_CONFIG_FILE")` pour permettre de forcer un chemin explicite depuis l’environnement. `os.Getenv` renvoie une chaîne vide si la variable n’existe pas. [gobyexample](https://gobyexample.com/environment-variables)

### Rôle

- Définir la liste ordonnée des fichiers de configuration à tester.

### Ordre de recherche

1. `AGENT_CONFIG_FILE`  
2. `configs/agent.yaml`  
3. `configs/agent.example.yaml`

### Idée

- Le premier chemin trouvé et lisible sera utilisé dans `Load`.  
- `filepath.Join` est utilisé pour construire les chemins de manière portable. [gobyexample](https://gobyexample.com/file-paths)

***

## Fonction `readKeyValueFile`

```go
func readKeyValueFile(path string) (map[string]string, error) {
    file, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer file.Close()

    values := make(map[string]string)
    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        line := strings.TrimSpace(scanner.Text())
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }
        parts := strings.SplitN(line, ":", 2)
        if len(parts) != 2 {
            continue
        }
        key := strings.TrimSpace(parts[0])
        value := strings.TrimSpace(parts [gobyexample](https://gobyexample.com/environment-variables))
        value = strings.Trim(value, `"'`)
        values[strings.ToLower(key)] = value
    }
    if err := scanner.Err(); err != nil {
        return nil, err
    }
    return values, nil
}
```

### Variables

- `path` (`string`) : chemin du fichier à lire.  
- `file` (`*os.File`) : fichier ouvert.  
- `values` (`map[string]string`) : map résultat contenant les clés/valeurs extraites.  
- `scanner` (`*bufio.Scanner`) : lecteur ligne par ligne.  
- `line` (`string`) : ligne courante nettoyée.  
- `parts` (`[]string`) : découpage de la ligne autour du premier `:` seulement.  
- `key` (`string`) : nom de clé après trim.  
- `value` (`string`) : valeur après trim et suppression de quotes autour.

### Rôle

- Lire un fichier texte de type **clé: valeur** et le transformer en `map[string]string`.  
- Même si le nom du fichier finit en `.yaml`, le parseur ici reste très simple et ne gère pas un vrai YAML complet.

### Comportement

1. Ouvre le fichier avec `os.Open`.  
2. Initialise un scanner ligne par ligne.  
3. Pour chaque ligne :  
   - supprime les espaces de début/fin,  
   - ignore les lignes vides et les commentaires `#`,  
   - coupe au premier `:` avec `strings.SplitN(line, ":", 2)`,  
   - si la ligne n’a pas exactement deux morceaux, elle est ignorée,  
   - nettoie clé et valeur,  
   - enlève les quotes simples ou doubles autour de la valeur,  
   - stocke la paire dans `values` avec une clé mise en minuscules.  
4. Vérifie les erreurs de lecture via `scanner.Err()`.  
5. Renvoie la map résultante.

### Point important

- Ce lecteur **n’est pas un vrai parseur YAML**. Il supporte surtout des lignes simples du style :

```yaml
AgentID: novisec-agent-001
APIURL: http://api:3001
TrivyEnabled: true
```

- Il ne gère pas bien les structures imbriquées, listes, multi-lignes, ou la richesse syntaxique complète de YAML.

***

## Fonction `applyValues`

```go
func applyValues(cfg *Config, values map[string]string) {
    if v, ok := values["agentid"]; ok && v != "" {
        cfg.AgentID = v
    }
    if v, ok := values["apiurl"]; ok && v != "" {
        cfg.APIURL = v
    }
    if v, ok := values["apitoken"]; ok && v != "" {
        cfg.APIToken = v
    }
    if v, ok := values["dockersocket"]; ok && v != "" {
        cfg.DockerSocket = v
    }
    if v, ok := values["trivypath"]; ok && v != "" {
        cfg.TrivyPath = v
    }
    if v, ok := values["trivyenabled"]; ok && v != "" {
        if parsed, err := strconv.ParseBool(v); err == nil {
            cfg.TrivyEnabled = parsed
        }
    }
    if v, ok := values["scantype"]; ok && v != "" {
        cfg.ScanType = v
    }
    if v, ok := values["requesttimeout"]; ok && v != "" {
        if parsed, err := time.ParseDuration(v); err == nil {
            cfg.RequestTimeout = parsed
        }
    }
    if v, ok := values["scantimeout"]; ok && v != "" {
        if parsed, err := time.ParseDuration(v); err == nil {
            cfg.ScanTimeout = parsed
        }
    }
    if v, ok := values["insecureskiptlsverify"]; ok && v != "" {
        if parsed, err := strconv.ParseBool(v); err == nil {
            cfg.InsecureSkipTLSVerify = parsed
        }
    }
}
```

### Variables

- `cfg` (`*Config`) : pointeur vers la configuration à modifier.  
- `values` (`map[string]string`) : map issue du fichier de configuration.  
- `v` (`string`) : valeur lue pour une clé donnée.  
- `ok` (`bool`) : indique si la clé existe dans la map.  
- `parsed` : valeur convertie (`bool` ou `time.Duration`) selon le champ.  
- `err` (`error`) : erreur éventuelle de conversion.

### Rôle

- Appliquer au `Config` les valeurs issues du fichier texte.  
- La fonction ne remplace un champ que si la clé existe et que la valeur n’est pas vide.

### Comportement

- Pour les champs texte (`AgentID`, `APIURL`, etc.), recopie directement la valeur.  
- Pour les booléens (`TrivyEnabled`, `InsecureSkipTLSVerify`), tente un `strconv.ParseBool`.  
- Pour les durées (`RequestTimeout`, `ScanTimeout`), tente un `time.ParseDuration`, qui accepte des formats comme `30s`, `10m`, `1h`. [geeksforgeeks](https://www.geeksforgeeks.org/go-language/time-parseduration-function-in-golang-with-examples/)
- Si une conversion échoue, la valeur est simplement ignorée et l’ancienne valeur de `cfg` est conservée.

### Idée importante

- Le choix ici est **tolérant** : une mauvaise valeur n’interrompt pas le chargement, elle est juste ignorée.  
- Donc `applyValues` fait une surcharge “best effort”.

***

## Fonction `applyEnv`

```go
func applyEnv(cfg *Config) {
    if v := strings.TrimSpace(os.Getenv("AGENT_ID")); v != "" {
        cfg.AgentID = v
    }
    if v := strings.TrimSpace(os.Getenv("API_URL")); v != "" {
        cfg.APIURL = v
    }
    if v := strings.TrimSpace(os.Getenv("API_TOKEN")); v != "" {
        cfg.APIToken = v
    }
    if v := strings.TrimSpace(os.Getenv("DOCKER_SOCKET")); v != "" {
        cfg.DockerSocket = v
    }
    if v := strings.TrimSpace(os.Getenv("TRIVY_PATH")); v != "" {
        cfg.TrivyPath = v
    }
    if v := strings.TrimSpace(os.Getenv("TRIVY_ENABLED")); v != "" {
        if parsed, err := strconv.ParseBool(v); err == nil {
            cfg.TrivyEnabled = parsed
        }
    }
    if v := strings.TrimSpace(os.Getenv("SCAN_TYPE")); v != "" {
        cfg.ScanType = v
    }
    if v := strings.TrimSpace(os.Getenv("REQUEST_TIMEOUT")); v != "" {
        if parsed, err := time.ParseDuration(v); err == nil {
            cfg.RequestTimeout = parsed
        }
    }
    if v := strings.TrimSpace(os.Getenv("SCAN_TIMEOUT")); v != "" {
        if parsed, err := time.ParseDuration(v); err == nil {
            cfg.ScanTimeout = parsed
        }
    }
    if v := strings.TrimSpace(os.Getenv("INSECURE_SKIP_TLS_VERIFY")); v != "" {
        if parsed, err := strconv.ParseBool(v); err == nil {
            cfg.InsecureSkipTLSVerify = parsed
        }
    }
}
```

### Variables

- `cfg` (`*Config`) : configuration à modifier.  
- `v` (`string`) : valeur lue depuis une variable d’environnement.  
- `parsed` : résultat converti pour booléens et durées.

### Rôle

- Surcharger la configuration avec les **variables d’environnement**, qui ont ici la priorité la plus forte.  
- C’est une approche standard en conteneurisation et déploiement cloud. [dev](https://dev.to/craicoverflow/a-no-nonsense-guide-to-environment-variables-in-go-a2f)

### Comportement

- Lit chaque variable d’environnement via `os.Getenv(...)`.  
- Nettoie la valeur avec `TrimSpace`.  
- Si elle est non vide, remplace le champ correspondant dans `cfg`.  
- Pour les booléens, utilise `strconv.ParseBool`.  
- Pour les durées, utilise `time.ParseDuration`. [gohugo](https://gohugo.io/functions/time/parseduration/)

### Exemples

- `API_URL=http://localhost:3001` remplace la valeur lue depuis le fichier.  
- `TRIVY_ENABLED=false` désactive le scan Trivy.  
- `SCAN_TIMEOUT=20m` fixe le timeout global à 20 minutes. [gohugo](https://gohugo.io/functions/time/parseduration/)

***

## Fonction `String`

```go
func (c Config) String() string {
    return fmt.Sprintf("agent=%s api=%s scan=%s", c.AgentID, c.APIURL, c.ScanType)
}
```

### Variable

- `c` (`Config`) : configuration à convertir en chaîne lisible.

### Rôle

- Fournir une **représentation courte** de la configuration, utile pour du log ou du debug.  
- `fmt.Sprintf` construit ici une chaîne formatée à partir de plusieurs champs.

### Comportement

- Retourne une chaîne du type :

```text
agent=novisec-agent-001 api=http://api:3001 scan=MANUAL_GLOBAL
```

- Seuls trois champs sont affichés, donc ce n’est pas un dump complet de la config.

***

## Flux logique du fichier

Le comportement global de `config.go` peut se résumer comme ça :

1. Créer une config avec des valeurs par défaut.  
2. Chercher un fichier de config parmi plusieurs candidats.  
3. Lire ce fichier sous forme de paires `clé: valeur`.  
4. Appliquer ces valeurs à la config.  
5. Appliquer ensuite les variables d’environnement pour écraser les valeurs précédentes.  
6. Valider les champs essentiels.  
7. Exposer des méthodes utilitaires pour construire les endpoints API.

***

## Tableau récapitulatif

| Élément | Type / signature | Rôle |
|---|---|---|
| `Config` | `struct` | Regroupe tous les paramètres de l’agent |
| `Load()` | `func() (Config, error)` | Charge la config finale avec defaults + fichier + env |
| `Validate()` | `func (c Config) Validate() error` | Vérifie les champs obligatoires |
| `Endpoint()` | `func (c Config) Endpoint() string` | Construit l’endpoint d’envoi de scan |
| `TaskClaimEndpoint()` | `func (c Config) TaskClaimEndpoint() string` | Construit l’endpoint de claim de tâche |
| `TaskCompleteEndpoint(taskID)` | `func (c Config) TaskCompleteEndpoint(string) string` | Construit l’endpoint de complétion d’une tâche |
| `candidateConfigFiles()` | `func() []string` | Retourne la liste ordonnée des fichiers à tester |
| `readKeyValueFile(path)` | `func(string) (map[string]string, error)` | Lit un pseudo-fichier YAML simplifié |
| `applyValues(cfg, values)` | `func(*Config, map[string]string)` | Applique les valeurs lues depuis fichier |
| `applyEnv(cfg)` | `func(*Config)` | Applique les variables d’environnement |
| `String()` | `func (c Config) String() string` | Représentation texte courte de la config |

***

## Point d’architecture intéressant

Ce fichier montre bien que la config est pensée pour un usage **Docker / déploiement** : valeurs par défaut compatibles conteneur (`http://api:3001`, `/var/run/docker.sock`), possibilité de fournir un fichier, mais priorité donnée aux variables d’environnement, ce qui est très classique pour des services 12-factor-like. [golinuxcloud](https://www.golinuxcloud.com/go-environment-variables/)

***
Voici le breakdown de `discover.go` en Markdown, toujours orienté compréhension du code.

***

## Vue d’ensemble

Ce fichier sert à **interroger l’API Docker locale** via le socket Unix Docker pour récupérer la liste des conteneurs, puis à fournir deux méthodes utilitaires pour obtenir un nom d’affichage et une référence d’image. En Go, on peut faire du HTTP sur socket Unix en personnalisant le `Transport` et sa fonction `DialContext`, tout en utilisant une URL HTTP “fictive” dont l’hôte n’est pas réellement utilisé pour la connexion. [stackoverflow](https://stackoverflow.com/questions/26223839/go-net-http-unix-domain-socket-connection)

***

## Struct `Container`

```go
type Container struct {
    ID      string            `json:"Id"`
    Names   []string          `json:"Names"`
    Image   string            `json:"Image"`
    ImageID string            `json:"ImageID"`
    State   string            `json:"State"`
    Status  string            `json:"Status"`
    Created int64             `json:"Created"`
    Labels  map[string]string `json:"Labels"`
}
```

### Variables / champs

- `ID` (`string`) : identifiant unique du conteneur, mappé depuis le champ JSON `Id`.  
- `Names` (`[]string`) : liste des noms associés au conteneur, issue du champ `Names`.  
- `Image` (`string`) : nom ou référence textuelle de l’image utilisée par le conteneur, issue de `Image`.  
- `ImageID` (`string`) : identifiant exact de l’image Docker, issu de `ImageID`.  
- `State` (`string`) : état logique du conteneur, par exemple `running` ou `exited`.  
- `Status` (`string`) : statut plus lisible retourné par Docker, souvent plus détaillé que `State`.  
- `Created` (`int64`) : timestamp Unix de création du conteneur.  
- `Labels` (`map[string]string`) : dictionnaire des labels Docker attachés au conteneur.  
- Les tags `json:"..."` indiquent à `encoding/json` comment associer les clés JSON aux champs Go lors du décodage. Les struct tags servent justement à mapper les noms JSON vers les champs exportés Go. [codesignal](https://codesignal.com/learn/courses/handling-json-in-go-1/lessons/decoding-json-into-structs-in-go)

### Rôle

- Cette struct représente la forme des objets renvoyés par l’endpoint Docker `/containers/json`.  
- Elle sert de modèle de désérialisation pour convertir la réponse JSON en objets Go exploitables.

***

## Fonction `Discover`

```go
func Discover(ctx context.Context, socketPath string) ([]Container, error) {
    client := &http.Client{
        Transport: &http.Transport{
            DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
                return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "unix", socketPath)
            },
        },
        Timeout: 20 * time.Second,
    }

    req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://docker/containers/json?all=1", nil)
    if err != nil {
        return nil, err
    }

    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        payload, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("docker discovery failed: %s: %s", resp.Status, strings.TrimSpace(string(payload)))
    }

    var containers []Container
    if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
        return nil, err
    }
    return containers, nil
}
```

### Variables

- `ctx` (`context.Context`) : contexte reçu depuis l’appelant, utilisé pour propager annulation et timeout.  
- `socketPath` (`string`) : chemin du socket Unix Docker, par exemple `/var/run/docker.sock`.  
- `client` (`*http.Client`) : client HTTP configuré pour parler au démon Docker via socket Unix.  
- `Transport` (`*http.Transport`) : couche bas niveau du client HTTP qui définit comment ouvrir la connexion réseau.  
- `DialContext` (fonction) : callback personnalisée qui ignore le réseau/hôte de l’URL et ouvre à la place une connexion de type `"unix"` vers `socketPath`. Cette technique est une approche classique pour utiliser l’API Docker via socket Unix. [eli.thegreenplace](https://eli.thegreenplace.net/2019/unix-domain-sockets-in-go/)
- `req` (`*http.Request`) : requête HTTP GET préparée avec le contexte.  
- `err` (`error`) : variable d’erreur utilisée à chaque étape.  
- `resp` (`*http.Response`) : réponse HTTP renvoyée par le démon Docker.  
- `payload` (`[]byte`) : corps de réponse lu en cas d’erreur HTTP pour enrichir le message d’erreur.  
- `containers` (`[]Container`) : slice qui recevra la désérialisation JSON de la réponse.

### Rôle

- Interroger le démon Docker local pour obtenir la liste des conteneurs, puis la convertir en slice de `Container`.  
- L’endpoint `/containers/json?all=1` est celui utilisé pour lister les conteneurs, y compris ceux qui ne sont pas en cours d’exécution grâce au paramètre `all=1`. [docs.docker](https://docs.docker.com/reference/api/engine/sdk/examples/)

### Comportement étape par étape

1. Construit un `http.Client` personnalisé.  
2. Dans son `Transport`, redéfinit `DialContext` pour ouvrir une connexion Unix vers `socketPath` avec un timeout de 5 secondes.  
3. Définit aussi un timeout global de 20 secondes sur le client HTTP.  
4. Crée une requête GET avec `http.NewRequestWithContext`, ce qui lie la requête au `ctx` fourni.  
5. Utilise l’URL `"http://docker/containers/json?all=1"` ; ici `docker` est juste un hôte fictif, car la connexion réelle passera par le socket Unix défini dans `DialContext`. C’est un pattern courant quand on fait du HTTP sur socket Unix en Go. [stackoverflow](https://stackoverflow.com/questions/26223839/go-net-http-unix-domain-socket-connection)
6. Exécute la requête via `client.Do(req)`.  
7. Si l’appel réseau échoue, renvoie l’erreur directement.  
8. Ferme systématiquement `resp.Body` avec `defer resp.Body.Close()`.  
9. Si le code HTTP n’est pas `200 OK`, lit le corps de réponse et construit une erreur enrichie contenant le statut et le message retourné par Docker.  
10. Si le statut est correct, décode le corps JSON directement dans `containers` avec `json.NewDecoder(resp.Body).Decode(&containers)`. Le décodage JSON d’un tableau de haut niveau vers un slice de structs est un usage standard d’`encoding/json`. [coderwall](https://coderwall.com/p/4c2zig/decode-top-level-json-array-into-a-slice-of-structs-in-golang)
11. Renvoie le slice `containers`.

### Pourquoi `all=1` ?

- Sans ce paramètre, l’API Docker peut ne retourner que les conteneurs actifs selon l’endpoint et le mode d’appel.  
- Avec `all=1`, on demande explicitement tous les conteneurs, y compris arrêtés, ce qui est cohérent pour un outil d’audit. [reddit](https://www.reddit.com/r/docker/comments/u9yuob/docker_api_doesnt_return_all_containers/)

***

## Fonction `DisplayName`

```go
func (c Container) DisplayName() string {
    for _, name := range c.Names {
        trimmed := strings.TrimPrefix(strings.TrimSpace(name), "/")
        if trimmed != "" {
            return trimmed
        }
    }
    if c.ID != "" {
        if len(c.ID) > 12 {
            return c.ID[:12]
        }
        return c.ID
    }
    return "unknown"
}
```

### Variables

- `c` (`Container`) : conteneur courant sur lequel la méthode est appelée.  
- `name` (`string`) : un des noms présents dans `c.Names`.  
- `trimmed` (`string`) : version nettoyée du nom, sans espaces et sans slash initial `/`.

### Rôle

- Fournir un **nom lisible** pour le conteneur, même si Docker renvoie des noms bruts ou si aucun nom n’est disponible.  
- Cette méthode évite d’exposer directement des formats bruyants dans les rapports.

### Comportement

1. Parcourt tous les éléments de `c.Names`.  
2. Pour chaque `name`, enlève les espaces avec `TrimSpace`, puis retire un éventuel `/` initial avec `TrimPrefix`.  
3. Si le résultat `trimmed` n’est pas vide, le renvoie immédiatement.  
4. Si aucun nom exploitable n’existe mais que `c.ID` est présent :  
   - si l’ID fait plus de 12 caractères, renvoie les 12 premiers, ce qui rappelle le format court souvent utilisé par Docker CLI,  
   - sinon renvoie l’ID entier.  
5. Si ni nom ni ID n’existent, renvoie `"unknown"`.

### Intuition

L’ordre de préférence est :

1. un nom Docker propre,  
2. un ID court,  
3. `"unknown"`.

***

## Fonction `ReferenceImage`

```go
func (c Container) ReferenceImage() string {
    if strings.TrimSpace(c.Image) != "" {
        return strings.TrimSpace(c.Image)
    }
    return strings.TrimSpace(c.ImageID)
}
```

### Variables

- `c` (`Container`) : conteneur courant.  

### Rôle

- Obtenir une **référence d’image exploitable** pour le scan et le reporting.  
- La fonction privilégie le nom d’image lisible (`Image`) et utilise `ImageID` en repli si besoin.

### Comportement

1. Vérifie si `c.Image` n’est pas vide après nettoyage.  
2. Si oui, renvoie `c.Image` trimé.  
3. Sinon, renvoie `c.ImageID` trimé.

### Idée

- `Image` est souvent plus pratique pour le scan et plus lisible dans les rapports.  
- `ImageID` sert de fallback quand le nom d’image n’est pas disponible ou proprement renseigné.

***

## Flux logique global du fichier

Le comportement de `discover.go` peut être résumé ainsi :

1. Créer un client HTTP capable de parler à Docker via socket Unix.  
2. Appeler l’API Docker `/containers/json?all=1`.  
3. Vérifier le statut HTTP.  
4. Décoder la réponse JSON en `[]Container`.  
5. Offrir deux méthodes utilitaires pour transformer les données brutes en valeurs plus propres pour le reste de l’application.

***

## Tableau récapitulatif

| Élément | Type / signature | Rôle |
|---|---|---|
| `Container` | `struct` | Représente un conteneur Docker tel que renvoyé par l’API |
| `Discover(ctx, socketPath)` | `func(context.Context, string) ([]Container, error)` | Récupère la liste des conteneurs via le socket Docker |
| `DisplayName()` | `func (c Container) DisplayName() string` | Retourne un nom de conteneur lisible |
| `ReferenceImage()` | `func (c Container) ReferenceImage() string` | Retourne la meilleure référence d’image disponible |

***

## Point d’architecture intéressant

Ce fichier montre une approche “bas niveau” qui parle directement à l’API Docker via HTTP sur socket Unix, au lieu d’utiliser le SDK Docker Go complet. Le SDK officiel existe bien pour communiquer avec le Docker Engine, mais ici l’auteur a choisi une implémentation légère et maîtrisée, suffisante pour un simple listing de conteneurs. [pkg.go](https://pkg.go.dev/github.com/docker/docker/client)

***
Voici le breakdown de `report.go`, qui définit surtout les **modèles de données** utilisés pour représenter un scan, ses conteneurs, et leurs vulnérabilités.

***

## Vue d’ensemble

Ce fichier ne contient pas de logique de traitement, mais des **structs Go** qui servent de schéma pour transporter les données entre les différentes couches du programme et pour les sérialiser en JSON. En Go, les struct tags JSON comme `json:"field,omitempty"` contrôlent le nom du champ dans le JSON et peuvent omettre certains champs vides lors du marshaling. [sohamkamani](https://www.sohamkamani.com/golang/omitempty/)

***

## Struct `Vulnerability`

```go
type Vulnerability struct {
    CVE              string   `json:"cve"`
    Package          string   `json:"package_name,omitempty"`
    InstalledVersion string   `json:"installed_version,omitempty"`
    FixedVersion     string   `json:"fixed_version,omitempty"`
    Severity         string   `json:"severity"`
    CVSS             float64  `json:"cvss"`
    CWE              []string `json:"cwe,omitempty"`
    Description      string   `json:"description,omitempty"`
    Remediation      string   `json:"remediation,omitempty"`
    Source           string   `json:"source,omitempty"`
}
```

### Variables / champs

- `CVE` (`string`) : identifiant de vulnérabilité précis, par exemple `CVE-2024-12345`. Un CVE identifie une vulnérabilité spécifique observée dans un produit ou composant réel. [linkedin](https://www.linkedin.com/pulse/understanding-cvss-cve-cwe-your-guide-vulnerability-management-b-z4vrc)
- `Package` (`string`) : nom du package ou composant logiciel affecté.  
- `InstalledVersion` (`string`) : version actuellement installée du package vulnérable.  
- `FixedVersion` (`string`) : version dans laquelle la vulnérabilité est corrigée, si connue.  
- `Severity` (`string`) : niveau textuel de sévérité, par exemple `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.  
- `CVSS` (`float64`) : score numérique de gravité, généralement de 0.0 à 10.0. Le CVSS mesure la sévérité d’une vulnérabilité. [cve](https://www.cve.org/about/relatedefforts)
- `CWE` (`[]string`) : liste de catégories de faiblesse associées, par exemple `CWE-79`. Un CWE décrit un type de faiblesse générique, contrairement à un CVE qui décrit une vulnérabilité concrète. [reddit](https://www.reddit.com/r/cybersecurity_help/comments/te17gu/do_cwes_get_scored_with_cvss/)
- `Description` (`string`) : description textuelle de la vulnérabilité.  
- `Remediation` (`string`) : recommandation de correction ou action à effectuer.  
- `Source` (`string`) : source de la donnée, par exemple le scanner ou la base ayant fourni l’info.

### Rôle

- Représenter une vulnérabilité unique détectée sur une image ou un conteneur.  
- Cette struct concentre à la fois l’identification (`CVE`), l’impact (`Severity`, `CVSS`) et les éléments utiles à la correction (`FixedVersion`, `Remediation`).

### Remarque sur `omitempty`

- Les champs marqués `omitempty` seront omis du JSON s’ils sont considérés vides, par exemple `""` pour une chaîne ou un slice vide pour `[]string`. [sohamkamani](https://www.sohamkamani.com/golang/omitempty/)
- Cela permet d’éviter un JSON trop verbeux quand certaines informations ne sont pas disponibles.

***

## Struct `ContainerReport`

```go
type ContainerReport struct {
    ID                 string          `json:"id"`
    Name               string          `json:"name"`
    Image              string          `json:"image"`
    Status             string          `json:"status"`
    CreatedAt          time.Time       `json:"created_at,omitempty"`
    Vulnerabilities    []Vulnerability `json:"vulnerabilities,omitempty"`
    VulnerabilityCount int             `json:"vulnerability_count"`
    HighestCVSS        float64         `json:"highest_cvss"`
    RiskLevel          string          `json:"risk_level"`
}
```

### Variables / champs

- `ID` (`string`) : identifiant du conteneur.  
- `Name` (`string`) : nom lisible du conteneur.  
- `Image` (`string`) : image Docker utilisée par ce conteneur.  
- `Status` (`string`) : statut du conteneur au moment du scan.  
- `CreatedAt` (`time.Time`) : date/heure de création du conteneur. En JSON Go, `time.Time` est généralement sérialisé dans un format compatible RFC 3339. [eli.thegreenplace](https://eli.thegreenplace.net/2020/unmarshaling-time-values-from-json/)
- `Vulnerabilities` (`[]Vulnerability`) : liste des vulnérabilités trouvées pour ce conteneur.  
- `VulnerabilityCount` (`int`) : nombre total de vulnérabilités associées à ce conteneur.  
- `HighestCVSS` (`float64`) : score CVSS maximal parmi les vulnérabilités du conteneur.  
- `RiskLevel` (`string`) : niveau de risque textuel dérivé de `HighestCVSS`.

### Rôle

- Représenter le **rapport détaillé d’un conteneur individuel**.  
- Cette struct combine les métadonnées du conteneur avec les résultats de scan.

### Point important sur `CreatedAt`

- Le champ a le tag `omitempty`, mais en Go classique `omitempty` ne fonctionne pas comme on pourrait l’attendre avec `time.Time` parce que `time.Time` est une struct et non un type “vide” simple. [stackoverflow](https://stackoverflow.com/questions/32643815/json-omitempty-with-time-time-field)
- Donc si `CreatedAt` vaut la zero value de `time.Time`, il peut quand même apparaître dans le JSON selon le comportement exact de la version et du marshaller utilisé. [stackoverflow](https://stackoverflow.com/questions/32643815/json-omitempty-with-time-time-field)

***

## Struct `Summary`

```go
type Summary struct {
    TotalContainers      int     `json:"total_containers"`
    HealthyContainers    int     `json:"healthy_containers"`
    VulnerableContainers int     `json:"vulnerable_containers"`
    TotalVulnerabilities int     `json:"total_vulnerabilities"`
    GlobalRiskScore      float64 `json:"global_risk_score"`
}
```

### Variables / champs

- `TotalContainers` (`int`) : nombre total de conteneurs analysés.  
- `HealthyContainers` (`int`) : nombre de conteneurs sans vulnérabilités détectées.  
- `VulnerableContainers` (`int`) : nombre de conteneurs ayant au moins une vulnérabilité.  
- `TotalVulnerabilities` (`int`) : somme de toutes les vulnérabilités détectées.  
- `GlobalRiskScore` (`float64`) : score de risque global, ici probablement calculé comme une moyenne ou un indicateur agrégé.

### Rôle

- Fournir une **vue synthétique** du scan complet.  
- Cette struct est surtout utile pour l’affichage global, les dashboards, ou les résumés API.

***

## Struct `ScanReport`

```go
type ScanReport struct {
    AgentID    string            `json:"agent_id"`
    Timestamp  time.Time         `json:"timestamp"`
    ScanType   string            `json:"scan_type"`
    Containers []ContainerReport `json:"containers"`
    Summary    Summary           `json:"summary"`
}
```

### Variables / champs

- `AgentID` (`string`) : identifiant de l’agent ayant effectué le scan.  
- `Timestamp` (`time.Time`) : date/heure à laquelle le rapport a été généré. Les valeurs `time.Time` sérialisées en JSON sont généralement exprimées en RFC 3339. [willem](https://www.willem.dev/articles/change-time-format-json/)
- `ScanType` (`string`) : type ou mode de scan exécuté.  
- `Containers` (`[]ContainerReport`) : liste des rapports détaillés par conteneur.  
- `Summary` (`Summary`) : résumé global du scan.

### Rôle

- C’est l’objet **racine** du reporting.  
- Il contient tout ce qui est nécessaire pour transmettre un résultat complet de scan à une API ou à une couche de visualisation.

***

## Hiérarchie des données

Le modèle global s’imbrique comme ça :

```text
ScanReport
├── AgentID
├── Timestamp
├── ScanType
├── Containers []ContainerReport
│   ├── ID
│   ├── Name
│   ├── Image
│   ├── Status
│   ├── CreatedAt
│   ├── Vulnerabilities []Vulnerability
│   │   ├── CVE
│   │   ├── Package
│   │   ├── InstalledVersion
│   │   ├── FixedVersion
│   │   ├── Severity
│   │   ├── CVSS
│   │   ├── CWE
│   │   ├── Description
│   │   ├── Remediation
│   │   └── Source
│   ├── VulnerabilityCount
│   ├── HighestCVSS
│   └── RiskLevel
└── Summary
    ├── TotalContainers
    ├── HealthyContainers
    ├── VulnerableContainers
    ├── TotalVulnerabilities
    └── GlobalRiskScore
```

Les structs imbriquées en Go permettent justement de modéliser ce type de données hiérarchiques de façon naturelle. [stackoverflow](https://stackoverflow.com/questions/66345611/how-to-construct-nested-structs-with-slices)

***

## Logique métier implicite

Même s’il n’y a pas de fonctions ici, les noms de champs révèlent la logique métier attendue :

- Une **vulnérabilité** est l’unité élémentaire.  
- Un **conteneur** agrège plusieurs vulnérabilités et des métriques locales comme `VulnerabilityCount` et `HighestCVSS`.  
- Un **scan complet** agrège plusieurs conteneurs et un résumé global.  

Autrement dit :

- `Vulnerability` = détail fin,  
- `ContainerReport` = niveau intermédiaire,  
- `Summary` = vue agrégée,  
- `ScanReport` = enveloppe complète.

***

## Exemple JSON attendu

Voici le genre de JSON que ces structs peuvent produire :

```json
{
  "agent_id": "novisec-agent-001",
  "timestamp": "2026-05-13T08:30:00Z",
  "scan_type": "MANUAL_GLOBAL",
  "containers": [
    {
      "id": "abc123",
      "name": "nginx-prod",
      "image": "nginx:latest",
      "status": "Up 2 hours",
      "created_at": "2026-05-13T06:10:00Z",
      "vulnerabilities": [
        {
          "cve": "CVE-2024-12345",
          "package_name": "openssl",
          "installed_version": "1.1.1",
          "fixed_version": "1.1.1u",
          "severity": "HIGH",
          "cvss": 7.5
        }
      ],
      "vulnerability_count": 1,
      "highest_cvss": 7.5,
      "risk_level": "HAUT"
    }
  ],
  "summary": {
    "total_containers": 1,
    "healthy_containers": 0,
    "vulnerable_containers": 1,
    "total_vulnerabilities": 1,
    "global_risk_score": 7.5
  }
}
```

Les noms JSON utilisés ici viennent directement des tags `json:"..."` présents dans les structs. [sohamkamani](https://www.sohamkamani.com/golang/omitempty/)

***

## Tableau récapitulatif

| Struct | Rôle |
|---|---|
| `Vulnerability` | Décrit une vulnérabilité individuelle détectée |
| `ContainerReport` | Décrit les résultats de scan pour un conteneur |
| `Summary` | Agrège les statistiques globales du scan |
| `ScanReport` | Représente le rapport complet envoyé ou stocké |

***

## Point utile pour ton analyse

Ce fichier est important car il définit le **contrat de données** du projet. Quand tu lis ensuite `scanner.go`, `main.go` ou `transport.go`, tu peux te repérer grâce à cette hiérarchie :

- le scanner produit des `[]Vulnerability`,  
- `main` transforme ça en `[]ContainerReport`,  
- puis emballe tout dans un `ScanReport`,  
- et `transport` l’envoie probablement à l’API.

***
Voici le breakdown de `task.go`.

***

## Vue d’ensemble

Ce fichier définit une seule struct, `ScanTask`, qui représente une **tâche de scan** échangée avec l’API. Comme pour les autres modèles Go, les tags `json:"..."` servent à contrôler les noms des champs dans le JSON, et `omitempty` permet d’omettre certains champs vides lors de l’encodage. [sohamkamani](https://www.sohamkamani.com/golang/omitempty/)

***

## Struct `ScanTask`

```go
type ScanTask struct {
    ID           string   `json:"id"`
    Mode         string   `json:"mode"`
    Status       string   `json:"status"`
    ContainerIDs []string `json:"container_ids"`
    ScanID       string   `json:"scan_id,omitempty"`
    Message      string   `json:"message,omitempty"`
}
```

### Variables / champs

- `ID` (`string`) : identifiant unique de la tâche de scan.  
- `Mode` (`string`) : mode demandé pour le scan, par exemple un type de scan à appliquer.  
- `Status` (`string`) : état courant de la tâche, par exemple en attente, en cours, terminée, ou autre selon les conventions de l’API.  
- `ContainerIDs` (`[]string`) : liste des IDs de conteneurs concernés par cette tâche.  
- `ScanID` (`string`) : identifiant du scan produit une fois le travail exécuté, probablement renvoyé après création du rapport.  
- `Message` (`string`) : message libre associé à la tâche, utile pour transmettre une info complémentaire, un retour d’état, ou un message d’erreur métier.

### Rôle

- Cette struct sert de **contrat de données** pour piloter les scans à distance.  
- Elle permet à l’API de dire à l’agent **quoi scanner**, **dans quel mode**, et de suivre ensuite le résultat via `Status`, `ScanID` et éventuellement `Message`.

***

## Sens des champs

### `ID`

- C’est l’identifiant de référence de la tâche.  
- Il sert probablement à réclamer une tâche, puis à la marquer comme terminée via un endpoint du style `/scan-tasks/{id}/complete`, ce qu’on a déjà vu dans le `config.go`.

### `Mode`

- Ce champ indique **comment** l’agent doit effectuer le scan.  
- Dans `main.go`, on a vu que si une tâche existe et que `task.Mode != ""`, alors `scanType` est remplacé par `task.Mode`, donc ce champ surcharge le mode par défaut de la config.

### `Status`

- Ce champ représente l’état fonctionnel de la tâche.  
- Il n’y a pas de constantes ici, donc les valeurs exactes sont définies ailleurs, probablement côté API ou transport.

### `ContainerIDs`

- Cette liste permet de cibler seulement certains conteneurs.  
- Dans `main.go`, cette valeur est passée à `filterContainers(containers, task.ContainerIDs)`, donc une tâche peut restreindre le scan à un sous-ensemble précis de conteneurs.

### `ScanID`

- Ce champ sert probablement à faire le lien entre la tâche et le rapport de scan créé.  
- Le tag `omitempty` signifie que si `ScanID` est vide (`""`), il peut être omis du JSON lors du marshaling. Pour les chaînes, `omitempty` fonctionne bien sur la chaîne vide. [leapcell](https://leapcell.io/blog/understanding-the-omitempty-tag-in-go-s-json-encoding)

### `Message`

- C’est un champ texte optionnel, sans doute prévu pour transmettre une explication humaine ou un détail sur le résultat.  
- Comme `ScanID`, il sera omis du JSON s’il est vide grâce à `omitempty`. [github](https://github.com/golang/go/issues/59170)

***

## Logique métier implicite

Même sans fonction, cette struct montre le cycle de vie probable d’une tâche :

1. L’API crée une tâche avec un `ID`, un `Mode`, un `Status` initial, et éventuellement une liste de `ContainerIDs`.  
2. L’agent réclame cette tâche.  
3. L’agent exécute le scan demandé.  
4. Une fois le scan terminé, un `ScanID` peut être associé à la tâche.  
5. Le `Status` et éventuellement `Message` sont mis à jour pour refléter le résultat.

***

## Relation avec le reste du code

Cette struct est directement liée à ce qu’on a déjà vu dans `main.go` :

- `task.Mode` peut remplacer `cfg.ScanType`.  
- `task.ContainerIDs` est utilisé pour filtrer les conteneurs à scanner.  
- `task.ID` est utilisé pour construire l’endpoint de complétion avec `TaskCompleteEndpoint(task.ID)`.  
- Le payload de complétion envoyait aussi un `ScanID` et un statut `"completed"`, donc `ScanTask` est clairement au cœur du workflow de pilotage des scans.

***

## Exemple JSON possible

Voici un exemple cohérent avec cette struct :

```json
{
  "id": "task-42",
  "mode": "MANUAL_TARGETED",
  "status": "claimed",
  "container_ids": [
    "8f3c2a1b7d91",
    "4d12e9c0ab55"
  ]
}
```

Et après exécution, un état enrichi pourrait ressembler à :

```json
{
  "id": "task-42",
  "mode": "MANUAL_TARGETED",
  "status": "completed",
  "container_ids": [
    "8f3c2a1b7d91",
    "4d12e9c0ab55"
  ],
  "scan_id": "scan-9001",
  "message": "scan completed successfully"
}
```

Les noms de clés JSON viennent directement des tags présents sur la struct. [codesignal](https://codesignal.com/learn/courses/handling-json-in-go-1/lessons/encoding-structs-into-json-in-go-1)

***

## Tableau récapitulatif

| Champ | Type | Rôle |
|---|---|---|
| `ID` | `string` | Identifiant unique de la tâche |
| `Mode` | `string` | Mode de scan demandé |
| `Status` | `string` | État courant de la tâche |
| `ContainerIDs` | `[]string` | Liste des conteneurs ciblés |
| `ScanID` | `string` | Référence du scan produit |
| `Message` | `string` | Message optionnel lié à la tâche |

***

## Ce qu’il faut retenir

`ScanTask` n’est pas un résultat de scan, mais un **ordre de travail** transmis à l’agent. `ScanReport` décrit ce qui a été trouvé, tandis que `ScanTask` décrit **ce qu’il faut faire** et **où en est l’exécution**.

`transport.go`, c’est lui qui relie justement ces modèles à l’API.

***
Voici le breakdown de `normalize.go`, qui sert clairement à **normaliser** les résultats bruts du scanner avant de les convertir en objets `models.Vulnerability`.

***

## Vue d’ensemble

Ce fichier transforme des vulnérabilités “brutes” (`rawVulnerability`) en un format propre, homogène et exploitable par le reste de l’application. Il contient des fonctions de normalisation de score, de sévérité, de remédiation, puis une déduplication finale des vulnérabilités à l’aide d’une map servant d’ensemble (`set`). [nvd.nist](https://nvd.nist.gov/vuln-metrics/cvss)

***

## Fonction `severityFromScore`

```go
func severityFromScore(score float64) string {
    switch {
    case score >= 9.0:
        return "CRITIQUE"
    case score >= 7.0:
        return "HAUT"
    case score >= 4.0:
        return "MOYEN"
    case score > 0:
        return "FAIBLE"
    default:
        return "INCONNU"
    }
}
```

### Variable

- `score` (`float64`) : score numérique CVSS ou score équivalent de sévérité.

### Rôle

- Convertir un score numérique en **catégorie textuelle** de sévérité.  
- Les plages utilisées ressemblent aux catégories de sévérité habituelles dérivées du CVSS, où un score élevé correspond à une sévérité plus forte. Le NVD rappelle que le CVSS fournit une mesure qualitative de sévérité à partir d’un score numérique. [first](https://www.first.org/cvss/v3.1/specification-document)

### Comportement

- `score >= 9.0` → `"CRITIQUE"`  
- `score >= 7.0` → `"HAUT"`  
- `score >= 4.0` → `"MOYEN"`  
- `score > 0` → `"FAIBLE"`  
- sinon → `"INCONNU"`

### Intérêt

- Cette fonction permet de dériver une sévérité même si la donnée brute ne fournit qu’un score.

***

## Fonction `scoreFromSeverity`

```go
func scoreFromSeverity(severity string) float64 {
    switch strings.ToUpper(strings.TrimSpace(severity)) {
    case "CRITICAL", "CRITIQUE":
        return 9.8
    case "HIGH", "HAUT":
        return 8.0
    case "MEDIUM", "MOYEN":
        return 5.0
    case "LOW", "FAIBLE":
        return 2.0
    default:
        return 0
    }
}
```

### Variables

- `severity` (`string`) : sévérité textuelle issue de la source brute.  

### Rôle

- Faire l’opération inverse de `severityFromScore` : partir d’un texte de sévérité et produire un score numérique approximatif.  
- `strings.TrimSpace` enlève les espaces autour, et `strings.ToUpper` uniformise la casse pour comparer les chaînes sans dépendre du format d’origine. Le package `strings` fournit précisément ces fonctions de manipulation de chaînes. [pkg.go](https://pkg.go.dev/strings)

### Comportement

1. Nettoie `severity` avec `TrimSpace`.  
2. Convertit le résultat en majuscules avec `ToUpper`.  
3. Associe ensuite une valeur arbitraire représentative :  
   - `"CRITICAL"` / `"CRITIQUE"` → `9.8`  
   - `"HIGH"` / `"HAUT"` → `8.0`  
   - `"MEDIUM"` / `"MOYEN"` → `5.0`  
   - `"LOW"` / `"FAIBLE"` → `2.0`  
   - sinon → `0`

### Point important

- Ce ne sont pas des scores CVSS exacts calculés à partir d’un vecteur CVSS ; ce sont des **valeurs de correspondance** utilisées comme fallback quand le vrai score n’est pas disponible. Le CVSS réel est normalement calculé à partir d’un ensemble de métriques, pas juste d’un label texte. [nvd.nist](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator)

***

## Fonction `riskFromHighestScore`

```go
func riskFromHighestScore(score float64) string {
    return severityFromScore(score)
}
```

### Variable

- `score` (`float64`) : score le plus élevé observé.

### Rôle

- Donner un **nom plus métier** à une opération déjà existante.  
- Cette fonction ne fait qu’appeler `severityFromScore(score)`.

### Comportement

- Reçoit un score.  
- Retourne exactement la même valeur que `severityFromScore(score)`.

### Interprétation

- C’est probablement une fonction prévue pour rendre le code plus lisible dans certains contextes, même si actuellement elle ne rajoute aucune logique.

***

## Fonction `normalizeRemediation`

```go
func normalizeRemediation(finding rawVulnerability) string {
    if finding.FixedVersion != "" && finding.PkgName != "" {
        return "Mettre à jour " + finding.PkgName + " vers la version " + finding.FixedVersion
    }
    if finding.FixedVersion != "" {
        return "Mettre à jour vers la version " + finding.FixedVersion
    }
    if finding.PkgName != "" {
        return "Vérifier la mise à jour de " + finding.PkgName
    }
    return "Appliquer le correctif recommandé par l'éditeur"
}
```

### Variable

- `finding` (`rawVulnerability`) : vulnérabilité brute issue du scanner.

### Rôle

- Produire un message de **remédiation lisible** à partir des informations disponibles dans la vulnérabilité brute.

### Comportement

1. Si `FixedVersion` et `PkgName` existent, construit un message précis :  
   `"Mettre à jour <package> vers la version <fixedVersion>"`  
2. Si seule `FixedVersion` est connue, renvoie :  
   `"Mettre à jour vers la version <fixedVersion>"`  
3. Si seul `PkgName` est connu, renvoie :  
   `"Vérifier la mise à jour de <package>"`  
4. Sinon, renvoie une recommandation générique.

### Intérêt

- Cette fonction enrichit la donnée brute avec une phrase exploitable côté rapport ou interface.

***

## Fonction `normalizeFinding`

```go
func normalizeFinding(finding rawVulnerability) models.Vulnerability {
    score := scoreFromFinding(finding)
    severity := strings.ToUpper(strings.TrimSpace(finding.Severity))
    if severity == "" {
        severity = severityFromScore(score)
    }
    return models.Vulnerability{
        CVE:              finding.VulnerabilityID,
        Package:          finding.PkgName,
        InstalledVersion: finding.InstalledVersion,
        FixedVersion:     finding.FixedVersion,
        Severity:         severity,
        CVSS:             score,
        CWE:              append([]string(nil), finding.CweIDs...),
        Description:      strings.TrimSpace(finding.Description),
        Remediation:      normalizeRemediation(finding),
        Source:           strings.TrimSpace(finding.PrimaryURL),
    }
}
```

### Variables

- `finding` (`rawVulnerability`) : entrée brute à convertir.  
- `score` (`float64`) : score calculé via `scoreFromFinding`.  
- `severity` (`string`) : sévérité brute nettoyée et mise en majuscules.

### Rôle

- Convertir une vulnérabilité brute en `models.Vulnerability`, c’est-à-dire dans le format officiel du projet.

### Comportement

1. Calcule le score avec `scoreFromFinding(finding)`.  
2. Lit `finding.Severity`, enlève les espaces et le met en majuscules. [gohugo](https://gohugo.io/functions/strings/toupper/)
3. Si la sévérité est vide, la déduit à partir du score avec `severityFromScore(score)`.  
4. Construit ensuite une nouvelle struct `models.Vulnerability` :  
   - `CVE` reçoit `finding.VulnerabilityID`,  
   - `Package` reçoit `finding.PkgName`,  
   - `InstalledVersion` et `FixedVersion` sont recopiés,  
   - `Severity` reçoit la valeur normalisée,  
   - `CVSS` reçoit `score`,  
   - `CWE` reçoit une copie de `finding.CweIDs`,  
   - `Description` est trimée,  
   - `Remediation` est générée via `normalizeRemediation`,  
   - `Source` reçoit `PrimaryURL` trimé.

### Détail important

- `append([]string(nil), finding.CweIDs...)` crée une **copie** du slice `CweIDs` au lieu de réutiliser potentiellement le slice source tel quel.  
- Cela évite de partager le même backing array si le code amont modifie ensuite les données.

***

## Fonction `scoreFromFinding`

```go
func scoreFromFinding(finding rawVulnerability) float64 {
    if finding.CVSS != nil {
        if source, ok := finding.CVSS["NVD"]; ok && source.V3Score > 0 {
            return source.V3Score
        }
        for _, source := range finding.CVSS {
            if source.V3Score > 0 {
                return source.V3Score
            }
            if source.V2Score > 0 {
                return source.V2Score
            }
        }
    }
    return scoreFromSeverity(finding.Severity)
}
```

### Variable

- `finding` (`rawVulnerability`) : vulnérabilité brute contenant éventuellement des scores CVSS selon plusieurs sources.  
- `source` : entrée d’une source CVSS dans la map `finding.CVSS`.  
- `ok` (`bool`) : indique si la clé `"NVD"` existe dans la map.

### Rôle

- Déterminer le **meilleur score numérique** à utiliser pour une vulnérabilité.

### Comportement

1. Vérifie si `finding.CVSS` n’est pas `nil`.  
2. Si la source `"NVD"` existe et fournit un `V3Score > 0`, renvoie ce score en priorité. Le NVD est une source d’enrichissement CVSS largement utilisée pour les enregistrements CVE. [nvd.nist](https://nvd.nist.gov/vuln-metrics/cvss)
3. Sinon, parcourt toutes les autres sources de `finding.CVSS` :  
   - si une source a `V3Score > 0`, renvoie ce score,  
   - sinon, si elle a `V2Score > 0`, renvoie ce score.  
4. Si aucun score exploitable n’existe, utilise `scoreFromSeverity(finding.Severity)` comme valeur de repli.

### Logique implicite

L’ordre de préférence est :

1. `NVD.V3Score`,  
2. un autre `V3Score`,  
3. un `V2Score`,  
4. un score estimé depuis la sévérité texte.

### Point important

- Le code préfère CVSS v3 à v2, ce qui est cohérent avec les usages modernes. Le NVD documente bien l’existence des versions CVSS v2 et v3.x, avec un enrichissement CVSS sur les CVE publiées. [nvd.nist](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator)

***

## Fonction `normalizeVulnerabilities`

```go
func normalizeVulnerabilities(findings []rawVulnerability) []models.Vulnerability {
    result := make([]models.Vulnerability, 0, len(findings))
    seen := make(map[string]struct{})
    for _, finding := range findings {
        vulnerability := normalizeFinding(finding)
        key := vulnerability.CVE + "|" + vulnerability.Package
        if _, ok := seen[key]; ok {
            continue
        }
        seen[key] = struct{}{}
        result = append(result, vulnerability)
    }
    return result
}
```

### Variables

- `findings` (`[]rawVulnerability`) : liste de vulnérabilités brutes à normaliser.  
- `result` (`[]models.Vulnerability`) : slice final contenant les vulnérabilités normalisées sans doublons.  
- `seen` (`map[string]struct{}`) : ensemble des clés déjà rencontrées, utilisé pour dédupliquer efficacement. Utiliser une map comme set est un pattern très courant en Go pour éliminer les doublons. [geeksforgeeks](https://www.geeksforgeeks.org/go-language/how-to-remove-duplicate-values-from-slice-in-golang/)
- `finding` : élément brut courant.  
- `vulnerability` (`models.Vulnerability`) : version normalisée du `finding`.  
- `key` (`string`) : clé de déduplication construite à partir de `CVE + "|" + Package`.  
- `ok` (`bool`) : indique si la clé a déjà été vue.

### Rôle

- Transformer une liste brute en liste normalisée, tout en **supprimant les doublons**.

### Comportement

1. Crée `result` vide avec une capacité initiale égale à `len(findings)`.  
2. Crée `seen`, une map vide.  
3. Pour chaque `finding` :  
   - appelle `normalizeFinding`,  
   - construit une clé unique à partir du couple `CVE|Package`,  
   - si cette clé existe déjà dans `seen`, ignore cette vulnérabilité,  
   - sinon ajoute la clé dans `seen` puis ajoute la vulnérabilité à `result`.  
4. Retourne `result`.

### Choix de déduplication

- Deux vulnérabilités sont considérées identiques si elles ont le même `CVE` et le même `Package`.  
- Cela veut dire qu’un même CVE sur deux packages différents sera conservé deux fois, ce qui est logique.

***

## Flux logique du fichier

Le fichier suit une logique très claire :

1. Déterminer un score fiable à partir des données brutes.  
2. Déterminer ou corriger la sévérité.  
3. Générer une remédiation lisible.  
4. Convertir chaque vulnérabilité brute en `models.Vulnerability`.  
5. Supprimer les doublons sur le couple `CVE + package`.

***

## Tableau récapitulatif

| Fonction | Signature | Rôle |
|---|---|---|
| `severityFromScore` | `func(float64) string` | Convertit un score en catégorie de sévérité |
| `scoreFromSeverity` | `func(string) float64` | Donne un score approximatif à partir d’une sévérité texte |
| `riskFromHighestScore` | `func(float64) string` | Alias métier de `severityFromScore` |
| `normalizeRemediation` | `func(rawVulnerability) string` | Génère un message de remédiation |
| `normalizeFinding` | `func(rawVulnerability) models.Vulnerability` | Convertit une vulnérabilité brute en modèle propre |
| `scoreFromFinding` | `func(rawVulnerability) float64` | Choisit le meilleur score CVSS disponible |
| `normalizeVulnerabilities` | `func([]rawVulnerability) []models.Vulnerability` | Normalise et déduplique une liste de vulnérabilités |

***

## Point d’architecture intéressant

Ce fichier joue le rôle d’une **couche d’adaptation** entre le format brut d’un scanner externe et le modèle interne du projet. C’est une très bonne séparation de responsabilités : le parseur brut reste dépendant de la source, alors que le reste du projet manipule uniquement `models.Vulnerability`, plus stable et cohérent.

Le fichier suivant à analyser, ce serait celui qui définit `rawVulnerability` et celui qui appelle Trivy.

***
Voici le breakdown de `trivy.go`, qui est le cœur de l’intégration avec **Trivy** dans le dossier `scanner`.

***

## Vue d’ensemble

Ce fichier exécute Trivy en ligne de commande pour scanner une image Docker, récupère le rapport JSON produit, le désérialise dans des structs Go temporaires, puis convertit les vulnérabilités brutes en `[]models.Vulnerability`. Trivy supporte bien la sortie JSON pour ses rapports, et le sous-commande `image` avec `--format json` est une manière standard de produire un rapport exploitable par du code. [trivy](https://trivy.dev/docs/latest/configuration/reporting/)

***

## Struct `trivyReport`

```go
type trivyReport struct {
    Results []trivyResult `json:"Results"`
}
```

### Variable / champ

- `Results` (`[]trivyResult`) : liste des résultats retournés par Trivy dans le JSON.  

### Rôle

- Représenter la racine du rapport JSON de Trivy tel qu’attendu par ce code.  
- Le champ `Results` est bien utilisé par les rapports JSON Trivy pour regrouper les résultats analysés. [github](https://github.com/aquasecurity/trivy/issues/2787)

***

## Struct `trivyResult`

```go
type trivyResult struct {
    Target          string             `json:"Target"`
    Class           string             `json:"Class"`
    Type            string             `json:"Type"`
    Vulnerabilities []rawVulnerability `json:"Vulnerabilities"`
}
```

### Variables / champs

- `Target` (`string`) : cible analysée dans ce bloc de résultat, par exemple une image, une couche, ou un composant cible.  
- `Class` (`string`) : classe de résultat retournée par Trivy.  
- `Type` (`string`) : type de cible ou de paquet analysé.  
- `Vulnerabilities` (`[]rawVulnerability`) : liste des vulnérabilités brutes détectées dans ce résultat.

### Rôle

- Représenter un **bloc de résultats** Trivy.  
- Un rapport Trivy peut contenir plusieurs résultats, et chacun peut porter sa propre liste de vulnérabilités. [trivy](https://trivy.dev/docs/v0.57/guide/configuration/reporting/)

***

## Struct `rawVulnerability`

```go
type rawVulnerability struct {
    VulnerabilityID  string                    `json:"VulnerabilityID"`
    PkgName          string                    `json:"PkgName"`
    InstalledVersion string                    `json:"InstalledVersion"`
    FixedVersion     string                    `json:"FixedVersion"`
    Severity         string                    `json:"Severity"`
    Title            string                    `json:"Title"`
    Description      string                    `json:"Description"`
    PrimaryURL       string                    `json:"PrimaryURL"`
    References       []string                  `json:"References"`
    CweIDs           []string                  `json:"CweIDs"`
    CVSS             map[string]trivyCVSSScore `json:"CVSS"`
}
```

### Variables / champs

- `VulnerabilityID` (`string`) : identifiant de vulnérabilité, généralement un CVE.  
- `PkgName` (`string`) : nom du package affecté.  
- `InstalledVersion` (`string`) : version installée du package.  
- `FixedVersion` (`string`) : version corrigée disponible.  
- `Severity` (`string`) : sévérité textuelle donnée par Trivy.  
- `Title` (`string`) : titre de la vulnérabilité.  
- `Description` (`string`) : description textuelle détaillée.  
- `PrimaryURL` (`string`) : URL principale de référence sur la vulnérabilité.  
- `References` (`[]string`) : liste d’URLs ou références associées.  
- `CweIDs` (`[]string`) : liste de CWE associés à la vulnérabilité.  
- `CVSS` (`map[string]trivyCVSSScore`) : map de scores CVSS, indexée par source, par exemple `NVD`.

### Rôle

- Représenter la structure **brute** renvoyée par Trivy, avant normalisation.  
- Cette struct sert d’étape intermédiaire entre le JSON de Trivy et `models.Vulnerability`.

### Intérêt architectural

- Garder une struct brute séparée du modèle métier est une bonne pratique : ça isole le format externe Trivy du reste du projet.  
- C’est exactement ce que le fichier `normalize.go` exploite ensuite.

***

## Struct `trivyCVSSScore`

```go
type trivyCVSSScore struct {
    V2Score float64 `json:"V2Score"`
    V3Score float64 `json:"V3Score"`
}
```

### Variables / champs

- `V2Score` (`float64`) : score CVSS v2 pour une source donnée.  
- `V3Score` (`float64`) : score CVSS v3 pour une source donnée.

### Rôle

- Modéliser les scores CVSS associés à une source dans le JSON Trivy.  
- Le code de normalisation privilégie ensuite `V3Score`, puis `V2Score`, ce qui colle avec la préférence courante pour CVSS v3.x. [nvd.nist](https://nvd.nist.gov/vuln-metrics/cvss)

***

## Fonction `ScanImage`

```go
func ScanImage(ctx context.Context, trivyPath, image string) ([]models.Vulnerability, error) {
    image = strings.TrimSpace(image)
    if image == "" {
        return nil, nil
    }

    binary := strings.TrimSpace(trivyPath)
    if binary == "" {
        binary = "trivy"
    }
    if _, err := exec.LookPath(binary); err != nil {
        return []models.Vulnerability{}, nil
    }

    args := []string{"image", "--quiet", "--format", "json", "--no-progress", image}
    output, err := exec.CommandContext(ctx, binary, args...).Output()
    if err != nil {
        var exitErr *exec.ExitError
        if errors.As(err, &exitErr) {
            stderr := strings.TrimSpace(string(exitErr.Stderr))
            if stderr != "" {
                return nil, fmt.Errorf("trivy scan failed for %s: %s", image, stderr)
            }
        }
        return nil, err
    }

    var report trivyReport
    if err := json.Unmarshal(output, &report); err != nil {
        return nil, err
    }

    findings := make([]rawVulnerability, 0)
    for _, result := range report.Results {
        findings = append(findings, result.Vulnerabilities...)
    }
    if len(findings) == 0 {
        return []models.Vulnerability{}, nil
    }

    return normalizeVulnerabilities(findings), nil
}
```

***

## Variables de `ScanImage`

- `ctx` (`context.Context`) : contexte permettant annulation et timeout du scan.  
- `trivyPath` (`string`) : chemin ou nom de l’exécutable Trivy.  
- `image` (`string`) : référence de l’image Docker à scanner.  
- `binary` (`string`) : valeur finale de l’exécutable à utiliser.  
- `args` (`[]string`) : arguments passés à Trivy.  
- `output` (`[]byte`) : sortie standard capturée de la commande Trivy.  
- `err` (`error`) : erreur éventuelle sur l’exécution ou le parsing.  
- `exitErr` (`*exec.ExitError`) : type spécifique d’erreur renvoyé quand la commande s’exécute mais retourne un code d’échec. Le package `os/exec` documente bien `*ExitError` comme type d’erreur pour un processus terminé en échec. [cs.ubc](https://www.cs.ubc.ca/~bestchai/teaching/cs416_2015w2/go1.4.3-docs/pkg/os/exec/index.html)
- `stderr` (`string`) : sortie d’erreur capturée depuis Trivy si disponible.  
- `report` (`trivyReport`) : rapport JSON désérialisé.  
- `findings` (`[]rawVulnerability`) : liste plate de vulnérabilités brutes agrégées depuis tous les résultats Trivy.  
- `result` (`trivyResult`) : élément courant de `report.Results`.

***

## Rôle de `ScanImage`

- Scanner une image Docker avec Trivy.  
- Convertir la sortie JSON brute en liste normalisée de vulnérabilités utilisables par le reste de l’application.

***

## Comportement étape par étape

### 1. Validation de l’image

```go
image = strings.TrimSpace(image)
if image == "" {
    return nil, nil
}
```

- Nettoie la chaîne `image`.  
- Si elle est vide, renvoie immédiatement `nil, nil`.  
- Donc : pas d’image, pas d’erreur, pas de scan.

### 2. Résolution du binaire Trivy

```go
binary := strings.TrimSpace(trivyPath)
if binary == "" {
    binary = "trivy"
}
if _, err := exec.LookPath(binary); err != nil {
    return []models.Vulnerability{}, nil
}
```

- Nettoie `trivyPath`.  
- Si aucun chemin n’est fourni, utilise `"trivy"` par défaut.  
- `exec.LookPath(binary)` cherche l’exécutable dans le `PATH`. `LookPath` sert justement à localiser un binaire exécutable à partir de son nom. [cs.ubc](https://www.cs.ubc.ca/~bestchai/teaching/cs416_2015w2/go1.4.3-docs/pkg/os/exec/index.html)
- Si Trivy n’est pas trouvé, la fonction **ne renvoie pas une erreur**, mais une liste vide de vulnérabilités.

### Interprétation importante

- Ici, l’absence de Trivy est considérée comme un cas tolérable, pas comme un échec fatal.  
- Cela explique pourquoi le reste du programme peut continuer même si l’outil n’est pas installé.

### 3. Construction de la commande

```go
args := []string{"image", "--quiet", "--format", "json", "--no-progress", image}
```

- `image` : sous-commande Trivy pour scanner une image container.  
- `--quiet` : réduit le bruit de sortie.  
- `--format json` : demande un rapport JSON.  
- `--no-progress` : évite l’affichage de progression interactive.  
- `image` final : référence de l’image à scanner.  
- La documentation Trivy mentionne bien la génération de rapport JSON avec `--format json`. [trivy](https://trivy.dev/docs/latest/references/configuration/cli/trivy_convert/)

### 4. Exécution de Trivy

```go
output, err := exec.CommandContext(ctx, binary, args...).Output()
```

- `exec.CommandContext` lance la commande en l’attachant au `context.Context`, ce qui permet son interruption si le contexte expire ou est annulé. La gestion des commandes externes avec contexte est une pratique standard en Go. [labex](https://labex.io/tutorials/go-how-to-handle-exec-errors-in-golang-450950)
- `.Output()` récupère la sortie standard (`stdout`) de la commande.

### 5. Gestion des erreurs d’exécution

```go
if err != nil {
    var exitErr *exec.ExitError
    if errors.As(err, &exitErr) {
        stderr := strings.TrimSpace(string(exitErr.Stderr))
        if stderr != "" {
            return nil, fmt.Errorf("trivy scan failed for %s: %s", image, stderr)
        }
    }
    return nil, err
}
```

- Si la commande échoue, le code teste si l’erreur est de type `*exec.ExitError`. [cs.ubc](https://www.cs.ubc.ca/~bestchai/teaching/cs416_2015w2/go1.4.3-docs/pkg/os/exec/index.html)
- Si oui, il essaie de lire `stderr` pour construire un message plus parlant.  
- Si `stderr` contient du texte, il renvoie une erreur enrichie du type :  
  `"trivy scan failed for <image>: <stderr>"`  
- Sinon, il renvoie l’erreur brute.

### Point subtil

- Avec `.Output()`, la sortie standard est capturée, mais la gestion précise de `stderr` dépend du comportement de la commande et de l’erreur retournée. Des guides Go sur `os/exec` rappellent souvent qu’il faut capturer explicitement stdout/stderr si on veut un contrôle fin. [blog.kowalczyk](https://blog.kowalczyk.info/article/wOYk/advanced-command-execution-in-go-with-osexec.html)

### 6. Parsing du JSON Trivy

```go
var report trivyReport
if err := json.Unmarshal(output, &report); err != nil {
    return nil, err
}
```

- Désérialise la sortie JSON dans la struct `trivyReport`.  
- `json.Unmarshal` mappe les clés JSON dans les champs Go grâce aux tags `json:"..."`. [forum.golangbridge](https://forum.golangbridge.org/t/json-unmarshal-on-nested-struct-isnt-decoding-keys-values/3016)

### 7. Aplatissement des résultats

```go
findings := make([]rawVulnerability, 0)
for _, result := range report.Results {
    findings = append(findings, result.Vulnerabilities...)
}
```

- Trivy peut retourner plusieurs blocs dans `report.Results`.  
- Le code fusionne toutes les vulnérabilités de tous les résultats dans un seul slice `findings`.

### 8. Cas sans vulnérabilités

```go
if len(findings) == 0 {
    return []models.Vulnerability{}, nil
}
```

- Si aucune vulnérabilité n’a été trouvée, renvoie un slice vide, pas `nil`.  
- C’est souvent plus pratique pour le reste du code, car cela évite des vérifications `nil` spécifiques.

### 9. Normalisation finale

```go
return normalizeVulnerabilities(findings), nil
```

- Appelle la couche de normalisation analysée précédemment.  
- La sortie brute Trivy devient alors un `[]models.Vulnerability` propre, cohérent, et dédupliqué.

***

## Flux logique global du fichier

Le fichier suit cette chaîne :

1. Vérifier que l’image est valide.  
2. Vérifier que Trivy est disponible.  
3. Exécuter Trivy avec sortie JSON.  
4. Parser le JSON dans des structs brutes.  
5. Fusionner les vulnérabilités de tous les résultats.  
6. Normaliser et dédupliquer les vulnérabilités.  
7. Renvoyer le résultat final au reste du programme.

***

## Tableau récapitulatif

| Élément | Type / signature | Rôle |
|---|---|---|
| `trivyReport` | `struct` | Racine du rapport JSON Trivy |
| `trivyResult` | `struct` | Bloc de résultat Trivy pour une cible |
| `rawVulnerability` | `struct` | Vulnérabilité brute telle que fournie par Trivy |
| `trivyCVSSScore` | `struct` | Scores CVSS v2/v3 par source |
| `ScanImage` | `func(context.Context, string, string) ([]models.Vulnerability, error)` | Lance Trivy sur une image et renvoie des vulnérabilités normalisées |

***

## Point d’architecture intéressant

Ce fichier sépare bien trois niveaux :

- **appel outil externe** : `exec.CommandContext(...)`,  
- **modèle brut Trivy** : `trivyReport`, `trivyResult`, `rawVulnerability`,  
- **modèle métier interne** : `models.Vulnerability` via `normalizeVulnerabilities`.

C’est une séparation propre, parce que si le format JSON de Trivy change un jour, tu modifies surtout cette couche et la normalisation, sans casser le reste du projet.

Le prochain fichier le plus logique maintenant est `transport.go`, on a presque reconstitué tout le pipeline agent → scan → report.

***
Voici le breakdown de `transport/api.go`.

***

## Vue d’ensemble

Ce fichier envoie le **rapport de scan** vers l’API centrale en HTTP POST, avec JSON, contexte, timeout, et éventuellement authentification Bearer. En Go, `json.Marshal` sert à encoder une struct en JSON, `http.NewRequestWithContext` permet d’associer une requête à un `context.Context`, et un header `Authorization: Bearer <token>` est une manière standard de transmettre un jeton d’API. [stackoverflow](https://stackoverflow.com/questions/51452148/how-can-i-make-a-request-with-a-bearer-token-in-go)

***

## Fonction `SendReport`

```go
func SendReport(ctx context.Context, endpoint string, report models.ScanReport, token string, timeout time.Duration, insecureSkipTLSVerify bool) (string, error) {
    endpoint = strings.TrimSpace(endpoint)
    if endpoint == "" {
        return "", fmt.Errorf("report endpoint is required")
    }

    payload, err := json.Marshal(report)
    if err != nil {
        return "", err
    }

    client := &http.Client{Timeout: timeout}
    if strings.HasPrefix(endpoint, "https://") {
        transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
        if insecureSkipTLSVerify {
            transport.TLSClientConfig.InsecureSkipVerify = true
        }
        client.Transport = transport
    }

    req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
    if err != nil {
        return "", err
    }
    req.Header.Set("Content-Type", "application/json")
    if token != "" {
        req.Header.Set("Authorization", "Bearer "+token)
    }

    resp, err := client.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
        body, _ := io.ReadAll(resp.Body)
        return "", fmt.Errorf("api returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
    }

    var response struct {
        ScanID string `json:"scanId"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
        return "", err
    }

    return response.ScanID, nil
}
```

***

## Variables de `SendReport`

- `ctx` (`context.Context`) : contexte d’exécution de la requête HTTP, utilisé pour annuler ou limiter la durée de l’appel. `NewRequestWithContext` est justement la méthode recommandée dans `net/http` pour lier une requête à un contexte. [pkg.go](https://pkg.go.dev/net/http)
- `endpoint` (`string`) : URL cible vers laquelle envoyer le rapport.  
- `report` (`models.ScanReport`) : rapport complet à sérialiser et envoyer à l’API.  
- `token` (`string`) : jeton d’authentification optionnel pour l’API.  
- `timeout` (`time.Duration`) : timeout du client HTTP.  
- `insecureSkipTLSVerify` (`bool`) : option permettant de désactiver la vérification TLS pour les endpoints HTTPS.  
- `payload` (`[]byte`) : JSON produit à partir du `report` avec `json.Marshal`. [golang](https://golang.cafe/blog/golang-json-marshal-example)
- `err` (`error`) : variable d’erreur utilisée à différentes étapes.  
- `client` (`*http.Client`) : client HTTP configuré avec timeout, et éventuellement transport TLS personnalisé.  
- `transport` (`*http.Transport`) : transport HTTP personnalisé utilisé uniquement pour HTTPS.  
- `req` (`*http.Request`) : requête POST préparée avec le contexte, l’URL et le corps JSON.  
- `resp` (`*http.Response`) : réponse HTTP renvoyée par l’API.  
- `body` (`[]byte`) : corps de réponse lu quand le statut HTTP indique une erreur.  
- `response` (struct anonyme) : petite structure temporaire servant à décoder uniquement le champ `scanId` de la réponse JSON. En Go, il est courant de définir une petite struct locale contenant uniquement les champs nécessaires pour décoder une réponse JSON. [reddit](https://www.reddit.com/r/golang/comments/196357i/how_do_you_guys_convert_a_json_response_to_go/)

***

## Rôle de `SendReport`

- Sérialiser un `models.ScanReport` en JSON.  
- L’envoyer à l’API par requête POST.  
- Lire la réponse de l’API et renvoyer l’identifiant du scan créé.

***

## Comportement étape par étape

### 1. Validation de l’endpoint

```go
endpoint = strings.TrimSpace(endpoint)
if endpoint == "" {
    return "", fmt.Errorf("report endpoint is required")
}
```

- Nettoie l’URL reçue.  
- Si elle est vide, renvoie une erreur immédiatement.  
- Cela évite de construire une requête invalide plus loin.

### 2. Encodage du rapport en JSON

```go
payload, err := json.Marshal(report)
if err != nil {
    return "", err
}
```

- Transforme `report` en JSON binaire (`[]byte`) avec `json.Marshal`. `json.Marshal` encode les champs exportés d’une struct Go selon leurs tags JSON. [codesignal](https://codesignal.com/learn/courses/handling-json-in-go-1/lessons/encoding-structs-into-json-in-go-1)
- Si l’encodage échoue, la fonction s’arrête.

### 3. Création du client HTTP

```go
client := &http.Client{Timeout: timeout}
```

- Crée un client HTTP avec un timeout global.  
- Ce timeout complète le `context.Context` en ajoutant une limite temporelle côté client lui-même.

### 4. Configuration TLS optionnelle

```go
if strings.HasPrefix(endpoint, "https://") {
    transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
    if insecureSkipTLSVerify {
        transport.TLSClientConfig.InsecureSkipVerify = true
    }
    client.Transport = transport
}
```

- Si l’endpoint commence par `https://`, le code crée un `http.Transport` personnalisé avec une config TLS.  
- `MinVersion: tls.VersionTLS13` impose un minimum TLS 1.3 pour la connexion. Le package `crypto/tls` expose bien des constantes comme `tls.VersionTLS13` pour fixer une version minimale. [docs.aws.amazon](https://docs.aws.amazon.com/sdk-for-go/v1/developer-guide/tls.html)
- Si `insecureSkipTLSVerify` vaut `true`, la vérification du certificat serveur est désactivée via `InsecureSkipVerify`. La documentation de sécurité Go et d’autres guides rappellent qu’activer `InsecureSkipVerify` revient à accepter n’importe quel certificat et nom d’hôte, ce qui affaiblit fortement la sécurité TLS. [docs.descope](https://docs.descope.com/security-best-practices/golang-cert-verification)
- Le transport est ensuite attaché au client.

### Point important

- Ce code ne personnalise TLS que pour les URLs HTTPS.  
- Pour HTTP simple, il utilise le transport par défaut implicite du client.

### 5. Construction de la requête HTTP

```go
req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
if err != nil {
    return "", err
}
```

- Crée une requête `POST` vers `endpoint`, avec le JSON comme corps.  
- `bytes.NewReader(payload)` transforme le `[]byte` en lecteur utilisable comme body HTTP.  
- `NewRequestWithContext` lie la requête au contexte `ctx`. [pkg.go](https://pkg.go.dev/net/http)

### 6. Définition des headers

```go
req.Header.Set("Content-Type", "application/json")
if token != "" {
    req.Header.Set("Authorization", "Bearer "+token)
}
```

- Définit le type de contenu comme JSON.  
- Si un token existe, ajoute un header `Authorization: Bearer <token>`, qui est une manière standard d’envoyer un jeton d’accès à une API. [reqbin](https://reqbin.com/req/h4rnefmw/post-json-with-bearer-token-authorization-header)

### 7. Envoi de la requête

```go
resp, err := client.Do(req)
if err != nil {
    return "", err
}
defer resp.Body.Close()
```

- Exécute la requête via le client HTTP.  
- Si la connexion échoue, renvoie l’erreur.  
- Ferme toujours le corps de la réponse avec `defer`.

### 8. Vérification du code HTTP

```go
if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
    body, _ := io.ReadAll(resp.Body)
    return "", fmt.Errorf("api returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
}
```

- Vérifie que le code HTTP est dans la plage 2xx, c’est-à-dire entre 200 inclus et 300 exclus.  
- Si le statut n’est pas un succès, lit le corps de réponse pour inclure un message détaillé dans l’erreur.  
- Le message final contient à la fois `resp.Status` et le contenu textuel du body.

### 9. Décodage de la réponse JSON

```go
var response struct {
    ScanID string `json:"scanId"`
}
if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
    return "", err
}
```

- Décode le JSON renvoyé par l’API dans une petite struct locale qui ne contient qu’un champ : `scanId`.  
- `json.NewDecoder(...).Decode(...)` est une façon standard de lire du JSON directement depuis un `io.Reader`, ici `resp.Body`. [digitalocean](https://www.digitalocean.com/community/tutorials/how-to-make-http-requests-in-go)

### 10. Retour de la valeur utile

```go
return response.ScanID, nil
```

- Renvoie l’identifiant de scan créé par l’API.  
- C’est cette valeur qui sera ensuite utilisée dans `main.go` pour compléter la tâche de scan.

***

## Logique implicite de l’API

Ce que le code suppose de l’API est très clair :

- L’API accepte un `POST` JSON à l’endpoint donné.  
- En cas de succès, elle répond avec un JSON contenant au moins :  

```json
{
  "scanId": "..."
}
```

- En cas d’erreur, elle renvoie un statut HTTP non 2xx avec potentiellement un message dans le corps.

***

## Exemple de requête et réponse

### Requête envoyée

- Méthode : `POST`  
- Headers :
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` si un token est fourni  
- Body : JSON sérialisé depuis `models.ScanReport` [stackoverflow](https://stackoverflow.com/questions/51452148/how-can-i-make-a-request-with-a-bearer-token-in-go)

### Réponse attendue

```json
{
  "scanId": "scan-12345"
}
```

Cette réponse est ensuite décodée dans la struct locale `response`. [reddit](https://www.reddit.com/r/golang/comments/196357i/how_do_you_guys_convert_a_json_response_to_go/)

***

## Tableau récapitulatif

| Élément | Type / signature | Rôle |
|---|---|---|
| `SendReport` | `func(context.Context, string, models.ScanReport, string, time.Duration, bool) (string, error)` | Envoie le rapport de scan à l’API et renvoie le `scanId` |

***

## Point d’architecture intéressant

Cette fonction est la **sortie principale** de l’agent vers le backend. Tout ce qui a été construit auparavant converge ici :

- `scanner` produit les vulnérabilités,  
- `models` structure les données,  
- `main` assemble le `ScanReport`,  
- et `transport.SendReport` sérialise puis transmet le tout à l’API.

Le prochain morceau logique dans `transport`, ce sera probablement `ClaimTask` et `CompleteTask`, parce qu’eux gèrent l’autre sens de communication avec l’API : la récupération et la finalisation des tâches.

***
Voici le breakdown de `transport/tasks.go`.

***

## Vue d’ensemble

Ce fichier gère la communication entre l’agent et l’API autour des **tâches de scan** : une fonction pour réclamer une tâche (`ClaimTask`) et une autre pour la terminer (`CompleteTask`). Il réutilise le même style que `SendReport` : client HTTP avec timeout, JSON, support Bearer token, et configuration TLS optionnelle. [pkg.go](https://pkg.go.dev/net/http)

***

## Struct `TaskActionPayload`

```go
type TaskActionPayload struct {
    ScanID  string `json:"scan_id,omitempty"`
    Status  string `json:"status"`
    Message string `json:"message,omitempty"`
}
```

### Variables / champs

- `ScanID` (`string`) : identifiant du scan associé à la tâche, si disponible.  
- `Status` (`string`) : nouvel état à transmettre pour la tâche.  
- `Message` (`string`) : message optionnel à associer à l’action.  
- Les champs `ScanID` et `Message` sont marqués `omitempty`, donc ils peuvent être absents du JSON s’ils valent `""`. Pour les chaînes, `omitempty` supprime bien les champs vides lors du marshaling JSON. [leapcell](https://leapcell.io/blog/understanding-the-omitempty-tag-in-go-s-json-encoding)

### Rôle

- Représenter le **payload JSON** envoyé lors d’une action sur une tâche, ici surtout la complétion.  
- C’est un petit DTO local au package `transport`.

***

## Fonction `ClaimTask`

```go
func ClaimTask(ctx context.Context, endpoint, token string, timeout time.Duration, insecureSkipTLSVerify bool) (*models.ScanTask, error) {
    endpoint = strings.TrimSpace(endpoint)
    if endpoint == "" {
        return nil, nil
    }

    client := &http.Client{Timeout: timeout}
    if strings.HasPrefix(endpoint, "https://") {
        transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
        if insecureSkipTLSVerify {
            transport.TLSClientConfig.InsecureSkipVerify = true
        }
        client.Transport = transport
    }

    req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
    if err != nil {
        return nil, err
    }
    if token != "" {
        req.Header.Set("Authorization", "Bearer "+token)
    }

    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode == http.StatusNoContent {
        return nil, nil
    }
    if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
        body, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("task claim failed %s: %s", resp.Status, strings.TrimSpace(string(body)))
    }

    var task models.ScanTask
    if err := json.NewDecoder(resp.Body).Decode(&task); err != nil {
        return nil, err
    }

    if task.ID == "" {
        return nil, nil
    }

    return &task, nil
}
```

***

## Variables de `ClaimTask`

- `ctx` (`context.Context`) : contexte de la requête HTTP.  
- `endpoint` (`string`) : URL de l’endpoint de claim de tâche.  
- `token` (`string`) : jeton d’authentification optionnel.  
- `timeout` (`time.Duration`) : timeout du client HTTP.  
- `insecureSkipTLSVerify` (`bool`) : option de désactivation de validation TLS pour HTTPS.  
- `client` (`*http.Client`) : client HTTP utilisé pour envoyer la requête.  
- `transport` (`*http.Transport`) : transport HTTP personnalisé pour TLS.  
- `req` (`*http.Request`) : requête POST envoyée à l’API.  
- `resp` (`*http.Response`) : réponse renvoyée par l’API.  
- `body` (`[]byte`) : corps de réponse lu en cas d’erreur HTTP.  
- `task` (`models.ScanTask`) : tâche décodée depuis la réponse JSON.  

***

## Rôle de `ClaimTask`

- Demander à l’API s’il existe une tâche de scan à exécuter.  
- Si une tâche existe, la retourner sous forme de `*models.ScanTask`.  
- Sinon, retourner `nil, nil`.

***

## Comportement étape par étape

### 1. Validation de l’endpoint

```go
endpoint = strings.TrimSpace(endpoint)
if endpoint == "" {
    return nil, nil
}
```

- Nettoie l’URL.  
- Si elle est vide, la fonction considère simplement qu’il n’y a rien à faire et retourne `nil, nil`.  
- Ici, l’absence d’endpoint n’est pas traitée comme une erreur.

### 2. Création du client HTTP

```go
client := &http.Client{Timeout: timeout}
```

- Crée un client avec timeout.

### 3. Configuration TLS optionnelle

```go
if strings.HasPrefix(endpoint, "https://") {
    transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
    if insecureSkipTLSVerify {
        transport.TLSClientConfig.InsecureSkipVerify = true
    }
    client.Transport = transport
}
```

- Si l’URL est en HTTPS, impose un minimum TLS 1.3 grâce à `tls.VersionTLS13`. Le package `crypto/tls` fournit cette constante pour configurer la version minimale acceptée. [pkg.go](https://pkg.go.dev/crypto/tls)
- Si `insecureSkipTLSVerify` est vrai, désactive la validation du certificat serveur, ce qui réduit fortement la sécurité TLS. La désactivation de vérification est généralement réservée à des contextes de test ou d’environnements internes maîtrisés. [docs.descope](https://docs.descope.com/security-best-practices/golang-cert-verification)

### 4. Construction de la requête

```go
req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
```

- Crée une requête `POST` avec un corps `nil`.  
- En Go, `NewRequestWithContext` accepte un body `nil`, ce qui convient bien pour une requête POST sans payload explicite tant qu’on passe bien une interface `nil` réelle. [github](https://github.com/golang/go/issues/15455)

### 5. Ajout du token

```go
if token != "" {
    req.Header.Set("Authorization", "Bearer "+token)
}
```

- Si un token existe, l’ajoute en header Bearer. [stackoverflow](https://stackoverflow.com/questions/51452148/how-can-i-make-a-request-with-a-bearer-token-in-go)

### 6. Envoi de la requête

```go
resp, err := client.Do(req)
```

- Exécute la requête.  
- Si l’appel échoue, renvoie l’erreur.

### 7. Gestion du cas `204 No Content`

```go
if resp.StatusCode == http.StatusNoContent {
    return nil, nil
}
```

- Si l’API répond `204 No Content`, cela signifie que la requête a réussi mais qu’aucun contenu n’est renvoyé. Le statut HTTP 204 signifie précisément qu’il n’y a pas de corps de réponse à traiter. [developer.mozilla](https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Status/204)
- Ici, cela est interprété comme : **aucune tâche disponible**.

### 8. Gestion des erreurs HTTP

```go
if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
    body, _ := io.ReadAll(resp.Body)
    return nil, fmt.Errorf("task claim failed %s: %s", resp.Status, strings.TrimSpace(string(body)))
}
```

- Si le code n’est pas en 2xx, lit le body pour enrichir le message d’erreur.

### 9. Décodage du JSON de tâche

```go
var task models.ScanTask
if err := json.NewDecoder(resp.Body).Decode(&task); err != nil {
    return nil, err
}
```

- Décode la réponse JSON dans un `models.ScanTask`.

### 10. Vérification du contenu métier

```go
if task.ID == "" {
    return nil, nil
}
```

- Même si l’API renvoie du JSON, si `task.ID` est vide, la fonction considère qu’il n’y a pas de vraie tâche exploitable.  
- Cela ajoute une sécurité logique au-dessus du simple statut HTTP.

### 11. Retour de la tâche

```go
return &task, nil
```

- Renvoie un pointeur vers la tâche décodée.

***

## Fonction `CompleteTask`

```go
func CompleteTask(ctx context.Context, endpoint, token string, timeout time.Duration, insecureSkipTLSVerify bool, payload TaskActionPayload) error {
    endpoint = strings.TrimSpace(endpoint)
    if endpoint == "" {
        return nil
    }

    body, err := json.Marshal(payload)
    if err != nil {
        return err
    }

    client := &http.Client{Timeout: timeout}
    if strings.HasPrefix(endpoint, "https://") {
        transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
        if insecureSkipTLSVerify {
            transport.TLSClientConfig.InsecureSkipVerify = true
        }
        client.Transport = transport
    }

    req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
    if err != nil {
        return err
    }
    req.Header.Set("Content-Type", "application/json")
    if token != "" {
        req.Header.Set("Authorization", "Bearer "+token)
    }

    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
        responseBody, _ := io.ReadAll(resp.Body)
        return fmt.Errorf("task completion failed %s: %s", resp.Status, strings.TrimSpace(string(responseBody)))
    }

    return nil
}
```

***

## Variables de `CompleteTask`

- `ctx` (`context.Context`) : contexte de la requête.  
- `endpoint` (`string`) : URL de complétion de la tâche.  
- `token` (`string`) : token d’authentification optionnel.  
- `timeout` (`time.Duration`) : timeout du client HTTP.  
- `insecureSkipTLSVerify` (`bool`) : option TLS non sécurisée.  
- `payload` (`TaskActionPayload`) : contenu JSON à envoyer pour marquer la tâche comme terminée.  
- `body` (`[]byte`) : JSON sérialisé du payload.  
- `client` (`*http.Client`) : client HTTP.  
- `transport` (`*http.Transport`) : transport TLS éventuel.  
- `req` (`*http.Request`) : requête POST de complétion.  
- `resp` (`*http.Response`) : réponse de l’API.  
- `responseBody` (`[]byte`) : corps de réponse en cas d’erreur.

***

## Rôle de `CompleteTask`

- Envoyer à l’API la **mise à jour finale** d’une tâche : statut, scan associé, et éventuellement un message.

***

## Comportement étape par étape

### 1. Validation de l’endpoint

```go
endpoint = strings.TrimSpace(endpoint)
if endpoint == "" {
    return nil
}
```

- Nettoie l’URL.  
- Si elle est vide, ne fait rien et retourne `nil`.  
- Comme dans `ClaimTask`, l’absence d’endpoint est traitée comme un no-op plutôt qu’une erreur.

### 2. Encodage du payload

```go
body, err := json.Marshal(payload)
```

- Convertit `TaskActionPayload` en JSON avec `json.Marshal`. [sohamkamani](https://www.sohamkamani.com/golang/omitempty/)

### 3. Création du client et config TLS

- Même logique que `ClaimTask` et `SendReport` : timeout, TLS 1.3 minimum pour HTTPS, option de bypass de validation si demandé. [pkg.go](https://pkg.go.dev/crypto/tls)

### 4. Construction de la requête

```go
req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
```

- Crée une requête `POST` contenant le JSON du payload.

### 5. Ajout des headers

```go
req.Header.Set("Content-Type", "application/json")
if token != "" {
    req.Header.Set("Authorization", "Bearer "+token)
}
```

- Déclare un body JSON.  
- Ajoute l’authentification Bearer si disponible. [developer.auth0](https://developer.auth0.com/resources/guides/api/standard-library/basic-authorization)

### 6. Envoi de la requête

```go
resp, err := client.Do(req)
```

- Envoie la requête.  
- Si l’appel échoue, renvoie l’erreur.

### 7. Vérification du statut HTTP

```go
if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
    responseBody, _ := io.ReadAll(resp.Body)
    return fmt.Errorf("task completion failed %s: %s", resp.Status, strings.TrimSpace(string(responseBody)))
}
```

- Si la réponse n’est pas en 2xx, renvoie une erreur enrichie avec le body.  
- Sinon, considère que la complétion a réussi.

### 8. Retour final

```go
return nil
```

- Aucun contenu n’est attendu de l’API ici.  
- Seul le succès ou l’échec compte.

***

## Différence entre `ClaimTask` et `CompleteTask`

| Fonction | Sens | Entrée | Sortie | Rôle |
|---|---|---|---|---|
| `ClaimTask` | API → agent | endpoint, token, timeout | `*models.ScanTask, error` | Demande une tâche à exécuter |
| `CompleteTask` | agent → API | endpoint, token, timeout, payload | `error` | Informe l’API qu’une tâche est terminée |

***

## Flux logique global

Dans le workflow complet de l’agent :

1. `ClaimTask(...)` demande une tâche à l’API.  
2. Si une tâche est reçue, `main.go` adapte le scan à cette tâche.  
3. L’agent scanne les conteneurs ciblés.  
4. `SendReport(...)` envoie le rapport de scan.  
5. `CompleteTask(...)` informe l’API que la tâche est terminée avec un `ScanID` et un statut final.

***

## Point d’architecture intéressant

`tasks.go` et `api.go` forment ensemble la **couche de protocole** entre l’agent et le backend :

- `ClaimTask` récupère le travail,  
- `SendReport` livre le résultat,  
- `CompleteTask` clôt le cycle.

Autrement dit, l’agent n’est pas juste un scanner local : il est pensé comme un **worker piloté par une API centrale**.
***
