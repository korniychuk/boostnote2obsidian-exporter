import * as fs from 'fs';
import * as path from 'path';
import * as cson from 'cson-parser';
import _ from 'lodash';

export interface Note {
  id: string;
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
  attachments: string[];
}

export interface NoteFolder {
  id: string;
  name: string;
  color: string;
}

interface Config {
  boostnoteDir: string;
  exportDir: string;
}

export class Lib {

  private readonly boostnoteCfg: {
    attachmentsDirPath: string;
    notesDirPath: string;
    configFilePath: string;
  };

  private readonly exportCfg: {
    notesDirPath: string;
    attachmentsDirPath: string;
  };

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

    this.exportCfg = {
      notesDirPath: path.join(config.exportDir, 'exported-notes'),
      attachmentsDirPath: path.join(config.exportDir, 'exported-files'),
    };

    this.checkDirectories(this.boostnoteCfg);
  }

  // TODO: implement
  public archiveNotes(notes: Note[], archiveDir = './moved-notes') {
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir);
    }

    // notes.forEach((note) => {
    //   fs.renameSync()
    // });
  }

  public exportNotes(notes: Note[]): void {
    this.createIfAbsentDirectories(this.exportCfg);

    const exportDir = this.exportCfg.notesDirPath;
    const attachmentDir = this.boostnoteCfg.attachmentsDirPath;
    const attachmentExportDir = this.exportCfg.attachmentsDirPath;

    notes.forEach((note) => {
      const filteredName = note.name
        .replace(/-{2,}/g, '-')
        .replace(/[^а-яё\w\s.-]/ig, '')
        .trim()
        .replace(/\s{2,}/g, ' ');

      if (!filteredName) {
        console.warn('Invalin note name:', _.pick(note, ['id', 'name', 'content', 'note_folder_id', 'type']));
        return note.content;
      }
      const fileName = `${filteredName}.md`;
      const filePath = path.join(exportDir, fileName);

      fs.writeFileSync(filePath, note.content, 'utf-8');

      const attachments = note.attachments;

      attachments.forEach((attachment) => {
        const attachmentPath = path.join(attachmentDir, attachment);
        const exportAttachmentPath = path.join(attachmentExportDir, attachment);

        const attachmentDirname = path.dirname(exportAttachmentPath);
        if (!fs.existsSync(attachmentDirname)) {
          fs.mkdirSync(attachmentDirname, { recursive: true });
        }

        if (fs.existsSync(attachmentPath)) {
          fs.copyFileSync(attachmentPath, exportAttachmentPath);
        } else {
          console.warn(`Attachment not found: ${attachmentPath}`);
        }
      });

      // const stat = fs.statSync(filePath);
      fs.utimesSync(filePath, new Date(note.updatedAt), new Date(note.createdAt));
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

        return note;
      });

    return notes;
  }

  public findFolderByName(folders: NoteFolder[], folderName: string): NoteFolder {
    const folder = folders.find(folder => folder.name.toLowerCase() === folderName.toLowerCase());
    if (!folder) {
      throw new Error(`Can't find a folder by nam: ${folderName}`);
    }

    return folder;
  }

  public filterNotesByFolderName(notes: Note[], folders: NoteFolder[], folderName: string): Note[] {
    const folderId = this.findFolderByName(folders, folderName).id;

    return notes.filter(note => note.note_folder_id === folderId);
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
    return matches.map((match) => match.replace(/:storage\//g, ''));
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

