---
type: Log
description: "What shipped, when, and how it turned out — the evidence store the queue reconciles against."
---

# IMPLEMENTATION — what has landed

A row is earned by **landing**, never by being planned. The queue reconciles
against this file before an item may be closed
([SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rule 9). Newest first.

| date | item | what landed | outcome | evidence |
|---|---|---|---|---|
| 2026-10-14 | — | `docs/architecture/`: 18 standalone SVGs, one per diagram in `docs/ARCHITECTURE.md`, linked under each | landed — PR #3 (branch `architecture-diagrams-records`) | the files; plain SVG text (no foreignObject), white background; spot-checked 01, 05, 10 as images |
| 2026-10-14 | — | `docs/ARCHITECTURE.md`: 18 Mermaid diagrams — app shell, flags, engine, every tab, every CLI command, app-vs-CLI verdict rules, planned work | landed — PR #3 (branch `architecture-diagrams-records`) | the file; all 18 diagrams render (mermaid 10.9.1) |
| 2026-10-13 | — | the work system: records 0001–0003, 0051–0060; `work/`; `archive/`; hooks; the commit guard | set up | the setup commit |
