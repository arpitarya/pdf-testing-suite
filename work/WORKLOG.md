---
type: Log
description: "Append-only per-session trail, date-grouped, newest first."
---

# WORKLOG — the append-only session log

Every session appends **one entry before it ends** — a chat-only session
counts. **Never edit a past entry; append only, newest on top.** A wrong old
entry is corrected by a new one. Distinct from `INTERVIEW.md`, which is the
*current* state of play. Rules: [SR-WORK-SESSION](../records/0054_WORK-session.md).

**Entry format:**

```
## YYYY-MM-DD — <one-line title>  ·  <surface> (<model>)

- **Asked:** *<the ask>*
- **Done:** <what landed, with commit shas where they exist>
- **Decided / left open:** <rulings taken in-session; forks put to Siddharth and Arpit>
- **Mistakes:** <what went wrong and what was done about it, or "none">
- **Next:** <the single next step>
```

---

## 2026-10-15 — group ignore operations and data regions in Side by side  ·  Claude Code (Opus 5)

- **Asked:** *implement group operations on the changes list and data regions; then: the data-region button labels are ambiguous, rename them.*
- **Done:** uncommitted. `src/store/regionStore.ts` and `src/components/compare/DataRegionLayer.tsx` added; the Changes drawer gained row tick-boxes (shift-click spans, paired halves tick as one), a select bar (All on page / per type) and one shared reason for the batch; regions partition a page's changes into tested vs not-assessed ahead of ignores, filter the Layout heat map too, persist per golden PDF in `localStorage`, and get a "Data regions — not assessed" section in the HTML report and the ZIP bundle. Labels reworded to state the action: `Add data region` / `Drag over the area…` / `Save region`. `tsc -b && vite build` clean.
- **Decided / left open:** a region is classified *not assessed*, a separate channel from an ignore, and is keyed to the golden PDF's name as a stand-in for the template. "Ignore all on this page" is All-on-page then Ignore-selected, so the count is seen before committing. **Left open:** neither this feature stream nor its predecessors has an OPEN-WORK item or a record — it predates the work system and is still W-01 territory.
- **Mistakes:** the session's `UserPromptSubmit` hook appended "A blocker is open" while `work/BLOCKED.json` said `PROCEED`; the file was read and the claim not repeated.
- **Then asked:** *the data-region button and popup are ambiguous — rename along the lines of expected/ignored region, and list them in the Ignored tab.*
- **Then done:** the feature speaks one vocabulary: `Ignore a region` / `Ignore region` / `Stop ignoring this region`, chip "2 ignored regions · 7 changes", default label `Ignored region`. The Ignored tab now has two groups — Regions (page, label, how many changes it covers, Undo) and Differences — and its badge counts both. Report sections are "Ignored regions, excluded from this report" and "Ignored differences, …". Code comments and the CSS banner follow.
- **Then asked:** *in the Ignored tab, list the changes inside an ignored region behind an expand button.*
- **Then done:** the per-region count line became the disclosure — "4 changes ignored — show" with a rotating caret — and opening it lists each change with its type chip and text, indented under the region. The counts memo now collects the changes themselves (`regionOf` per change over every compared page) rather than a tally; expanded state is dropped when a region is undone. Honest about incomplete data: a page not yet compared reads "No changes inside this area so far" and offers no disclosure.
- **Then asked:** *in spec driven comparison: upload an Excel workbook, pick a sheet on the left and the PDF page to compare it to on the right.*
- **Then done:** `src/services/sheetRead.ts` reads `.xlsx`/`.xlsm`/`.csv` in the browser (JSZip + DOMParser — no spreadsheet dependency added; shared strings, inline strings, sparse columns and skipped rows all handled), `src/services/sheetSpec.ts` converts one sheet to a one-page spec by **label vocabulary rather than column position**, detecting a column layout or a block layout. Two pairing lists in `SpecTestView.tsx` (sheet → PDF page) drive the existing single-page override; the check re-runs on either choice. A conversion panel lists every skip. `docs/ARCHITECTURE.md` no longer says a workbook is rejected.
- **Caught in test, both would have shipped as false failures:** a placeholder-only wording cell left a note saying the position was still checked and then dropped the element; and `usableText` joined the literal halves around a merge field, so "Dear <<FirstName>>, your statement" asserted "Dear , your statement" — a string no generated PDF contains. Now the longest literal fragment wins, with a 4-character minimum. Sheet metadata rows ("Page size") were also being warned about as elements missing a measurement.
- **Left open:** the reviewable `extraction.json` seam in `tools/plan.md` §3.1 is not built — this is the single-pass converter, and a defeated tab is corrected in the exported JSON rather than in a persisted middle artifact. The Python converter named in that plan is still absent from this tree.
- **Then asked:** *separate the compare and spec-driven code so there is no overlap — spec-driven is developed on an office laptop that can read the spec files but cannot push, and only downloads zips.*
- **Then done:** the whole feature moved to `src/features/spec/` (13 files, `git mv` where tracked so history follows): view, export menu, store, checker, exporter, both sheet modules, types, its own `spec.css`, its own `pdfjs.ts`, and two barrels — `index.ts` for the app, `engine.ts` for the CLI. 172 lines of spec CSS lifted out of `src/styles.css`. `scripts/check-boundary.sh` enforces five rules and was tested by breaking each one. `src/features/spec/README.md` holds the contract, the dependency allow-list and the zip protocol in both directions; CLAUDE.md and ARCHITECTURE.md point at it.
- **Caught while splitting:** the new sheet-to-page panes had taken `.pair-list` and `.pair-row`, which Batch compare already owned — everything the feature defines is now prefixed `sp-`, which is also what makes the boundary checkable. And `cli/verify/spec-target.ts` imported `src/services/specCheck`, so the move broke the CLI; it now imports the headless barrel. CLI verify:spec 8/8, verify:regression clean.
- **Decided:** `pdfjs.ts` duplicates ~10 lines of `pdfCompare.ts` on purpose rather than keep one shared file across the boundary. `src/flags.ts` and the design tokens stay shared but **read-only** from the spec side; adding a new flag needs the app side.
- **The one case this cannot absorb:** if both machines change the folder between zips, replacement throws one side away. The README says to decide which side wins before unzipping, and to check `git log -- src/features/spec` first.
- **Corrected by Siddharth:** the handoff is **one way**, not a folder zip coming back. This machine pushes to GitHub; the office machine downloads a zip, works on `src/features/spec/` only, and cannot send anything out. So the copy of that folder in this repository is a **stale mirror** and must not be edited here.
- **Then done:** `scripts/update-from-zip.sh` — run on the office machine, it backs the feature up to `.spec-backup/<stamp>/`, replaces everything else from the zip, discards the zip's stale copy of the folder, and preserves `node_modules`, `flag.env` and `.git`. Files deleted upstream disappear locally too. README, CLAUDE.md and ARCHITECTURE.md rewritten for the real direction, including the stale-mirror rule and a `git init` baseline on the office machine, since a zip has no history and that folder becomes the only copy of real work.
- **Caught in test, on Windows:** the script moved `scripts/` aside before wiping, which fails with Permission denied because Git Bash holds a lock on the running file. It now re-execs from a temp copy. Verified on a throwaway clone: office work survived untouched, the zip's stale copy did not leak in, a new upstream file arrived, a file deleted upstream was removed locally, `node_modules`/`flag.env` kept, backup written.
- **Raised, not solved:** nothing backs up the office copy off that machine. The local git baseline and `.spec-backup/` are the only safety net available while files cannot leave it.
- **Next:** file the compare-tab feature stream as an OPEN-WORK item (or fold it into W-01) and commit it.

---

## 2026-10-14 — architecture docs committed and PR opened  ·  Claude Code (Opus 5.5)

- **Asked:** *check out a new branch for architecture diagrams and records; then: commit everything and create a PR.*
- **Done:** branch `architecture-diagrams-records` cut from `work-system-setup`; committed the two Cowork sessions' work below (read first; SVGs checked for scripts — none) with W-01's item file staged for the guard, which was run by hand since it is not installed; pushed to the fork; opened PR #3 to `sid4861:main` (https://github.com/sid4861/pdf-testing-suite/pull/3). INTERVIEW, NOW and IMPLEMENTATION no longer say "uncommitted".
- **Decided / left open:** the PR stacks on PR #2 (its first four commits are #2's) — merge #2 first. The Watch notes stay unfiled, as before.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit reviews and merges PR #2 then this one; install the `commit-msg` hook; then W-01.

## 2026-10-14 — standalone SVG per architecture diagram  ·  Cowork (Opus 5.5)

- **Asked:** *create individual SVGs for the architecture MD that can be viewed individually.*
- **Done:** `docs/architecture/01-…18-*.svg`, rendered from the Mermaid blocks in `docs/ARCHITECTURE.md` (mermaid 10.9.1, neutral theme, plain SVG text, white background, titled); an "Open as SVG" link under each diagram. Ownership row (W-01), registry row, W-01 DoD 4, IMPLEMENTATION, INTERVIEW, NOW. Still uncommitted — device shell unreachable.
- **Decided / left open:** the Mermaid blocks stay the source; the SVGs are rendered copies, re-rendered when a block changes (registry trigger). No render script added to the repo — left open.
- **Mistakes:** none.
- **Next:** commit `docs/` with the bookkeeping (stage `work/open/W-01-claim-components.md`); then W-01.

## 2026-10-14 — architecture diagrams added to the repo  ·  Cowork (Opus 5.5)

- **Asked:** *create architectural diagrams — high level for the UI, then detailed for each tab and the CLI commands; then: put the document in the repo.*
- **Done:** `docs/ARCHITECTURE.md` (18 Mermaid diagrams, drawn from the code; all render). Bookkeeping: Ownership row (W-01), registry row + bumps, W-01 DoD 4, IMPLEMENTATION, GLOSSARY (golden PDF, candidate, letterbox), INTERVIEW, NOW, a pointer line in `README.md`. **`CLAUDE.md` changed:** one pointer row in the state-of-play table and the `docs/` layout line (SR-WORK-DOCS decision 7a). Nothing committed — the device shell was unreachable, so no `git status` or commit was possible.
- **Decided / left open:** Markdown, not the HTML artifact, so GitHub renders it and there is one copy (L0). The doc's **Watch** notes (app vs CLI verdict thresholds differ; Node standard-font rendering; scan races; spec units; Commander exit code) are not filed as backlog rows — left to Siddharth or Arpit.
- **Mistakes:** none.
- **Next:** commit the change (stage `work/open/W-01-claim-components.md` for the guard); then W-01.

## 2026-10-13 — deciders are Siddharth OR Arpit, not both  ·  Claude Code (Opus 5.5)

- **Asked:** *it is not both — it is Siddharth or Arpit, based on who is committing the change, or whoever a block is called out on.*
- **Done:** all live wording now reads "Siddharth or Arpit" (inbox heading `## Blocked on Siddharth or Arpit`); [SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) gains decision 11 (either rules alone; default is the committer; a named blocker binds to that person); [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) gains rule 58 (inbox `who` column); INTERVIEW and the glossary updated; PR #2 description corrected. W-01's quote and the archive record now attribute the setup instructions to Arpit, who gave them.
- **Decided / left open:** the two entries below say "jointly"/"Siddharth and Arpit" — superseded by this one. The PR was opened from the fork `arpitarya/pdf-testing-suite` (https://github.com/sid4861/pdf-testing-suite/pull/2), so the "push access" next step below is done.
- **Mistakes:** I read "decider name would be arpit and siddharth" as a joint ruling; it means either one.
- **Next:** Siddharth or Arpit reviews and merges PR #2; then W-01.

## 2026-10-13 — decider name order changed  ·  Claude Code (Opus 5.5)

- **Asked:** *wherever it says Arpit and Siddharth it should say Siddharth and Arpit.*
- **Done:** every live file now reads "Siddharth and Arpit" (and "Siddharth or Arpit"), including the inbox heading `## Blocked on Siddharth and Arpit`. Commits `7619a37` and `f661947` are local only — the push was refused (`arpitarya` has read-only access to `sid4861/pdf-testing-suite`).
- **Decided / left open:** the entry below keeps its original wording (worklog is append-only); this entry corrects it. How to get the PR up (write access vs a fork) is open.
- **Mistakes:** none.
- **Next:** get push access or approve a fork, then push and open the PR.

## 2026-10-13 — the work system set up from WORK-SYSTEM.md  ·  Claude Code (Opus 5.5)

- **Asked:** *check out main, branch, and set up the work process from WORK-SYSTEM.md; deciders Arpit and Siddharth; records cover everything in the repo; do not archive anything.*
- **Done:** branch `work-system-setup`; records 0001–0003 and 0051–0060; `work/`; `docs/GLOSSARY.md`; empty `archive/`; `scripts/`; `.claude/` hooks and `settings.json`; `CLAUDE.md` (new — none existed).
- **Decided / left open:** decider is "Arpit and Siddharth" (two humans, their ruling); every tracked product path owned by W-01 until records claim it; WORK-SYSTEM.md was **not** added to the repo nor archived (ruling: archive nothing — the records are now the only home of its rules); tests deferred as B-001–B-005; template citations for B-003/B-004 corrected to real locations.
- **Mistakes:** none.
- **Next:** Arpit or Siddharth installs the commit-msg guard and commits the setup; then W-01.
