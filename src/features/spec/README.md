---
type: Contract
description: "The boundary around the spec-driven comparison feature, and the zip handoff between the two machines that work on it."
---

# The spec-driven comparison feature

Everything this feature is lives in this folder. **Nothing else in the repository
belongs to it, and it owns nothing outside it.**

That is not tidiness. Two machines do the work and **nothing travels between
them except one way**:

```
  app machine                GitHub                spec machine
  everything except     --push-->  --download zip-->   this folder only
  this folder                                          (cannot push,
                                                        cannot send files out)
```

So the spec machine refreshes the whole repository from a zip and **keeps its own
`src/features/spec/`**. A single file shared across that line means every refresh
either clobbers the spec work or has to be reconciled by hand.

### The copy of this folder on GitHub is a stale mirror

Spec work does not come back. Whatever is in the repository here is frozen at
the last time it was edited on the app machine, and the real version lives on
the spec machine. It is kept so the app still builds and the tab still runs.

**On the app machine: do not edit this folder.** An edit here is work the spec
machine will never see, and it widens a gap that nothing closes.

Run `sh scripts/check-boundary.sh` on either machine to prove the separation
still holds; it catches all five ways the line gets crossed.

## The whole public surface

```ts
import { SpecTestView, SpecExportMenu } from './features/spec';
```

[`index.ts`](index.ts) exports those two components and imports
[`spec.css`](spec.css). That is the entire contract. Importing a file *inside*
this folder from anywhere else is the thing the boundary check forbids.

## What is in here

| file | what it is |
|---|---|
| `index.ts` | the barrel — the only import point |
| `SpecTestView.tsx` | the tab: uploads, the sheet → page pairing, results |
| `SpecExportMenu.tsx` | the header export menu for this tab |
| `specStore.ts` | all state for the tab (Zustand) |
| `specCheck.ts` | the checker: runs a spec against a PDF page |
| `specExport.ts` | JSON and printable-HTML output of results |
| `sheetRead.ts` | `.xlsx` / `.xlsm` / `.csv` → grids of cell text |
| `sheetSpec.ts` | one sheet → a one-page spec, by label vocabulary |
| `pdfjs.ts` | this feature's own pdf.js worker setup and loader |
| `types.ts` | the spec format and result types |
| `spec.css` | every style this feature owns |

## What it is allowed to depend on

Four things, all **read-only** from this side. Changing any of them is the app's
call, not this feature's, and the boundary check enforces the list:

1. **npm packages** — `react`, `zustand`, `pdfjs-dist`, `jszip`.
2. **`src/flags.ts`** — read `flags.*` to hide a control. Adding a *new* flag
   touches `src/flags.ts` and `flag.env`, which are shared: ask for it rather
   than editing them in a zip.
3. **The design tokens** in `src/styles.css` — `--indigo`, `--border`,
   `--panel`, `--radius`, `--shadow` and the rest of `:root`.
4. **The shared component classes** — `.card`, `.btn`, `.slot`, `.tabs`,
   `.chip`, `.summary-chip`, `.empty-state`, `.upload-row`, `.spinner`,
   `.zoom-group`, `.overlay-legend`, `.pagestrip`, `.subtoolbar`. Use them;
   never redefine them here. Extending one with an owned modifier is fine —
   `.empty-state.sp-compact`, `.overlay-legend .dot.exp`.

`pdfjs.ts` duplicates about ten lines of `src/services/pdfCompare.ts`
deliberately: the feature used to import `loadPdf` from the comparison engine,
which put a shared file across the boundary. The duplication is the cheaper
mistake, and the comment in the file says so.

### CSS naming rule

Everything this feature defines is prefixed **`sp-`**, **`spec-`** or
**`target-`** (plus `.remap-note`). The prefix is what makes the boundary
checkable, and it is not decoration: `.pair-list` and `.pair-row` were in use by
Batch compare before this feature borrowed the same two names.

## On the spec machine

### First time

1. Download the repository zip from GitHub and unpack it.
2. `npm install`, then `npm run dev`.
3. **`git init && git add -A && git commit -m "baseline"`.** The zip is not a
   repository, so there is no history and no undo. This folder is about to
   become the only copy of real work: a local git, with no remote, still gives
   you a diff, a log and a way back. Commit before each refresh and after each
   session.

### Taking a newer app build

The app machine has pushed; you want its changes without losing yours:

```bash
sh scripts/update-from-zip.sh ~/Downloads/pdf-testing-suite-main.zip         # prints the plan
sh scripts/update-from-zip.sh ~/Downloads/pdf-testing-suite-main.zip --yes   # carries it out
```

It copies this folder to `.spec-backup/<timestamp>/` first, replaces everything
else from the zip, discards the zip's stale copy of this folder, and leaves your
`node_modules/`, `flag.env` and `.git/` alone. Files the app machine deleted
disappear here too, which is the point: a stale `.ts` that still compiles is the
hardest kind of leftover to spot.

Then:

```bash
npm install                      # if package.json changed
sh scripts/check-boundary.sh
npm run build
```

Keep a copy of `update-from-zip.sh` outside the working copy, in case a zip
predates it.

### Working

Change **only files under `src/features/spec/`**. If a change seems to need a
file outside it, that is a boundary question — write it down and raise it on the
app machine rather than reaching across, because an edit outside this folder is
lost at the next refresh.

`npm run build` and `sh scripts/check-boundary.sh` before you stop.

## On the app machine

Change nothing under `src/features/spec/`. The rest of the repository is yours;
push as normal.

If the app needs something *from* the feature, it has to come through
`index.ts` or `engine.ts`, and the spec machine has to be told — its copy of
those files is the real one, and a refresh will not bring your version of them
across.
