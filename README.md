# TaskFlow 📅✍️

TaskFlow est un agenda de bureau minimaliste, performant et haut de gamme développé en **TypeScript**, **Electron** et **Vite**. Il combine un calendrier interactif à 3 colonnes (inspiré de Google Calendar et Google Tasks) avec un moteur de prise de notes de type **Obsidian** (Markdown, fichiers locaux et liaisons bidirectionnelles).

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

### 3. Google Tasks Intégré (Panneau de Droite)
* **Listes de Tâches** : Créez des listes de tâches thématiques, renommez-les inline, ou supprimez-les.
* **Tâches rapides** : Saisie rapide de tâches au clavier et panneau pliable récapitulant les tâches terminées.

### 4. Module de Notes Obsidian (agenda.notes)
* **Daily Notes** : Système de note quotidienne liée au calendrier de la journée.
* **Liaisons Bidirectionnelles (I/O Tags)** : Liaison directe des notes aux tâches via des balises de frontmatter YAML.
* **Fichiers locaux** : Architecture conçue pour se connecter directement à votre dossier physique de notes Obsidian (votre *Vault*).

---

## 🛠️ Spécifications Techniques & Entrées/Sorties (I/O)

TaskFlow est conçu avec une séparation claire entre la vue et le système de fichiers (I/O) :

### Architecture des Fichiers
* [src/renderer/main.ts](file:///home/leumas-nedlog/dev/side_projects/taskonbase/src/renderer/main.ts) : Coeur logique du frontend (rendu des vues Calendrier et Listes de tâches).
* [src/renderer/agenda.notes.ts](file:///home/leumas-nedlog/dev/side_projects/taskonbase/src/renderer/agenda.notes.ts) : Structure de données et abstractions de stockage (LocalStorage / FileSystem).
* [electron/main.ts](file:///home/leumas-nedlog/dev/side_projects/taskonbase/electron/main.ts) : Initialisation d'Electron avec forçage de la langue en français (`fr`) pour le rendu européen des dates.

### Gestion des Entrées/Sorties (I/O)
Pour interfacer les notes avec votre coffre Obsidian, le pont IPC d'Electron utilise les canaux d'I/O suivants (dans `preload.ts` et `main.ts`) :

* **`notes:select-directory`** : Ouvre une boîte de dialogue native pour sélectionner le dossier Obsidian.
* **`notes:read-all`** : Scanne le dossier et extrait les fichiers `.md`.
* **`notes:write`** : Enregistre le contenu et met à jour les tags de frontmatter YAML.
* **`notes:delete`** : Supprime physiquement la note Markdown.

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
* **Node.js** (version 18+)
* **npm**

### Installation
1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Lancez le serveur de développement Vite + Electron :
   ```bash
   npm run dev
   ```

3. Compilez l'application pour la production :
   ```bash
   npm run build
   ```
