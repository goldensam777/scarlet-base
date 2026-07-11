/**
 * Module: agenda.notes
 * 
 * Ce module définit les structures et la logique pour l'intégration de la prise
 * de notes (type Markdown / Obsidian) dans l'application TaskFlow.
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
  mode: 'localstorage' | 'filesystem'; // mode 'localstorage' sauvegarde dans ~/.taskflow/db.json
  localDirectoryPath?: string;         // Chemin du dossier physique sur le disque (Vault Obsidian)
}

export class AgendaNotesManager {
  private config: NotesStorageConfig = {
    mode: 'localstorage'
  };

  constructor() {
    // La configuration sera chargée de façon asynchrone lors des appels listNotes/saveNote
  }

  /**
   * Charge la configuration de stockage des notes depuis le fichier de BDD
   */
  public async loadConfig(): Promise<NotesStorageConfig> {
    try {
      const db = await (window as any).electronAPI.loadData();
      if (db && db.notesConfig) {
        this.config = db.notesConfig;
      }
    } catch (e) {
      console.error('Failed to load notes config', e);
    }
    return this.config;
  }

  /**
   * Sauvegarde la configuration de stockage dans le fichier de BDD
   */
  public async saveConfig(config: NotesStorageConfig): Promise<void> {
    this.config = config;
    try {
      const db = await (window as any).electronAPI.loadData() || {};
      db.notesConfig = config;
      await (window as any).electronAPI.saveData(db);
    } catch (e) {
      console.error('Failed to save notes config', e);
    }
  }

  /**
   * Récupère la liste de toutes les notes disponibles
   */
  public async listNotes(): Promise<AgendaNote[]> {
    await this.loadConfig();
    if (this.config.mode === 'filesystem' && this.config.localDirectoryPath) {
      // TODO: Passer par l'IPC Electron pour lire les fichiers .md du dossier physique
      return this.fetchNotesFromFileSystem();
    } else {
      return this.fetchNotesFromDB();
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
        content: `# Notes du ${dateISO}\n\n- \n`,
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
    await this.loadConfig();
    if (this.config.mode === 'filesystem' && this.config.localDirectoryPath) {
      await this.writeNoteToFileSystem(note);
    } else {
      await this.writeNoteToDB(note);
    }
  }

  /**
   * Supprime une note
   */
  public async deleteNote(noteId: string): Promise<void> {
    await this.loadConfig();
    if (this.config.mode === 'filesystem' && this.config.localDirectoryPath) {
      await this.deleteNoteFromFileSystem(noteId);
    } else {
      await this.deleteNoteFromDB(noteId);
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

  // ── Moteur BDD de Fichiers (Sauvegarde dans ~/.taskflow/db.json) ────────────────
  private async fetchNotesFromDB(): Promise<AgendaNote[]> {
    try {
      const db = await (window as any).electronAPI.loadData();
      return db?.notes || [];
    } catch {
      return [];
    }
  }

  private async writeNoteToDB(note: AgendaNote): Promise<void> {
    try {
      const db = await (window as any).electronAPI.loadData() || {};
      const notes = db.notes || [];
      const idx = notes.findIndex((n: AgendaNote) => n.id === note.id);
      if (idx >= 0) {
        notes[idx] = note;
      } else {
        notes.push(note);
      }
      db.notes = notes;
      await (window as any).electronAPI.saveData(db);
    } catch (e) {
      console.error('Failed to write note to database', e);
    }
  }

  private async deleteNoteFromDB(noteId: string): Promise<void> {
    try {
      const db = await (window as any).electronAPI.loadData() || {};
      let notes = db.notes || [];
      notes = notes.filter((n: AgendaNote) => n.id !== noteId);
      db.notes = notes;
      await (window as any).electronAPI.saveData(db);
    } catch (e) {
      console.error('Failed to delete note from database', e);
    }
  }

  // ── Moteur File System (Electron IPC Mockups pour Obsidian) ────────────────────────
  private async fetchNotesFromFileSystem(): Promise<AgendaNote[]> {
    console.log('Lecture des fichiers du dossier :', this.config.localDirectoryPath);
    return [];
  }

  private async writeNoteToFileSystem(note: AgendaNote): Promise<void> {
    console.log('Écriture du fichier pour la note :', note.title);
  }

  private async deleteNoteFromFileSystem(noteId: string): Promise<void> {
    console.log('Suppression du fichier pour la note ID :', noteId);
  }
}
