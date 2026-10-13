---
type: Handoff
description: "Cold-start state of play for a successor session: in-flight work, constraints, lessons."
---

# Model handoff — the agent-succession record

*The departing model answers for the record, so whatever succeeds it inherits
the judgment and not just the files.*

**Standing instruction to every future model reading this: you are now the
maintainer of this document. When the project's direction, decisions or state
change, update it in the same change. Leave it better.**

## How to use this file

A state-of-play doc, not an end-of-session report. Keep it current **during**
the session. Write it for a different model arriving with zero other context,
mid-task. The four sections below are maintained; anything after them is
history. **A stale INTERVIEW at handoff is as serious as a missing worklog
entry.**

---

## 1 · State of play

*Updated 2026-10-13.* The work system is set up on branch `work-system-setup`.
The product — a React/Vite PDF comparison app (`src/`), a Node CLI (`cli/`) and
a Python CLI (`cli-py/`) — predates it and has no records yet; W-01 owns every
product path until records claim them. **Ground it before you edit it** —
`git log`, the queue, the code.

*2026-10-14.* [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) maps the product
from the code — read it before W-01 to see where component boundaries fall.
Its **Watch** notes name known defects (app vs CLI verdict rules differ; Node
font rendering; scan races) that are **not yet backlog rows**.

## 2 · In flight, and the immediate next step

Nothing in flight. `docs/ARCHITECTURE.md` and its SVGs are committed on branch
`architecture-diagrams-records`, in PR #3 to `main`, stacked on PR #2 (merge #2
first). Next: Siddharth or Arpit reviews and merges both; installs
`scripts/sr-guard.sh` as the `commit-msg` hook; then W-01.

## 3 · Standing constraints

- The deciders are **Siddharth or Arpit — either one rules alone**, by default whoever
  is committing the change, or the one a blocker names
  ([SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) decision 11).
- The laws: L0 (records are the only source; links, never restatements), L1
  (retired records are archived). See `records/0001_LAWS.md`.
- The queue is the list; a blocker is a file; nothing closed is deleted.
- Tests are not yet in place (`BACKLOG.md` B-001–B-005); the hooks and the
  commit guard are the only mechanical enforcement.
- Until W-01 closes, every product commit stages `work/open/W-01-*.md` or says
  `no SR affected`.

## 4 · Lessons learned

- None yet. The first lesson goes here and in `LESSONS.md`.
