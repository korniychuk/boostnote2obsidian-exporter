# Boostnote → Obsidian exporter

- `.cson` -> `.md`
- Humanized name of `.md` files, instead of hash in `.cson` files. (takes from `.title`)
- Sanitizes not acceptable for file name symbols from title.
- Updates attachments paths. Ex.: `:storage/note-hash/file.png` -> `note-hash/file.png`
- Moves attachments from `attachments` to `exported-notes/Files`
- Adds YAML-metadata with 2 attributes `createdAt` & `updatedAt`
- Never overwrites notes with equal names: duplicates get a ` (2)`, ` (3)`, ... suffix (with a warning)
- Re-export is safe: a note whose identical file already exists is skipped (see *Notes* below)
- Optionally exports notes into subdirs named after their Boostnote folders (`--by-folder`)

### Installation

No infrastructure. Clone the repo and run via `ts-node`.

```bash
# Clone
git clone git@github.com:korniychuk/boostnote2obsidian-exporter.git boostnote2obsidian
# or
git clone https://github.com/korniychuk/boostnote2obsidian-exporter.git boostnote2obsidian

# Ensure Node & TS-Node installed
❯ node -v
v18.3.0
❯ ts-node -v
v10.9.1

# Usage
cd /my/boostnote/vault/root
ts-node /full/path/to/cloned-folder/boostnote2obsidian --help
ts-node /full/path/to/cloned-folder/boostnote2obsidian list-folders
```

### How it works

It converts `.cson` notes that Boostnote created into a regular `.md` files with good names (from title).

The script creates next folders inside the root of the Boostnote Vault:

- ./**archived-notes** - backup of the converted notes
- ./**archived-attachments** - backup of the moved attachments
- ./**exported-notes** - the converted notes that you looking for. With `--by-folder`: `exported-notes/<Folder>/<Note>.md`
- ./exported-notes/**Files** - all attachments of the converted notes. (move its content to Obsidian attachments dir)

### Usage

Execute all the commands in a Boostnote **Vault Root** (it always contains `boostnote.json` file).

```bash
Usage: boostnote2obsidian [options] [command]

Options:
  -h, --help              display help for command

Commands:
  list-folders            List available folders
  list-notes [options]    List all notes
  export-notes [options]  Export notes
  help [command]          display help for command
```


```bash
❯ cd /my/boostnote/vault
❯ boostnote2obsidian list-folders

List of available folders:
┌─────────┬────────────────────────┬──────────────┬───────────┬───────┐
│ (index) │           id           │     name     │   color   │ count │
├─────────┼────────────────────────┼──────────────┼───────────┼───────┤
│    2    │ '14e3c566b375d7191004' │ 'Daily 2019' │ '#E10051' │  250  │
│    3    │ '31d743737b62ee99341f' │ 'Daily 2018' │ '#E8D252' │  97   │
│    5    │ '15f741fc3bf95b8a91c4' │   'other'    │ '#B013A4' │  16   │
└─────────┴────────────────────────┴──────────────┴───────────┴───────┘
```

```bash
❯ boostnote2obsidian list-notes --folder 'other'

Notes for folder: other
┌─────────┬────────────────────────────────────────┬────────────────────────────┬────────────────────────────┬─────────┐
│ (index) │                   id                   │            name            │         createdAt          │ folder  │
├─────────┼────────────────────────────────────────┼────────────────────────────┼────────────────────────────┼─────────┤
│    1    │ '0dadf83e-16a1-4183-a490-269ee6fc8d06' │     'TechTalk Zone.JS'     │ '2020-02-24T14:08:02.533Z' │ 'other' │
│   10    │ '5db5a488-0763-4ddf-a976-3d128ddc59c5' │     'English phrases'      │ '2018-08-27T03:23:27.896Z' │ 'other' │
│   14    │ 'd5da5c8f-f8dd-4e0f-8d05-2d8d37087a7d' │ 'JS Breackfast 13.11.2018' │ '2018-11-08T10:45:36.863Z' │ 'other' │
└─────────┴────────────────────────────────────────┴────────────────────────────┴────────────────────────────┴─────────┘
```

### Export

```
Usage: boostnote2obsidian export-notes [options]

Options:
  -f, --folder <folder>    Export notes for the specified folder
  -t, --add-tags <tags>    Add YAML tags to the exported note
  -c, --clear-export-dirs  Deletes the export dirs, if they are exist
  -a, --archive            Move notes to the archive folder
  -d, --by-folder          Export notes into subdirs named after their Boostnote folders
  -h, --help               display help for command
```

```bash
❯ boostnote2obsidian --clear-export-dirs --folder "other" --archive

Export dirs are deleted
Export notes for folder: other ( 55 )
```

Notes:
- `--by-folder`: folder names are sanitized like note names. Notes of an unknown folder go to the export root (with a warning).
- Files that already exist in `exported-notes` are never overwritten. An existing file is compared with the note by its body only
  (YAML metadata and surrounding whitespace are ignored, so exporter format changes don't matter):
  - same body → the note is skipped (`Identical file already exists (SKIP)`);
  - different body (the note changed in Boostnote, the file was edited in Obsidian, or it's another note) → the note gets a ` (2)`, ` (3)`, ... suffix.
- The final line sums it up: `Done! Written: N (renamed copies: K), skipped as identical: M`.

### Ideas
- [ ] Add name transformers to transform daily notes date for example
- [ ] Implement adding custom tags via `--tags` (in progress)

