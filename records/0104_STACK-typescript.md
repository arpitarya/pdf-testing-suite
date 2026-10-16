---
type: Standing Record
kind: process
name: SR-STACK-TYPESCRIPT
title: "SR-STACK-TYPESCRIPT (0104) — the product is TypeScript"
description: "The app, the CLI, the engine and the spec pipeline are TypeScript; the Python CLI is removed; Python in development-only scripts awaits a ruling."
status: accepted
date: 2026-10-16
feature: the product's language
owns: []
laws: [L0]
timestamp: 2026-10-16T11:30:00+05:30
content_sha: ""
ratifies: W-03
---

# SR-STACK-TYPESCRIPT — the product is TypeScript

## §1 — For humans

**One language for the whole product.** The React app, the comparison engine, the spec
pipeline and the `pdfsuite` CLI are TypeScript. The Python CLI (`cli-py/`) is removed: the
Node CLI already does everything it did.

```mermaid
flowchart LR
  E["Engine · src/services"] --> A["App · React"]
  E --> C["CLI · cli/ (Node)"]
  P["cli-py/ (Python)"] -.->|"removed by W-03"| X["—"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  engine (TS) --> app (TS)
             \--> CLI (TS, Node)
  cli-py (Python)  ..removed by W-03..
```

</details>

---

## §2 — For agents

### Context

`cli-py/` holds a Python `generate` (a full port of the Node one) and `compare`/`pairs`
commands that run the Node CLI. The two `generate` implementations already differ, in
proxy support, timeout meaning and header handling. Two implementations of one thing
drift.

### Decision

1. **The product is TypeScript:** `src/` (app and engine), `cli/` (the Node CLI) and the spec
   pipeline (SR-SPEC-INTAKE). No Python in the product.
2. **`cli-py/` is removed**, with every live reference to it. The Node CLI is the only CLI.
3. **New product code is TypeScript.**
4. **Development-only scripts that are not shipped are outside this record until Arpit or
   Siddharth rules on them** (the inbox row in `work/OPEN-WORK.md`). Today they are the
   fixture generators in `tools/samples/` and `cli/verify/make-cases.py`.

### Consequences

- **Built today:** decision 1 for `src/` and `cli/`. **W-03** removes `cli-py/`.
- **Debt:** nothing checks decision 1 — backlog **B-012**.
- Python users of `pip install pdfsuite` lose that entry point; the Node CLI replaces it.

### Alternatives considered

| option | why it lost |
|---|---|
| Keep `cli-py/` as a thin wrapper | it is not thin — its `generate` is a second implementation that has already drifted |
| Port the Node CLI to Python | doubles the engine; the engine is TypeScript and shared with the app |

### Reference (required)

- [`cli-py/src/pdfsuite/generate.py`](../cli-py/src/pdfsuite/generate.py) and [`cli/src/commands/generate.ts`](../cli/src/commands/generate.ts) — the two implementations
- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §Python wrapper

### Veto condition

**Reopen this decision if:** a Python file appears under a product path.

**How to check it:** `git ls-files 'src/*.py' 'src/**/*.py' 'cli/src/**/*.py' 'cli-py/**'` returns nothing (after W-03)

---

## References

**Records** — [SR-SPEC-INTAKE](0101_SPEC-intake.md) · [SR-CONSTANTS](0103_CONSTANTS.md)

**Code**

- [`cli/src/index.ts`](../cli/src/index.ts) · [`cli/src/platform/engine.ts`](../cli/src/platform/engine.ts)

**Project docs**

- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
