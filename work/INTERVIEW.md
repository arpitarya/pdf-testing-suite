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

## 2 · In flight, and the immediate next step

Nothing in flight. Next: Arpit or Siddharth installs `scripts/sr-guard.sh` as the
`commit-msg` hook; then W-01 (claim components with records).

## 3 · Standing constraints

- The deciders are **Arpit and Siddharth** — rulings are theirs jointly.
- The laws: L0 (records are the only source; links, never restatements), L1
  (retired records are archived). See `records/0001_LAWS.md`.
- The queue is the list; a blocker is a file; nothing closed is deleted.
- Tests are not yet in place (`BACKLOG.md` B-001–B-005); the hooks and the
  commit guard are the only mechanical enforcement.
- Until W-01 closes, every product commit stages `work/open/W-01-*.md` or says
  `no SR affected`.

## 4 · Lessons learned

- None yet. The first lesson goes here and in `LESSONS.md`.
