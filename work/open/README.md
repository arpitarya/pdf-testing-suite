---
type: Index
description: "Index of the open work items, one detail file each."
---

# `work/open/` — one file per open work item

[`../OPEN-WORK.md`](../OPEN-WORK.md) is an **index**: one line per item. The
detail lives here, one file per `W-nn`, named `W-nn-slug.md`.

**Contract**

1. An item's file is created in the same change that opens the item, and its
   row is added to `OPEN-WORK.md` in that same change. The row is one or two
   lines; every other word lives here. The row opens with its ball.
2. **When an item closes its row is deleted and its file MOVES to
   [`archive/open/`](../../archive/open/), in the same change — never
   deleted.** [SR-WORK-OPEN-QUEUE](../../records/0051_WORK-open-queue.md)
   rules 8–12 and 53–57.
3. A file carries only what a builder needs to start: goal, definition of
   done, blockers, the record it will update (or *no SR affected*), hazards,
   and the **model** that should execute it. Anything longer belongs in a
   record, a compare doc or a proposal, and is linked.
4. A `research` item's file says `**Model:** Cowork` and its row's lane is
   `cowork` (rule 37a).
5. This file is the spec as well as the state. There is no second document.

**Naming.** `W-nn` ids are never reused; the first is `W-01`.

**The file's shape:**

```markdown
---
type: Handoff
name: W-nn
description: "<one sentence: who asked, when, for what>"
item: W-nn
filed: YYYY-MM-DD
ball: agent | human | cowork
---

# W-nn — <title>

**Siddharth and Arpit, YYYY-MM-DD:** *"<the ask, in their words>"*

**Model:** <Opus | Sonnet | Haiku | Cowork | NONE — who, and why>: <one sentence why>.

## Goal

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · … | … | ⏳ |

## Blockers

## Record affected

<SR-NAME decision n> — or **no SR affected**.

## Hazards

## Reference
```
