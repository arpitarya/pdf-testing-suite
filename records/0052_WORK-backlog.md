---
type: Standing Record
kind: process
name: SR-WORK-BACKLOG
title: "SR-WORK-BACKLOG (0052) — how BACKLOG.md works"
description: "The single list of named-but-unclaimed work, in five classes, each row a pointer to the source that names it."
status: accepted
date: 2026-10-13
feature: the backlog
owns: []
laws: [L0]
timestamp: 2026-10-13T12:51:43Z
content_sha: ""
---

# SR-WORK-BACKLOG — how BACKLOG.md works

## §1 — For humans

**`work/BACKLOG.md` lists what has been named and nobody is doing.** Each row
points at the record or proposal that names it and says what would close it.

**Its length is honesty, not workload.** The moment someone starts an item it
becomes a `W-nn` in the queue and its backlog row is deleted.

```mermaid
flowchart LR
    S["a record / proposal names it"] --> B["B-nnn row"]
    B -- somebody starts --> W["W-nn in OPEN-WORK"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
   a record / proposal names it ---> B-nnn row ---somebody starts---> W-nn in OPEN-WORK
```

</details>

## §2 — For agents

### Context

Outstanding work mentioned only inside records is invisible; mixed into the
queue it inflates the pending signal.

### The backlog discipline (normative)

1. `work/BACKLOG.md` is the single list of named-but-unclaimed work.
   Everything in it is stated somewhere else; nothing in it is being done.
2. It is an index of pointers, not a home. The source is the authority.
3. **Its length is not a signal** — it inverts the queue's rule 3. A longer
   backlog means more honest records. Never trim it to look better.
4. It carries no rule text.
5. It is not evidence and not a commitment.
6. Three sources only: a record naming something outstanding; every file in
   `work/proposals/`; an idea from a session that earns neither.
7. **An item is never in both `BACKLOG.md` and `OPEN-WORK.md`.** The queue
   wins; the moment it has a `W-nn`, its backlog row is gone.
8. A live fork with two implementations is a `compare/` doc, not a row.
9. A veto condition is not a backlog item. 10. A rejected alternative is not
   one; *deferred, not dismissed* is.
11. `B-nnn` ids, filing order, never reused.
12. **No detail file.** The source is the brief.
13. One line, ≤ 400 characters, no body.
14. A row is: id · the outstanding thing in the source's words · the source
    cited by name with a link and a location inside it · what would close it.
    The class is the group heading.
15. Every row cites a source that exists and a location inside it.
16. Every row names what would close it.
17–21. **Five classes, exhaustive:** `unbuilt` (ratified, not implemented) ·
    `ungated` (a rule nothing checks) · `unmeasured` (a default or claim with
    no measurement) · `unruled` (a fork not decided — **only Arpit and Siddharth close
    one**) · `cost` (a consequence accepted deliberately — **never
    graduates**; leaves when paid or when its decision reopens).
22. One class per row: what would have to happen first.
23. Promotion = opening a `W-nn` (file, row, ball) **and deleting the backlog
    row in the same change**.
24. Deleted, never ticked; nothing to archive, a row has no file.
25. Check what the row was the only home of before deleting it.
26. A row whose source is rewritten so the item no longer exists is deleted in
    that change.
27. A proposal's row follows its proposal: `graduated` and parked → stays,
    names the successor; `rejected` or gone → the row goes.
28. Grouped by class, then by source. No priority order here.
29. **A record that names something outstanding gets its backlog row in the
    same change.** The one obligation this record adds.
30. Nothing regenerates this file; *named as outstanding* is a judgment.
31. A law, then the queue, outrank this record.

### Consequences

- **Enforced today:** nothing — every rule here is judgment.
- Rule 7 (never in both files) is the one most worth a test once tests exist.

### Alternatives considered

- Keep the backlog inside the queue under a "later" heading — rejected: the
  queue's length would stop meaning *pending*.

### Reference (required)

- [`work/BACKLOG.md`](../work/BACKLOG.md) — the list this record governs.

### Veto condition

**Reopen this decision if:** an id appears in both `work/BACKLOG.md` and
`work/OPEN-WORK.md`, or a backlog row has a detail file.

**How to check it:** `grep -oE 'W-[0-9]+' work/BACKLOG.md | sort -u` against `ls work/open/`

---

## References

**Records** — [SR-WORK-OPEN-QUEUE](0051_WORK-open-queue.md) · [SR-WORK-LIFECYCLE](0053_WORK-lifecycle.md)

**Project docs**

- [`work/BACKLOG.md`](../work/BACKLOG.md) · [`work/proposals/README.md`](../work/proposals/README.md)
