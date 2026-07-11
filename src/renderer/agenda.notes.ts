/**
 * Module: agenda.notes
 * 
 * Ce module définit les structures et la logique architecturale pour l'intégration de la prise
 * de notes (type Markdown / Obsidian) dans l'application Taskonbase.
 */

export interface AgendaNote {
  id: string;             // Identifiant unique de la note
  title: string;          // Titre de la note (nom du fichier .md)
  content: string;        // Contenu brut de la note (format Markdown)
  createdAt: string;      // Date de création (ISO string)
  updatedAt: string;      // Date de dernière modification (ISO string)
  associatedDate?: string; // Date calendrier liée (format YYYY-MM-DD), pour les Daily Notes
  linkedTaskIds?: string[]; // IDs des tâches de l'agenda liées à cette note (liens bidirectionnels)
}

export interface NotesStorageConfig {
  mode: 'localstorage' | 'filesystem'; // Mode de stockage
  localDirectoryPath?: string;         // Chemin du dossier physique sur le disque (Vault Obsidian)
}

export class AgendaNotesManager {
  private config: NotesStorageConfig = {
    mode: 'localstorage'
  };

  constructor() {
    this.loadConfig();
  }

  /**
   * Charge la configuration de stockage des notes
   */
  private loadConfig(): void {
    try {
      const raw = localStorage.getItem('agenda-notes-config-v1');
      if (raw) {
        this.config = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load notes config', e);
    }
  }

  /**
   * Sauvegarde la configuration de stockage
   */
  public saveConfig(config: NotesStorageConfig): void {
    this.config = config;
    try {
      localStorage.setItem('agenda-notes-config-v1', JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save notes config', e);
    }
  }

  /**
   * Récupère la liste de toutes les notes disponibles
   */
  public async listNotes(): Promise<AgendaNote[]> {
    if (this.config.mode === 'filesystem' && this.config.localDirectoryPath) {
      // TODO: Passer par l'IPC Electron pour lire les fichiers .md du dossier physique
      return this.fetchNotesFromFileSystem();
    } else {
      return this.fetchNotesFromLocalStorage();
    }
  }

  /**
   * Récupère ou initialise la note quotidienne (Daily Note) pour une date donnée
   */
  public async getOrCreateDailyNote(dateISO: string): Promise<AgendaNote> {
    const notes = await this.listNotes();
    let dailyNote = notes.find(n => n.associatedDate === dateISO);

    if (!dailyNote) {
      dailyNote = {
        id: `daily-${dateISO}`,
        title: `${dateISO}`,
        content: `# Notes pour le ${dateISO}\n\n- \n`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        associatedDate: dateISO,
        linkedTaskIds: []
      };
      await this.saveNote(dailyNote);
    }
    return dailyNote;
  }

  /**
   * Sauvegarde une note (création ou mise à jour)
   */
  public async saveNote(note: AgendaNote): Promise<void> {
    note.updatedAt = new Date().toISOString();
    if (this.config.mode === 'filesystem' && this.config.localDirectoryPath) {
      await this.writeNoteToFileSystem(note);
    } else {
      await this.writeNoteToLocalStorage(note);
    }
  }

  /**
   * Supprime une note
   */
  public async deleteNote(noteId: string): Promise<void> {
    if (this.config.mode === 'filesystem' && this.config.localDirectoryPath) {
      await this.deleteNoteFromFileSystem(noteId);
    } else {
      await this.deleteNoteFromLocalStorage(noteId);
    }
  }

  /**
   * Lie bidirectionnellement une note et une tâche
   */
  public async linkNoteToTask(noteId: string, taskId: string): Promise<void> {
    const notes = await this.listNotes();
    const note = notes.find(n => n.id === noteId);
    if (note) {
      if (!note.linkedTaskIds) note.linkedTaskIds = [];
      if (!note.linkedTaskIds.includes(taskId)) {
        note.linkedTaskIds.push(taskId);
        await this.saveNote(note);
      }
    }
  }

  // ── Moteur LocalStorage (Fallback) ───────────────────────────────────
  private fetchNotesFromLocalStorage(): AgendaNote[] {
    try {
      const raw = localStorage.getItem('agenda-notes-data-v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeNoteToLocalStorage(note: AgendaNote): void {
    const notes = this.fetchNotesFromLocalStorage();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      notes[idx] = note;
    } else {
      notes.push(note);
    }
    localStorage.setItem('agenda-notes-data-v1', JSON.stringify(notes));
  }

  private deleteNoteFromLocalStorage(noteId: string): void {
    let notes = this.fetchNotesFromLocalStorage();
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem('agenda-notes-data-v1', JSON.stringify(notes));
  }

  // ── Moteur File System (Electron IPC Mockups) ────────────────────────
  private async fetchNotesFromFileSystem(): Promise<AgendaNote[]> {
    // Cette méthode invoquera l'API Electron IPC (ex: window.electron.readNotesDirectory())
    console.log('Lecture des fichiers du dossier :', this.config.localDirectoryPath);
    return [];
  }

  private async writeNoteToFileSystem(note: AgendaNote): Promise<void> {
    // Invoquera l'API Electron IPC pour écrire un fichier .md (ex: window.electron.writeNoteFile())
    console.log('Écriture du fichier pour la note :', note.title);
  }

  private async deleteNoteFromFileSystem(noteId: string): Promise<void> {
    // Invoquera l'API Electron IPC pour supprimer un fichier (ex: window.electron.deleteNoteFile())
    console.log('Suppression du fichier pour la note ID :', noteId);
  }
}
