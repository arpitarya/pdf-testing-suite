// `pdfsuite compare` — run the app's comparison engine over every resolved pair and
// write reports.

import fs from 'node:fs';
import path from 'node:path';

import {
  comparePage,
  fileFromPath,
  loadPdf,
  summaryPageDiffers,
  type CompareSummary,
  type PageComparison,
} from '../platform/engine.js';
import { EXIT, ToolError } from '../core/exit.js';
import { formatPairTable, loadPairs, type ResolvedPair } from '../core/pairs.js';
import { writeHtmlReport } from '../report/html.js';
import {
  writeCsvReport,
  writeJsonReport,
  writeJUnitReport,
  writeMarkdownReport,
} from '../report/machine.js';
import type { PageVerdict, PairResult, RunContext } from '../report/types.js';

export interface CompareOptions {
  reference: string;
  candidate: string;
  pairs: string;
  report: string;
  format: string;
  pixelThreshold: number;
  includeAA: boolean;
  failOn: 'any' | 'none';
}

/** Round-trip-safe percentage for a message. */
const p2 = (v: number) => `${(v * 100).toFixed(2)}%`;

/**
 * A page fails if it differs at all.
 *
 * The verdict itself is the app's `summaryPageDiffers`, so the CLI and the app
 * cannot disagree about the same pair — which is the whole reason this tool
 * imports the engine instead of reimplementing it. What follows only puts the
 * differences into words for the JUnit output.
 */
function judge(
  page: CompareSummary['pages'][number],
  pair: ResolvedPair,
): PageVerdict {
  const pageNo = page.pageIndex + 1;
  const maxOffsetIn = page.maxOffset / page.pxPerInch;
  const skipped = pair.skipPages.includes(pageNo);
  const differs = summaryPageDiffers(page);

  const differences: string[] = [];
  if (!skipped && differs) {
    if (page.missing) {
      differences.push('page missing on one side');
    } else {
      if (page.contentMatch < 1) differences.push(`content match ${p2(page.contentMatch)}`);
      if (page.pixelRatio > 0) differences.push(`${p2(page.pixelRatio)} of pixels differ`);
      if (maxOffsetIn > 0) differences.push(`text shifted up to ${maxOffsetIn.toFixed(3)}"`);
    }
  }

  return {
    page: pageNo,
    pass: skipped || !differs,
    skipped,
    missing: page.missing,
    contentMatch: page.contentMatch,
    pixelRatio: page.pixelRatio,
    maxOffsetIn,
    differences,
  };
}

async function comparePair(pair: ResolvedPair, opts: CompareOptions): Promise<PairResult> {
  const started = Date.now();
  const empty: CompareSummary = { pages: [], pageCountA: 0, pageCountB: 0 };

  try {
    const [docA, docB] = await Promise.all([
      loadPdf(fileFromPath(pair.referencePath)),
      loadPdf(fileFromPath(pair.candidatePath)),
    ]);

    const pageCount = Math.max(docA.numPages, docB.numPages);
    const pageCache: Record<number, PageComparison> = {};
    const pages: CompareSummary['pages'] = [];

    for (let i = 0; i < pageCount; i++) {
      const pc = await comparePage(docA, docB, i, {
        pixelThreshold: opts.pixelThreshold,
        includeAA: opts.includeAA,
      });

      // Release the raw RGBA buffers as soon as the diff is computed — they are the
      // dominant memory cost across a large batch, and the report only needs the
      // already-encoded dataURLs.
      if (pc.imageA) pc.imageA.imageData = undefined;
      if (pc.imageB) pc.imageB.imageData = undefined;

      pageCache[i] = pc;
      pages.push({
        pageIndex: i,
        contentMatch: pc.contentMatch,
        pixelRatio: pc.pixel?.ratio ?? 0,
        maxOffset: pc.maxOffset,
        pxPerInch: pc.pxPerInch,
        missing: !pc.imageA || !pc.imageB,
      });
    }

    const summary: CompareSummary = {
      pages,
      pageCountA: docA.numPages,
      pageCountB: docB.numPages,
    };
    const pageVerdicts = pages.map((p) => judge(p, pair));

    return {
      pair,
      summary,
      pageCache,
      pageVerdicts,
      pass: pageVerdicts.every((v) => v.pass),
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      pair,
      summary: empty,
      pageCache: {},
      pageVerdicts: [],
      pass: false,
      durationMs: Date.now() - started,
      error: (err as Error).message,
    };
  }
}

export async function runCompare(opts: CompareOptions): Promise<number> {
  const resolution = loadPairs(opts.pairs, opts.reference, opts.candidate);

  console.log('Resolved pairing');
  console.log(formatPairTable(resolution));
  console.log('');

  // Unmatched or malformed entries are fatal. A missing candidate means generation
  // silently dropped a document — reporting on the rest would hide the real failure.
  if (resolution.problems.length > 0) {
    throw new ToolError(
      `${resolution.problems.length} pair(s) could not be resolved.`,
      'Every entry in pairs.json must name files that exist under --reference and --candidate.',
    );
  }
  if (resolution.pairs.length === 0) {
    throw new ToolError('No pairs to compare.');
  }

  const results: PairResult[] = [];
  for (let i = 0; i < resolution.pairs.length; i++) {
    const pair = resolution.pairs[i];
    process.stdout.write(`[${i + 1}/${resolution.pairs.length}] ${pair.id} … `);
    const result = await comparePair(pair, opts);
    results.push(result);

    if (result.error) {
      console.log(`ERROR — ${result.error}`);
    } else {
      const failed = result.pageVerdicts.filter((v) => !v.pass).length;
      console.log(
        `${result.pass ? 'PASS' : 'FAIL'} · ${result.summary.pages.length} pages` +
          `${failed ? `, ${failed} failing` : ''} · ${result.durationMs}ms`,
      );
    }
  }

  // ── reports ──
  fs.mkdirSync(opts.report, { recursive: true });
  const formats = new Set(opts.format.split(',').map((f) => f.trim().toLowerCase()).filter(Boolean));

  const ctx: RunContext = {
    generatedAt: new Date(),
    referenceDir: path.resolve(opts.reference),
    candidateDir: path.resolve(opts.candidate),
  };

  console.log('');
  const written: string[] = [];

  if (formats.has('html')) {
    // Carriage-return progress only makes sense on a terminal; in a CI log it produces
    // one concatenated line of noise.
    const tty = process.stdout.isTTY === true;
    process.stdout.write('Building visual HTML report … ');
    written.push(
      await writeHtmlReport(results, ctx, opts.report, (done, total) => {
        if (tty) process.stdout.write(`\rBuilding visual HTML report … ${done}/${total}`);
      }),
    );
    console.log(tty ? '' : 'done');
  }
  if (formats.has('json')) written.push(writeJsonReport(results, ctx, opts.report));
  if (formats.has('csv')) written.push(writeCsvReport(results, opts.report));
  if (formats.has('junit')) written.push(writeJUnitReport(results, ctx, opts.report));
  if (formats.has('md') || formats.has('markdown')) {
    written.push(writeMarkdownReport(results, ctx, opts.report));
  }

  for (const f of written) {
    const kb = (fs.statSync(f).size / 1024).toFixed(0);
    console.log(`  wrote ${f} (${kb} KB)`);
  }

  // ── verdict ──
  const passCount = results.filter((r) => r.pass).length;
  const hadError = results.some((r) => r.error);
  console.log('');
  console.log(`${passCount}/${results.length} pair(s) passed`);

  for (const r of results.filter((x) => !x.pass)) {
    const reason =
      r.error ??
      r.pageVerdicts
        .filter((v) => !v.pass)
        .map((v) => `page ${v.page}: ${v.differences.join(", ")}`)
        .join(' · ');
    console.log(`  ✗ ${r.pair.id} — ${reason}`);
  }

  if (hadError) return EXIT.TOOL_ERROR;
  if (opts.failOn === 'none') return EXIT.OK;
  return passCount === results.length ? EXIT.OK : EXIT.COMPARISON_FAILED;
}

/** `pdfsuite pairs` — resolve and print, run nothing. */
export function runPairs(opts: Pick<CompareOptions, 'reference' | 'candidate' | 'pairs'>): number {
  const resolution = loadPairs(opts.pairs, opts.reference, opts.candidate);
  console.log(formatPairTable(resolution));
  return resolution.problems.length > 0 ? EXIT.TOOL_ERROR : EXIT.OK;
}
