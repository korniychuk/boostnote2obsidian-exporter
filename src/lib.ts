import * as fs from 'fs';
import * as path from 'path';
import * as cson from 'cson-parser';
import _ from 'lodash';

export interface Note {
  id: string;
  /** Ready to use in FS note name. Not empty, special chars are filtered */
  name: string;
  note_folder_id: string;
  createdAt: string;
  updatedAt: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  isStarred: boolean;
  isTrashed: boolean;
  /** Attachments path (relative to the attachmests dir). Existence of each attachment is checked at the read step */
  attachments: string[];
}

export interface NoteFolder {
  id: string;
  name: string;
  color: string;
}

interface Config {
  /** Root Boostnote Vault dire where boostnote.json is located */
  boostnoteDir: string;
  exportDir: string;
}

export class Lib {

  private readonly boostnoteCfg: {
    attachmentsDirPath: string;
    notesDirPath: string;
    configFilePath: string;
  };

  private readonly archiveCfg: {
    notesDirPath: string;
    attachmentsDirPath: string;
  };

  private readonly exportCfg: {
    notesDirPath: string;
    attachmentsDirPath: string;
  };

  public get folders(): NoteFolder[] {
    if (!this._folders) this._folders = this.readFolders();
    return this._folders;
  }
  private _folders?: NoteFolder[];

  public constructor(
    config: Config,
  ) {
    if (!fs.existsSync(config.boostnoteDir)) {
      throw new Error('Boostnote Dir doesn\'t exist: ' + config.boostnoteDir);
    }

    this.boostnoteCfg = {
      attachmentsDirPath: path.join(config.boostnoteDir, 'attachments'),
      notesDirPath: path.join(config.boostnoteDir, 'notes'),
      configFilePath: path.join(config.boostnoteDir, 'boostnote.json'),
    };

    this.archiveCfg = {
      notesDirPath: path.join(config.boostnoteDir, 'archived-notes'),
      attachmentsDirPath: path.join(config.boostnoteDir, 'archived-attachments'),
    };

    this.exportCfg = {
      notesDirPath: path.join(config.exportDir, 'exported-notes'),
      attachmentsDirPath: path.join(config.exportDir, 'exported-notes', 'Files'),
    };

    this.checkDirectories(this.boostnoteCfg);
  }

  public archiveNote(note: Note): void {
    // 1. Archive the note itself
    const originalPath = this.getFullOriginalNotePath(note.id);
    if (!fs.existsSync(originalPath)) throw new Error(`Can't archive absent file: ${ originalPath }`);

    const targetNotePath = path.join(this.archiveCfg.notesDirPath, note.id + '.cson')
    if (fs.existsSync(targetNotePath)) throw new Error(`Can't archive already archived file: ${ targetNotePath }`);

    fs.renameSync(originalPath, targetNotePath);

    // 2. Archive attachments
    note.attachments.forEach((attachment) => {
        const attachmentPath = path.join(this.boostnoteCfg.attachmentsDirPath, attachment);
        const archivedAttachmentPath = path.join(this.archiveCfg.attachmentsDirPath, attachment);

        const attachmentDirname = path.dirname(archivedAttachmentPath);
        if (!fs.existsSync(attachmentDirname)) {
          fs.mkdirSync(attachmentDirname, { recursive: true });
        }

        const isFileAlreadyMoved = !fs.existsSync(attachmentPath) && fs.existsSync(archivedAttachmentPath);
        if (!isFileAlreadyMoved) {
          fs.renameSync(attachmentPath, archivedAttachmentPath); // existance of the source is checked at the read step
        } else {
          console.warn('Warning! File is already moved:', attachmentPath);
        }
    });
  }

  public clearExportDirs(): void {
    if (fs.existsSync(this.exportCfg.notesDirPath)) {
      fs.rmSync(this.exportCfg.notesDirPath, { recursive: true, force: true });
    }
    if (fs.existsSync(this.exportCfg.attachmentsDirPath)) {
      fs.rmSync(this.exportCfg.attachmentsDirPath, { recursive: true, force: true });
    }
  }

  public exportNotes(
    notes: Note[],
    { isAddYamlFolder = false, isArchive = false }: { isAddYamlFolder?: boolean, isArchive?: boolean } = {},
  ): void {
    this.createIfAbsentDirectories(this.exportCfg);
    if (isArchive) this.createIfAbsentDirectories(this.archiveCfg);

    const exportDir = this.exportCfg.notesDirPath;
    const attachmentDir = this.boostnoteCfg.attachmentsDirPath;
    const attachmentExportDir = this.exportCfg.attachmentsDirPath;

    notes.forEach((note) => {
      const fileName = `${note.name}.md`;
      const filePath = path.join(exportDir, fileName);

      const content = this.generateYAMLMetadataForNote(note, isAddYamlFolder) + '\n' + note.content;
      fs.writeFileSync(filePath, content, 'utf-8');

      note.attachments.forEach((attachment) => {
        const attachmentPath = path.join(attachmentDir, attachment);
        const exportAttachmentPath = path.join(attachmentExportDir, attachment);

        const attachmentDirname = path.dirname(exportAttachmentPath);
        if (!fs.existsSync(attachmentDirname)) {
          fs.mkdirSync(attachmentDirname, { recursive: true });
        }

        fs.copyFileSync(attachmentPath, exportAttachmentPath); // existance of the source is checked at the read step
      });

      // const stat = fs.statSync(filePath);
      fs.utimesSync(filePath, new Date(note.updatedAt), new Date(note.createdAt));

      if (isArchive) this.archiveNote(note);
    });
  }

  public readFolders(): NoteFolder[] {
    const noteFolderData = fs.readFileSync(this.boostnoteCfg.configFilePath, 'utf-8');
    const noteFolders: NoteFolder[] = JSON.parse(noteFolderData).folders.map(({ key: id, name, color }: any) => ({
      id,
      name,
      color
    }));

    return noteFolders;
  }

  public readNotes(): Note[] {
    const notesDir = this.boostnoteCfg.notesDirPath;
    const noteFiles = fs.readdirSync(notesDir).filter((file) => path.extname(file) === '.cson');

    const notes: Note[] = noteFiles
      .map((file): Note => {
        const noteData = fs.readFileSync(path.join(notesDir, file), 'utf-8');
        const parsedNote = cson.parse(noteData);

        return {
          id: path.basename(file, '.cson'),
          name: parsedNote.title,
          note_folder_id: parsedNote.folder,
          createdAt: parsedNote.createdAt,
          updatedAt: parsedNote.updatedAt,
          type: parsedNote.type,
          title: parsedNote.title,
          content: parsedNote.content,
          tags: parsedNote.tags,
          isStarred: parsedNote.isStarred,
          isTrashed: parsedNote.isTrashed,
          attachments: [],
        };
      })
      .filter((note: Note) => {
        if (note.content && note.title) return true;
        console.warn('A note without content or name:', _.pick(note, ['id', 'name', 'content', 'note_folder_id', 'type']));
        return false;
      })
      .map((note: Note) => {
        note.attachments = this.collectAttachments(note); // should be before content adjustment!
        note.content = this.adjustNoteContent(note);
        note.name = note.name
          .replace(/-{2,}/g, '-')
          .replace(/[^а-яё\w\s.-]/ig, '')
          .trim()
          .replace(/\s{2,}/g, ' ');

        return note;
      })
      .filter(note => {
        if (note.name) return true;
        console.warn('Invalin note name:', _.pick(note, ['id', 'name', 'content', 'note_folder_id', 'type']), '(SKIP)');
      })
      ;

    return notes;
  }

  public findFolderByName(folderName: string): NoteFolder {
    const folder = this.folders.find(folder => folder.name.toLowerCase() === folderName.toLowerCase());
    if (!folder) {
      throw new Error(`Can't find a folder by nam: ${folderName}`);
    }

    return folder;
  }

  public findFolderById(folderId: string): NoteFolder {
    const folder = this.folders.find(folder => folder.id === folderId);
    if (!folder) {
      throw new Error(`Can't find a folder by ID: ${folderId}`);
    }

    return folder;
  }

  public filterNotesByFolderName(notes: Note[], folderName: string): Note[] {
    const folderId = this.findFolderByName(folderName).id;

    return notes.filter(note => note.note_folder_id === folderId);
  }

  // TODO: Delete if not used
  private getFileSizeInBytes(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      return fileSizeInBytes;
    } catch (err) {
      console.error(`Error: Can't get the file size: ${filePath}.\nOriginal Error:`, (err as any)?.message);
      return 0;
    }
  }

  private generateYAMLMetadataForNote(note: Note, isAddFolder = true): string {
    const escape = (v: string) => v.replace('"', '\\"');
    const kv: [key: string, value: string | string[]][] = [
      ['createdAt', note.createdAt],
      ['updatedAt', note.updatedAt],
    ];
    if (note.tags.length) kv.push(['tags', note.tags.map(tag => `#${escape(tag)}`)]);
    if (isAddFolder) kv.push(['folder', this.findFolderById(note.note_folder_id).name]);

    const yaml = kv.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                   .join('\n');

    return `---\n${yaml}\n---`;
  }

  private getFullOriginalNotePath(noteId: string): string {
    return path.join(this.boostnoteCfg.notesDirPath, noteId + '.cson');
  }

  private checkDirectories(dirs: { [pathKey: string]: string }): void {
    Object.entries(dirs).forEach(([pathKey, path]) => {
      if (!fs.existsSync(path)) {
        throw new Error(`Error: ${_.capitalize(pathKey)} (${path}) does not exist.`);
      }
    });
  }

  private createIfAbsentDirectories(dirs: { [pathKey: string]: string }): void {
    Object.values(dirs).forEach((path) => {
      if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
    });
  }

  private collectAttachments(note: Note): string[] {
    const matches = note.content.match(/:storage\/([^)]*)/g);
    if (!matches) return [];

    const paths = matches.map((match) => match.replace(/:storage\//g, ''));

    return paths.filter(relativePath => {
        const fullPath = path.join(this.boostnoteCfg.attachmentsDirPath, relativePath);
        if (fs.existsSync(fullPath)) return true;
        console.warn(`Note (${note.title}): Attachment not found: ${fullPath}`);
    });
  }

  private adjustNoteContent(note: Note): Note['content'] {
    let content = note.content.replace(/:storage\//g, '');

    if (!/^(#\s|\[TOC\])/.test(content)) {
      content = `# ${note.name}\n\n${content}`;
    }

    if (/^\[TOC\]/.test(content)) {
      content = content.replace(/^\[TOC\]\s*/, '');
    }

    return content;
  }
}

