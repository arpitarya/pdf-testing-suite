---
type: Standing Record
kind: process
name: SR-WORK-REGISTRY
title: "SR-WORK-REGISTRY (0060) — the doc registry"
description: "Every maintained document has an update trigger and a last-verified date, in the table in §3 of this record."
status: accepted
date: 2026-10-13
feature: the doc registry
owns: []
laws: [L0]
timestamp: 2026-10-13T12:51:43Z
content_sha: ""
---

# SR-WORK-REGISTRY — the doc registry

## §1 — For humans

**Every maintained document has a row here** saying what event must update it
and when it was last checked. A task that fires a trigger updates the document
and bumps its row together.

```mermaid
flowchart LR
    T["task fires a trigger"] --> D["document updated"]
    D --> R["§3 row bumped"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
   task fires trigger ---> document updated ---> §3 row bumped
```

</details>

## §2 — For agents

### Context

A doc with no stated trigger is updated by nobody; a doc with no verified date
cannot be told apart from a stale one.

### The registry discipline (normative)

1. The registry is §3 of this record — a table, no other file.
2. Every maintained document has an **update trigger** and a **last verified**
   date; a task that fires a trigger updates the document *and* bumps its row
   in the same change.
3. A row is `| Document | Update trigger | Last verified | Notes |`.
4. Live documents only; an archived document loses its row in the same change.
5. No row points into `archive/`. 6. Every row's target exists. 7. One row
   per document. 8. A new maintained document gets its row in the same change.
9. A row older than about thirty days is a review prompt, not a failure.
10. At task end, scan the trigger column.

### Consequences

- **Enforced today:** nothing — decisions 5–8 are backlog row B-003.

### Alternatives considered

- A separate `DOCS-REGISTRY.md` file — rejected: a second file is a second
  thing to keep in step with the rules.

### Reference (required)

- §3 below.

### Veto condition

**Reopen this decision if:** a row in §3 names a file that does not exist.

**How to check it:** `grep -oE '^\| \`[^\`]+\`' records/0060_WORK-registry.md | tr -d '|\` ' | xargs ls`

---

## §3 — The registry

| Document | Update trigger | Last verified | Notes |
|---|---|---|---|
| `CLAUDE.md` | any rule or pointer changes | 2026-10-13 | 2026-10-13 — created at setup |
| `work/README.md` | a file is added to or removed from `work/` | 2026-10-13 | 2026-10-13 — created at setup |
| `work/OPEN-WORK.md` | the same change as the work it tracks | 2026-10-13 | 2026-10-13 — created at setup |
| `work/BACKLOG.md` | a record names something nobody is doing | 2026-10-13 | 2026-10-13 — created at setup |
| `work/open/README.md` | the item-file contract changes | 2026-10-13 | 2026-10-13 — created at setup |
| `work/INTERVIEW.md` | direction, a decision or the live state changes — during the session | 2026-10-13 | 2026-10-13 — created at setup |
| `work/IMPLEMENTATION.md` | something lands | 2026-10-13 | 2026-10-13 — created at setup |
| `work/LESSONS.md` | a failure teaches something durable | 2026-10-13 | 2026-10-13 — created at setup |
| `work/MACHINE.md` | a surface breaks in a way the code did not cause | 2026-10-13 | 2026-10-13 — created at setup |
| `work/compare/README.md` | a fork opens, closes, or its trigger fires | 2026-10-13 | 2026-10-13 — created at setup |
| `work/proposals/README.md` | an idea is filed, graduates, or is rejected | 2026-10-13 | 2026-10-13 — created at setup |
| `docs/GLOSSARY.md` | a term is coined or redefined | 2026-10-13 | 2026-10-13 — created at setup |
| `records/README.md` | a record's state, ownership or number changes | 2026-10-13 | 2026-10-13 — created at setup |
| `records/TEMPLATE.md` | the convention changes | 2026-10-13 | 2026-10-13 — created at setup |

(`WORKLOG.md`, `NOW.md`, `BLOCKED.json` and `archive/README.md` carry no row:
the first is append-only, the next two are overwritten every session, the last
is a map of frozen things.)

---

## References

**Records** — [SR-WORK-DOCS](0055_WORK-docs.md) · [SR-WORK-GOVERNANCE](0059_WORK-governance.md)
