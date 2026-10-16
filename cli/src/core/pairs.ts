// Explicit pairing via pairs.json.
//
// Paths inside the file are ALWAYS relative to --reference / --candidate. Never absolute,
// never relative to the pairs file, never cwd-dependent — so the same pairs.json works on
// a laptop and on a CI agent with a different workspace path.

import fs from 'node:fs';
import path from 'node:path';

import { ToolError } from './exit.js';

interface RawPair {
  id?: string;
  name?: string;
  reference?: string;
  candidate?: string;
  skipPages?: number[];
  /** Accepted and ignored; see `notes` in PairResolution. */
  thresholds?: unknown;
}

interface RawPairsFile {
  pairs?: RawPair[];
  /** Accepted and ignored. */
  defaults?: unknown;
}

export interface ResolvedPair {
  id: string;
  name: string;
  referencePath: string;
  candidatePath: string;
  referenceRel: string;
  candidateRel: string;
  /** 1-based page numbers excluded from the verdict. */
  skipPages: number[];
}

export interface PairResolution {
  pairs: ResolvedPair[];
  /** Entries that named a file which does not exist — always fatal. */
  problems: string[];
  /** Not fatal, but the reader has to know — e.g. settings being ignored. */
  notes: string[];
}

export function loadPairs(
  pairsFile: string,
  referenceDir: string,
  candidateDir: string,
): PairResolution {
  if (!fs.existsSync(pairsFile)) throw new ToolError(`Pairs file not found: ${pairsFile}`);
  if (!fs.existsSync(referenceDir)) throw new ToolError(`Reference directory not found: ${referenceDir}`);
  if (!fs.existsSync(candidateDir)) throw new ToolError(`Candidate directory not found: ${candidateDir}`);

  let parsed: RawPairsFile;
  try {
    parsed = JSON.parse(fs.readFileSync(pairsFile, 'utf8')) as RawPairsFile;
  } catch (err) {
    throw new ToolError(`Could not parse ${pairsFile}: ${(err as Error).message}`);
  }

  const rawPairs = parsed.pairs;
  if (!Array.isArray(rawPairs) || rawPairs.length === 0) {
    throw new ToolError(
      `${pairsFile} declares no pairs.`,
      'Comparing nothing and exiting 0 is the failure this tool exists to prevent.',
    );
  }

  const pairs: ResolvedPair[] = [];
  const problems: string[] = [];
  const notes: string[] = [];
  const seenIds = new Set<string>();

  // A pairs.json written for an older version still carries tolerances. Saying
  // nothing would leave someone believing a tolerance is in force when every
  // difference is now reported.
  const tuned = rawPairs.filter((p) => p.thresholds != null).length;
  if (parsed.defaults != null || tuned > 0) {
    notes.push(
      'thresholds in this file are ignored — a page now fails if it differs at all.',
    );
  }

  rawPairs.forEach((raw, i) => {
    const where = `pairs[${i}]`;

    if (!raw.id) {
      problems.push(`${where}: missing "id" (required — it keys JUnit history and asset paths)`);
      return;
    }
    if (seenIds.has(raw.id)) {
      problems.push(`${where}: duplicate id "${raw.id}"`);
      return;
    }
    seenIds.add(raw.id);

    if (!raw.reference || !raw.candidate) {
      problems.push(`${where} (${raw.id}): needs both "reference" and "candidate"`);
      return;
    }
    if (path.isAbsolute(raw.reference) || path.isAbsolute(raw.candidate)) {
      problems.push(
        `${where} (${raw.id}): paths must be relative to --reference/--candidate, not absolute`,
      );
      return;
    }

    const referencePath = path.resolve(referenceDir, raw.reference);
    const candidatePath = path.resolve(candidateDir, raw.candidate);

    // Unmatched entries are fatal, not warnings. A missing candidate means generation
    // silently dropped a document — precisely the regression worth catching.
    if (!fs.existsSync(referencePath)) {
      problems.push(`${where} (${raw.id}): reference not found — ${raw.reference}`);
      return;
    }
    if (!fs.existsSync(candidatePath)) {
      problems.push(`${where} (${raw.id}): candidate not found — ${raw.candidate}`);
      return;
    }

    pairs.push({
      id: raw.id,
      name: raw.name ?? raw.id,
      referencePath,
      candidatePath,
      referenceRel: raw.reference,
      candidateRel: raw.candidate,
      skipPages: raw.skipPages ?? [],
    });
  });

  return { pairs, problems, notes };
}

/** Human-readable pairing table — the answer to "why did it compare those two?". */
export function formatPairTable(res: PairResolution): string {
  const lines: string[] = [];
  for (const p of res.pairs) {
    const skip = p.skipPages.length ? `\n      skip pages ${p.skipPages.join(',')}` : '';
    lines.push(`  ✓ ${p.id.padEnd(20)} ${p.referenceRel}  ←  ${p.candidateRel}${skip}`);
  }
  for (const problem of res.problems) lines.push(`  ✗ ${problem}`);
  for (const note of res.notes) lines.push(`  ! ${note}`);
  lines.push('');
  lines.push(`  ${res.pairs.length} pair(s) resolved · ${res.problems.length} problem(s)`);
  return lines.join('\n');
}
