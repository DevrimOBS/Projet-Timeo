***

# Cours complet Go : grammaire et vocabulaire

## Plan

1. Lexique du langage  
2. Structure d’un fichier Go  
3. Déclarations : variables, constantes, types  
4. Types et valeurs  
5. Expressions et opérateurs  
6. Instructions et contrôle de flux  
7. Fonctions et méthodes  
8. Structs, interfaces, pointeurs  
9. Collections : array, slice, map  
10. Packages, imports, erreurs, concurrence  
11. Vocabulaire Go essentiel  

***

## 1. Lexique du langage

Avant d’écrire du code, il faut comprendre le **vocabulaire de base** de Go : tokens, identifiants, mots-clés, littéraux, opérateurs et séparateurs. La spec officielle décrit justement Go en partant de ces éléments lexicaux. [go](https://go.dev/ref/spec)

### 1.1 Tokens

Un programme Go est découpé en **tokens**, c’est-à-dire les plus petites unités utiles au compilateur. [go](https://go.dev/ref/spec)

Exemples de tokens :

- identifiants : `x`, `User`, `main`
- mots-clés : `func`, `var`, `if`
- littéraux : `42`, `"hello"`, `true`
- opérateurs : `+`, `==`, `:=`
- ponctuation : `(`, `)`, `{`, `}`, `,`

### 1.2 Identifiants

Un **identifiant** est un nom donné à un élément du programme : variable, fonction, type, package, constante, etc. [tutorialsteacher](https://www.tutorialsteacher.com/go/go-syntax)

Exemples :

```go
name
User
scanReport
_HTTPClient
```

Règles importantes :

- peut commencer par une lettre ou `_`
- peut contenir lettres et chiffres
- ne peut pas être un mot-clé du langage [go101](https://go101.org/article/keywords-and-identifiers.html)

### 1.3 Exportation

En Go, la visibilité dépend de la **majuscule initiale**. [dev](https://dev.to/robogeek95/deep-dive-into-go-syntax-and-types-2l66)

- `User` : exporté, visible depuis un autre package
- `user` : non exporté, visible seulement dans le package courant

Exemple :

```go
type User struct {
    Name string
    age  int
}
```

- `User` et `Name` sont exportés
- `age` ne l’est pas

### 1.4 Mots-clés réservés

Go possède 25 mots-clés réservés. [includehelp](https://www.includehelp.com/golang/keywords.aspx)

```text
break        default      func         interface    select
case         defer        go           map          struct
chan         else         goto         package      switch
const        fallthrough  if           range        type
continue     for          import       return       var
```

Tu ne peux pas écrire :

```go
var func = 10 // interdit
```

car `func` est un mot-clé.

***

## 2. Structure d’un fichier Go

Un fichier Go suit une structure simple : package, imports, déclarations. C’est une syntaxe volontairement sobre. [w3schools](https://www.w3schools.com/go/go_syntax.php)

### Exemple minimal

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Go")
}
```

### Décomposition

- `package main` : ce fichier appartient au package `main`
- `import "fmt"` : on importe le package `fmt`
- `func main()` : fonction principale d’un exécutable [cbtnuggets](https://www.cbtnuggets.com/blog/technology/programming/basics-of-go-syntax)

### Point important

Un programme exécutable Go démarre dans :

- le package `main`
- la fonction `main()`

***

## 3. Règles d’écriture et points de grammaire

### 3.1 Accolades

En Go, les blocs sont entourés par `{}`. L’accolade ouvrante doit rester sur la **même ligne** que l’instruction. À cause de l’insertion automatique des points-virgules, mettre `{` à la ligne peut casser le code. [boldlygo](https://boldlygo.tech/archive/2023-01-11-lexical-elements-semicolons/)

Correct :

```go
if x > 0 {
    fmt.Println(x)
}
```

Incorrect :

```go
if x > 0
{
    fmt.Println(x)
}
```

### 3.2 Points-virgules automatiques

La grammaire formelle de Go contient des `;`, mais dans le code réel on les écrit presque jamais : le compilateur les insère automatiquement à la fin de certaines lignes. [ruship](https://ruship.dev/posts/go-basics-and-a-dash-of-clean-code/)

Tu peux donc écrire :

```go
x := 10
y := 20
fmt.Println(x + y)
```

au lieu de :

```go
x := 10;
y := 20;
fmt.Println(x + y);
```

### 3.3 Commentaires

```go
// commentaire sur une ligne

/*
commentaire
sur plusieurs lignes
*/
```

Les commentaires servent à documenter le code. [tutorialsteacher](https://www.tutorialsteacher.com/go/go-syntax)

***

## 4. Déclarations : `var`, `const`, `type`, `func`

Les grandes déclarations du langage utilisent les mots-clés `var`, `const`, `type`, `func`. [dev](https://dev.to/robogeek95/deep-dive-into-go-syntax-and-types-2l66)

### 4.1 Variables : `var`

```go
var age int
var name string = "Nico"
```

- `var age int` : déclare une variable `age` de type `int`
- sans initialisation, elle reçoit la **valeur zéro** du type

### 4.2 Déclaration courte : `:=`

```go
age := 20
name := "Nico"
```

- pratique à l’intérieur des fonctions
- le type est inféré par le compilateur

### 4.3 Constantes : `const`

```go
const Pi = 3.14
const AppName = "Novisec"
```

Une constante ne change pas pendant l’exécution.

### 4.4 Types : `type`

```go
type User struct {
    Name string
    Age  int
}
```

`type` sert à définir un nouveau type.

### 4.5 Fonctions : `func`

```go
func add(a int, b int) int {
    return a + b
}
```

- `add` est une fonction
- `a`, `b` sont des paramètres
- `int` après les parenthèses est le type de retour

***

## 5. Types et valeurs

Go est un langage **statiquement typé** : chaque valeur a un type connu à la compilation. [go101](https://go101.org/article/type-system-overview.html)

### 5.1 Types numériques

```go
var a int = 10
var b float64 = 3.14
var c uint = 42
```

### 5.2 Booléens

```go
var ok bool = true
```

### 5.3 Strings

```go
var s string = "hello"
```

### 5.4 Rune et byte

- `byte` : alias de `uint8`
- `rune` : alias de `int32`, souvent utilisé pour un caractère Unicode [go101](https://go101.org/article/type-system-overview.html)

```go
var b byte = 'A'
var r rune = 'é'
```

### 5.5 Valeurs zéro

Chaque type a une valeur zéro par défaut. [dev](https://dev.to/robogeek95/deep-dive-into-go-syntax-and-types-2l66)

- `int` → `0`
- `float64` → `0`
- `bool` → `false`
- `string` → `""`
- pointeur / slice / map / interface / fonction → `nil`

***

## 6. Littéraux

Un **littéral** est une valeur écrite directement dans le code. [go](https://go.dev/ref/spec)

Exemples :

```go
42
3.14
true
"hello"
'G'
[]int{1, 2, 3}
map[string]int{"a": 1}
```

***

## 7. Expressions

Une **expression** produit une valeur. C’est essentiel en Go : la partie droite d’une affectation est une expression. [dev](https://dev.to/robogeek95/deep-dive-into-go-syntax-and-types-2l66)

Exemples :

```go
a + b
double(x)
user.Name
scores["alice"]
x > 0
```

Exemple complet :

```go
result := (a + b) * 2
```

Ici, `(a + b) * 2` est une expression composée.

***

## 8. Opérateurs

Les opérateurs permettent de composer des expressions. La priorité des opérateurs existe bien en Go, avec les unaires d’abord, puis multiplicatifs, additifs, comparaisons, `&&`, puis `||`.  [boldlygo](https://boldlygo.tech/archive/2024-01-26-operator-precedence/)

### 8.1 Arithmétiques

```go
+  -  *  /  %
```

Exemple :

```go
x := 10 + 5
```

### 8.2 Comparaison

```go
==  !=  <  <=  >  >=
```

Exemple :

```go
if age >= 18 {
    fmt.Println("majeur")
}
```

### 8.3 Logiques

```go
&&   ||   !
```

Exemple :

```go
if isAdmin && isActive {
    fmt.Println("accès autorisé")
}
```

### 8.4 Bit à bit

```go
&   |   ^   &^   <<   >>
```

Utilisés surtout en code bas niveau. [yourbasic](https://yourbasic.org/golang/operators/)

### 8.5 Affectation composée

```go
+=  -=  *=  /=  %=  &=  |=  ^=  <<=  >>=
```

Exemple :

```go
x += 1
```

équivaut à :

```go
x = x + 1
```

### 8.6 Incrémentation

```go
i++
i--
```

Attention : en Go, `++` et `--` sont des **instructions**, pas des expressions. Tu ne peux pas écrire `x = i++`. [boldlygo](https://boldlygo.tech/archive/2024-01-26-operator-precedence/)

***

## 9. Priorité des opérateurs

Exemple :

```go
x := 1 + 2*3
```

Résultat : `7`, car `*` est évalué avant `+`. [boldlygo](https://boldlygo.tech/archive/2024-01-26-operator-precedence/)

Si tu veux forcer l’ordre :

```go
x := (1 + 2) * 3
```

Résultat : `9`.

***

## 10. Instructions de contrôle

### 10.1 `if`

```go
if x > 0 {
    fmt.Println("positif")
}
```

### 10.2 `if` avec initialisation

```go
if n := len(name); n > 10 {
    fmt.Println("nom long")
}
```

Ici, `n` n’existe que dans le `if`.

### 10.3 `else`

```go
if x > 0 {
    fmt.Println("positif")
} else {
    fmt.Println("non positif")
}
```

### 10.4 `for`

Go n’a qu’un seul mot-clé de boucle : `for`. [go](https://go.dev/tour/list)

#### Boucle classique

```go
for i := 0; i < 5; i++ {
    fmt.Println(i)
}
```

#### Boucle type while

```go
for x < 10 {
    x++
}
```

#### Boucle infinie

```go
for {
    // ...
}
```

### 10.5 `range`

`range` sert à itérer sur des structures comme slices, maps, strings, arrays, channels. [go](https://go.dev/tour/list)

```go
nums := []int{10, 20, 30}

for i, v := range nums {
    fmt.Println(i, v)
}
```

### 10.6 `switch`

```go
switch day {
case 1:
    fmt.Println("Lundi")
case 2:
    fmt.Println("Mardi")
default:
    fmt.Println("Autre")
}
```

### 10.7 `fallthrough`

Normalement un `case` s’arrête tout seul. `fallthrough` force la continuation vers le cas suivant. [go](https://go.dev/ref/spec)

```go
switch x {
case 1:
    fmt.Println("un")
    fallthrough
case 2:
    fmt.Println("deux")
}
```

### 10.8 `break` et `continue`

- `break` : sort de la boucle ou du switch
- `continue` : passe à l’itération suivante

```go
for i := 0; i < 10; i++ {
    if i == 5 {
        continue
    }
    if i == 8 {
        break
    }
    fmt.Println(i)
}
```

### 10.9 `goto`

Existe en Go, mais reste rare. [go](https://go.dev/ref/spec)

```go
goto End
fmt.Println("jamais exécuté")
End:
fmt.Println("fin")
```

***

## 11. Fonctions

### 11.1 Signature

```go
func add(a int, b int) int
```

Cette signature veut dire :

- nom : `add`
- paramètres : `a`, `b`
- type de retour : `int`

### 11.2 Corps

```go
func add(a int, b int) int {
    return a + b
}
```

### 11.3 Plusieurs retours

```go
func swap(a, b string) (string, string) {
    return b, a
}
```

### 11.4 Retour nommé

```go
func split(sum int) (x, y int) {
    x = sum / 2
    y = sum - x
    return
}
```

### 11.5 Fonctions anonymes

```go
double := func(n int) int {
    return n * 2
}
```

***

## 12. Structs

Un `struct` regroupe plusieurs champs sous un même type. [dev](https://dev.to/robogeek95/deep-dive-into-go-syntax-and-types-2l66)

```go
type Container struct {
    ID     string
    Image  string
    Status string
}
```

Utilisation :

```go
c := Container{
    ID:     "abc",
    Image:  "nginx",
    Status: "running",
}
```

Accès à un champ :

```go
fmt.Println(c.Image)
```

***

## 13. Méthodes

Une méthode est une fonction avec un **receiver**. Le Tour of Go décrit précisément une méthode comme une fonction avec un receiver spécial avant le nom. [go](https://go.dev/tour/methods)

```go
func (c Container) DisplayName() string {
    return c.ID
}
```

- `(c Container)` : receiver
- `DisplayName` : méthode du type `Container`

Appel :

```go
name := c.DisplayName()
```

### Receiver valeur

```go
func (u User) IsAdult() bool {
    return u.Age >= 18
}
```

### Receiver pointeur

```go
func (u *User) Birthday() {
    u.Age++
}
```

Utilise un pointeur quand tu veux modifier l’objet.

***

## 14. Pointeurs

```go
x := 10
p := &x
fmt.Println(*p)
```

- `&x` : adresse de `x`
- `*p` : valeur pointée

Modification :

```go
*p = 20
```

Alors `x` vaut maintenant `20`.

***

## 15. Interfaces

Une interface décrit un **comportement**, pas une structure de données. [go](https://go.dev/tour/methods)

```go
type Stringer interface {
    String() string
}
```

Tout type possédant une méthode `String() string` satisfait cette interface.

Exemple :

```go
type User struct {
    Name string
}

func (u User) String() string {
    return u.Name
}
```

Ici, `User` implémente implicitement `Stringer`.

***

## 16. Arrays, slices, maps

### 16.1 Array

Taille fixe :

```go
var a  [go](https://go.dev/tour/list)int
```

### 16.2 Slice

Structure dynamique très utilisée. [go](https://go.dev/tour/list)

```go
nums := []int{1, 2, 3}
nums = append(nums, 4)
```

### 16.3 Map

Associations clé → valeur.

```go
scores := make(map[string]int)
scores["alice"] = 10
```

Lecture :

```go
score, ok := scores["alice"]
```

- `score` = valeur
- `ok` = vrai si la clé existe

***

## 17. Packages et imports

### 17.1 Package

```go
package scanner
```

### 17.2 Import simple

```go
import "fmt"
```

### 17.3 Import groupé

```go
import (
    "fmt"
    "strings"
)
```

### 17.4 Alias

```go
import s "strings"
```

Utilisation :

```go
s.ToUpper("hello")
```

***

## 18. Gestion des erreurs

En Go, on utilise le type `error` au lieu d’exceptions comme mécanisme principal. [go](https://go.dev/tour/list)

```go
func load() error {
    return fmt.Errorf("échec")
}
```

Usage idiomatique :

```go
err := load()
if err != nil {
    fmt.Println(err)
}
```

Pattern fréquent :

```go
value, err := doSomething()
if err != nil {
    return err
}
```

***

## 19. `defer`, `return`, `panic`, `recover`

### `return`

Renvoie une valeur depuis une fonction.

```go
return 42
```

### `defer`

Planifie un appel pour la fin de la fonction.

```go
f, _ := os.Open("file.txt")
defer f.Close()
```

Très utile pour fermer fichiers, connexions, body HTTP.

### `panic`

Interrompt brutalement l’exécution normale.

```go
panic("fatal")
```

### `recover`

Permet de récupérer une panic dans un `defer`.

Ces deux derniers sont plus avancés, et moins centraux que `error` pour débuter. [go](https://go.dev/ref/spec)

***

## 20. Concurrence : `go`, `chan`, `select`

Go intègre la concurrence dans le langage. [go](https://go.dev/tour/concurrency/11)

### 20.1 Goroutine

```go
go worker()
```

Lance `worker()` de manière concurrente.

### 20.2 Channel

```go
ch := make(chan int)
ch <- 42
x := <-ch
```

- envoi : `ch <- 42`
- réception : `x := <-ch`

### 20.3 `select`

Permet d’attendre plusieurs canaux à la fois.

```go
select {
case msg := <-ch1:
    fmt.Println(msg)
case msg := <-ch2:
    fmt.Println(msg)
default:
    fmt.Println("rien")
}
```

La fermeture correcte des channels est importante pour éviter les blocages, comme on le voit souvent dans les explications de concurrence Go. [reddit](https://www.reddit.com/r/golang/comments/17du21i/asking_for_help_in_go_tour_concurrency/)

***

## 21. Vocabulaire Go essentiel

Voici un petit lexique utile.

| Terme | Signification |
|---|---|
| package | module logique de code |
| import | inclusion d’un package |
| identifier | nom d’une variable, fonction, type, etc. |
| declaration | instruction qui introduit une variable, type, constante, fonction |
| literal | valeur écrite directement dans le code |
| expression | morceau de code qui produit une valeur |
| statement / instruction | action exécutée par le programme |
| zero value | valeur par défaut d’un type |
| receiver | paramètre spécial d’une méthode |
| interface | contrat de comportement |
| slice | tableau dynamique |
| map | dictionnaire clé-valeur |
| channel | canal de communication entre goroutines |
| goroutine | tâche légère concurrente |
| exported | visible depuis les autres packages |
| unexported | privé au package |

***

## 22. Exemple complet annoté

```go
package main

import "fmt"

type User struct {
    Name string
    Age  int
}

func (u User) IsAdult() bool {
    return u.Age >= 18
}

func main() {
    user := User{Name: "Nico", Age: 20}

    if user.IsAdult() {
        fmt.Println(user.Name, "est majeur")
    } else {
        fmt.Println(user.Name, "est mineur")
    }
}
```

### Lecture grammaticale

- `package main` : déclaration du package
- `import "fmt"` : import
- `type User struct { ... }` : déclaration de type
- `func (u User) IsAdult() bool` : méthode
- `func main()` : fonction principale
- `user := User{...}` : déclaration courte + littéral struct
- `if user.IsAdult() { ... } else { ... }` : instruction conditionnelle
- `fmt.Println(...)` : appel de fonction

***

## 23. Ce qu’il faut apprendre dans l’ordre

Pour un débutant, l’ordre le plus efficace est :

1. packages, variables, types simples  
2. `if`, `for`, `switch`  
3. fonctions et erreurs  
4. structs et méthodes  
5. slices, maps  
6. interfaces  
7. pointeurs  
8. concurrence (`go`, `chan`, `select`) [go](https://go.dev/tour/concurrency)

***

## 24. Différence entre “grammaire” et “idiome”

C’est un point important :

- la **grammaire** = ce que le langage autorise syntaxiquement
- l’**idiome Go** = la manière “propre” et habituelle d’écrire du Go

Exemple :

```go
if err != nil {
    return err
}
```

Ce n’est pas juste valide grammaticalement : c’est aussi un **idiome central** du langage Go. [forum.golangbridge](https://forum.golangbridge.org/t/recommended-ways-to-learn-the-standard-library/34511)

***

Je peux encore améliorer ça d’une troisième manière : te faire une **version ultra propre en mode support de cours**, avec sections :

- définition
- syntaxe
- rôle
- exemple
- erreurs fréquentes
- mini-exercice

pour **chaque** notion Go importante.