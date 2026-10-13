---
type: Standing Record
kind: law
name: SR-LAW-1
title: "SR-LAW-1 (0003) — L1, a retired record is archived, never deleted"
description: "A record whose subject is retired is moved to archive/records/ in the same change, mapped, bannered, and from then on named but never cited."
status: accepted
date: 2026-10-13
feature: retiring a record
owns: []
laws: [L0, L1]
timestamp: 2026-10-13T12:51:43Z
content_sha: ""
---

# SR-LAW-1 — L1, a retired record is archived, never deleted

## §1 — For humans

**A retired record is moved, not deleted.** It goes to `archive/records/`, gets
a banner and a row in the archive map, and keeps its history findable.

**Retired is not superseded.** A superseded record is rewritten in place; only
a record whose subject is gone is archived.

```mermaid
flowchart LR
    R["records/NNNN_x.md"] -- retired --> A["archive/records/NNNN_x.md"]
    A --> M["archive/README.md row"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
   records/NNNN_x.md --retired--> archive/records/NNNN_x.md ---> archive/README.md row
```

</details>

## §2 — For agents

### Context

A deleted record takes its reasoning with it; a record left in `records/` after
retirement keeps being cited as if live.

### Decision

1. When a record's subject, rule or law is retired, the record is **moved** to
   `archive/records/`, mirroring its path, **in the same change** — with a row
   in `archive/README.md`, `status: archived`, and a top banner
   `ARCHIVED <date> — retired by <ruling>`.
2. An archived record may be **named, never cited** as grounding for a live
   claim.
3. A **superseded** record is different: it is rewritten or deleted in the
   change that supersedes it, and the successor says in prose what it replaced.
4. A retired law is written `ex-L<n>` in live text; its handle is never reused.

### Consequences

Nothing checks this mechanically today; it is judgment until a test exists.

### Alternatives considered

- Delete retired records and rely on git history — rejected: history is not
  browsed, and the reasoning would be lost to every future session.

### Reference (required)

- [`archive/README.md`](../archive/README.md) — the map retired records join.

### Veto condition

**Reopen this decision if:** `archive/records/` holds a file without an
`archive/README.md` row, or `records/` holds a `status: archived` file.

**How to check it:** `ls archive/records/; grep -l "status: archived" records/*.md`

---

## References

**Records** — [SR-LAW-0](0002_LAW-0-authority.md) · [SR-WORK-ARCHIVE](0057_WORK-archive.md)

**Project docs**

- [`archive/README.md`](../archive/README.md)
