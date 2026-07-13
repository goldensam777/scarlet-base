# Scarlet Base

Scarlet Base est un agenda de bureau minimaliste, performant et haut de gamme développé en **TypeScript**, **Electron** et **Vite**. Il combine un calendrier interactif à 3 colonnes avec un gestionnaire de tâches fluide et un moteur de prise de notes de type **Obsidian** (Markdown, fichiers locaux et liaisons bidirectionnelles).

---

## ✨ Fonctionnalités Principales

### 1. Vue Signature « Aujourd'hui. »
* **Design Épuré** : Un mode focus quotidien noir et ambre avec le grand titre minuscule caractéristique.
* **LEDs Interactives** : Les cases à cocher sont des cercles LED qui s'illuminent d'un halo ambre chaleureux une fois cochées.
* **Message de Repos** : L'indication *« ✦ tout fait. repose-toi. »* apparaît automatiquement quand toutes les tâches du jour sont complétées.
* **Entrée Ligne de Commande** : Ajoutez des tâches pour aujourd'hui en tapant simplement du texte dans l'invite `›` en bas de page.

### 2. Calendrier Multi-Vues (Mois / Semaine / Jour)
* **Vues Calendrier** : Naviguez de manière fluide entre l'affichage mensuel sous forme de grille et les affichages hebdomadaires/journaliers sous forme de timeline horaire.
* **Gestion des Agendas (Catégories)** : Créez des agendas personnalisés, modifiez leurs couleurs à la volée avec le sélecteur intégré, et renommez-les. En cas de suppression ou de renommage, les tâches associées sont mises à jour ou réassignées automatiquement pour éviter toute perte de données.

### 3. Gestionnaire de Tâches Intégré (Panneau de Droite)
* **Listes de Tâches** : Créez des listes de tâches thématiques, renommez-les inline, ou supprimez-les.
* **Tâches rapides** : Saisie rapide de tâches au clavier et panneau pliable récapitulant les tâches terminées.

### 4. Module de Notes (agenda.notes)
* **Daily Notes** : Système de note quotidienne liée au calendrier de la journée.
* **Liaisons Bidirectionnelles (I/O Tags)** : Liaison directe des notes aux tâches via des balises de frontmatter YAML.
* **Stockage Unifié** : Les notes sont enregistrées directement au sein de la base de données de l'application (`db.json`). Le support pour le stockage direct dans un dossier local physique (Obsidian Vault) est structurellement prévu dans le code (`agenda.notes.ts`), mais reste à implémenter.

---

## 🛠️ Spécifications Techniques & Entrées/Sorties (I/O)

Scarlet Base est conçu avec une séparation claire entre la vue et le stockage :

### Architecture des Fichiers
* [src/renderer/main.ts](file:///home/leumas-nedlog/dev/side_projects/scarletbase/src/renderer/main.ts) : Coeur logique du frontend (rendu des vues Calendrier, Listes de tâches, et Notes).
* [src/renderer/agenda.notes.ts](file:///home/leumas-nedlog/dev/side_projects/scarletbase/src/renderer/agenda.notes.ts) : Structure de données et abstractions de stockage (Moteur LocalStorage/Database).
* [electron/main.ts](file:///home/leumas-nedlog/dev/side_projects/scarletbase/electron/main.ts) : Initialisation d'Electron avec forçage de la langue en français (`fr`) pour le rendu européen des dates.

#### Structure de Frontmatter (Tags I/O)
Chaque note Markdown utilise le bloc suivant pour lier les tâches de l'agenda :
```markdown
---
date: YYYY-MM-DD
tasks_linked: [task-id-1, task-id-2]
---
# Contenu de votre note...
```

---

## 🚀 Démarrage Rapide

### Prérequis
* **Node.js** (version 18 ou supérieure recommandée)
* **npm** (inclus avec Node.js)

### Installation Automatique (Recommandé)
Pour configurer automatiquement le projet en une seule ligne (vérification des prérequis et installation des dépendances npm) :

* **Sur Linux / macOS** :
  Exécutez la commande suivante dans votre terminal (`curl`) :
  ```bash
  curl -fsSL https://raw.githubusercontent.com/goldensam777/scarlet-base/master/setup.sh | bash
  ```
  *Ou si vous avez déjà cloné le dépôt localement :*
  ```bash
  ./setup.sh
  ```

* **Sur Windows (PowerShell)** :
  Exécutez la commande suivante dans PowerShell (`irm | iex`) :
  ```powershell
  irm https://raw.githubusercontent.com/goldensam777/scarlet-base/master/setup.ps1 | iex
  ```
  *Ou si vous avez déjà cloné le dépôt localement, double-cliquez sur `setup.bat` ou lancez :*
  ```cmd
  setup.bat
  ```

### Installation Manuelle
Si vous préférez installer manuellement les dépendances :
```bash
npm install
```

### Exécution du Projet

* **Lancer en mode développement** (avec rechargement à chaud) :
  ```bash
  npm run dev
  ```

* **Compiler l'application pour la production** :
  ```bash
  npm run build
  ```
