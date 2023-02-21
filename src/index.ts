import { Command } from 'commander';
import _ from 'lodash';
import { Note, NoteFolder, Lib } from './lib';

const program = new Command();

function getLib(): Lib {
  return new Lib({
    boostnoteDir: process.cwd(),
    exportDir: process.cwd(),
  });
}

program
  .command('list-folders')
  .description('List available folders')
  .action(() => {
    const lib = getLib();
    const noteFolders = lib.readFolders();
    console.log('List of available folders:');
    console.table(noteFolders);
  });

program
  .command('list-notes')
  .description('List all notes')
  .option('-f, --folder <folder>', 'Filter notes by folder name')
 .action((options) => {
    const lib = getLib();
    const folders = lib.readFolders();
    const foldersById = new Map(folders.map(v => [v.id, v]));
    let notes = lib.readNotes();

    if (options.folder) {
      notes = lib.filterNotesByFolderName(notes, folders, options.folder);

      console.log(`Notes for folder: ${options.folder}`);
    } else {
      console.log('List of all notes:');
    }

   console.table(notes.map((note) => ({
     ..._.pick(note, ['id', 'name', 'createdAt']),
     folder: foldersById.get(note.note_folder_id)?.name,
   })));
  });

program
  .command('export-notes')
  .description('Export notes')
  .option('-f, --folder <folder>', 'Export notes for the specified folder')
  .option('-t, --add-tags <tags>', 'Add YAML tags to the exported note')
  .action((options) => {
    const lib = getLib();
    const folders = lib.readFolders();
    // const foldersById = new Map(folders.map(v => [v.id, v]));
    let notes = lib.readNotes();

    if (options.addTags) {
      console.warn('--add-tags is not supported yet')
      process.exit(1);
    }

    if (options.folder) {
      notes = lib.filterNotesByFolderName(notes, folders, options.folder);

      console.log(`Export notes for folder: ${options.folder}`);
    } else {
      console.log('Export all notes');
    }

    lib.exportNotes(notes)
  });

program.parse(process.argv);

