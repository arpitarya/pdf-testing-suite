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

## 2026-10-16 — Excel-spec rulings → four records and four work items  ·  Cowork (Opus 5.5)

- **Asked:** *is anything still open? If not, create the records for what we talked about and file the work items.*
- **Done:** [SR-SPEC-INTAKE](../records/0101_SPEC-intake.md), [SR-SPEC-CHECK](../records/0102_SPEC-check.md), [SR-CONSTANTS](../records/0103_CONSTANTS.md), [SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md) — accepted, not built. W-02 rescoped to intake (🟡 on W-05); W-03 remove `cli-py/` (🟢), W-04 spec checker (🟡 on W-05), W-05 constants file (🟢). Register, Ownership (spec paths off W-01; `cli-py/` → W-03) and Describes tables; proposal graduated, open questions struck; BACKLOG B-008–B-012; glossary; registry; INTERVIEW; NOW; IMPLEMENTATION. Uncommitted — device shell unreachable.
- **Decided / left open:** Arpit, by voice, 2026-10-16: `.xlsx` + JSON only; literals only; hidden content skipped and listed (listed hidden sheet = warning); 100 MB raw / 500 MB unzipped; ranges are tolerance bands; normalised wording passes with a note; Pages List order — out of order or extra = warning, missing Required = error; Description column human-only; template v2 plus legacy; JSON is the only engine input, downloadable; one constants file; TypeScript only; remove `cli-py/`; uploader owns freshness; stale-pair, Draft/Ready and version diff to backlog. **Left open (inbox):** Python in dev-only scripts. **Interpretation to confirm:** a file or Pages List error stops the run; an element error excludes only that element.
- **Mistakes:** `cli-py/` could not be deleted from here (no device shell) — filed as W-03 instead.
- **Next:** W-05.

## 2026-10-16 — nested-layout Excel spec + PDFs (images, graphs, tables, text)  ·  Cowork (Opus 5.5)

- **Asked:** *analyse a sample spec workbook (first sheet lists every page, then one sheet per page) and create a sample Excel and a PDF with images, graphs, tables and text — use it only as a model.*
- **Done:** [`tools/samples/excel-spec-hierarchical/`](../tools/samples/excel-spec-hierarchical/README.md) — `report-spec.xlsx` (Pages List + sheets 1–4, nested merged-cell layout, prose values), `report.pdf` (4 landscape pages; 0.000 in off on 25 elements), `report-with-deviations.pdf` (12 deviations, 3 not detectable today), `assets/`, deterministic `generate.py`. Proposal gains *Observed spec-sheet conventions*, decision 10 widened, P1 gains the line-grouping fix, open question 4 answered. W-02 reference, IMPLEMENTATION, registry, INTERVIEW, NOW. Uncommitted — device shell unreachable.
- **Decided / left open:** all content invented; nothing from the reviewed workbook's wording is reproduced. `tools/samples/excel-spec/` was gone from the tree when this session looked — not recreated; references now point to the new sample.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit answers the inbox row; then W-02 P0.

## 2026-10-14 — sample Excel spec + PDFs for W-02  ·  Cowork (Opus 5.5)

- **Asked:** *create a sample Excel of two to three pages and create a PDF for the same.*
- **Done:** [`tools/samples/excel-spec/`](../tools/samples/excel-spec/README.md): `statement-spec.xlsx` (3 sheets = 3 pages; sections with dimensions; a grid shape and a prose shape), `statement.pdf` (matches — 0.000 in off on 23 elements, measured the app's pdf.js way), `statement-with-deviations.pdf` (9 deliberate deviations, expected findings tabled in the README), `generate.py` (one data definition → all three; deterministic). W-02 reference, IMPLEMENTATION, registry, INTERVIEW, NOW. Uncommitted — device shell unreachable.
- **Decided / left open:** placed under `tools/samples/` (where `tools/plan.md` puts worked examples), owned by W-01 like the rest of `tools/`. Standard PDF fonts, so the generator runs anywhere. Synthetic data does not answer the inbox ask for real samples.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit answers the inbox row; then W-02 P0.

## 2026-10-14 — Excel-as-spec: review, research, proposal, W-02  ·  Cowork (Opus 5.5)

- **Asked:** *review how spec driven comparison works today; research how it can be built out when PDF specs live in Excel (one sheet per page, sections, dimensions; Excel is the truth); write a proposal that becomes a record; create a work item with the diagram.*
- **Done:** [`work/proposals/excel-spec-comparison.md`](proposals/excel-spec-comparison.md) (record-shaped: today's state, 14 proposed decisions, phases P0–P6, alternatives, open questions, two diagrams with ASCII twins); [`W-02`](open/W-02-excel-spec-comparison.md) with the pipeline diagram; queue row + inbox ruling; proposals index; registry; glossary (workbook profile, spec coverage); INTERVIEW; NOW. Uncommitted — device shell unreachable; written onto whatever branch is checked out (PR #3's, per the entry below).
- **Decided / left open:** proposed an in-app, zero-dependency TypeScript xlsx reader (jszip already shipped) over the Python converter `tools/plan.md` §5 assumed — **for Siddharth or Arpit to rule**. The proposal went straight to W-02, so it has no `B-nnn` row ([SR-WORK-BACKLOG](../records/0052_WORK-backlog.md) rules 7, 23). Found: `tools/spec-from-excel.py` is referenced but absent; the upload is labelled "CSV spec" yet rejects CSV.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit answers the inbox row (samples + parser home); then W-02 P0.

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
