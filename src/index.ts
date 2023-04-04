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
    const countByFolderId = _.mapValues(_.groupBy(lib.readNotes(), v => v.note_folder_id), v => v.length);

    console.log('List of available folders:');
    console.table(noteFolders.map(folder => ({...folder, count: countByFolderId[folder.id] })));
  });

program
  .command('list-notes')
  .description('List all notes')
  .option('-f, --folder <folder>', 'Filter notes by folder name')
  .action((options) => {
    const lib = getLib();
    let notes = lib.readNotes();

    if (options.folder) {
      notes = lib.filterNotesByFolderName(notes, options.folder);

      console.log(`Notes for folder: ${options.folder}`);
    } else {
      console.log('List of all notes:');
    }

   console.table(notes.map((note) => ({
     ..._.pick(note, ['id', 'name', 'createdAt']),
     folder: lib.findFolderById(note.note_folder_id)?.name,
   })));
  });

program
  .command('export-notes')
  .description('Export notes')
  .option('-f, --folder <folder>',   'Export notes for the specified folder')
  .option('-t, --add-tags <tags>',   'Add YAML tags to the exported note')
  .option('-c, --clear-export-dirs', 'Deletes the export dirs, if they are exist')
  .option('-a, --archive',           'Move notes to the archive folder')
  .action((options) => {
    const isArchive = !!options.archive;
    const lib = getLib();
    let notes = lib.readNotes();

    if (!!options.clearExportDirs) {
      lib.clearExportDirs();
      console.log('Export dirs are deleted');
    }

    if (options.addTags) {
      console.warn('--add-tags is not supported yet')
      process.exit(1);
    }

    if (options.folder) {
      notes = lib.filterNotesByFolderName(notes, options.folder);

      console.log(`Export notes for folder: ${options.folder}`, ' (', notes.length, ')');
    } else {
      console.log('Export all notes (', notes.length, ')');
    }

    lib.exportNotes(notes, { isArchive })
    console.log('Done!');
  });

program.parse(process.argv);

