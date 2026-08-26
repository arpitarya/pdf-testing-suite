// ZIP bundle export: every report format plus the annotated PDFs, in one file.
//
// The annotated PDFs are the *original* documents with comment pins stamped on,
// not screenshots — pdf.js hands back the bytes it parsed, pdf-lib writes on top
// of them. Each pin is drawn visibly AND added as a real PDF text annotation, so
// the comments show up in Acrobat's review panel rather than only as ink.

import JSZip from 'jszip';
import { PDFDocument, PDFName, PDFString, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { CompareSummary, CompareSide, PageComparison } from '../types/compare';
import {
  buildCsvReport,
  buildHtmlReport,
  buildJsonReport,
  download,
  judgePage,
  stamp,
  type ExportMeta,
  type ExportThresholds,
} from './exportReport';
import { buildMarkdownReport } from './exportMarkdown';
import { bySidePage, type Annotation, type NumberedAnnotation } from '../store/annotationStore';

export interface ZipSource {
  summary: CompareSummary;
  meta: ExportMeta;
  thresholds: ExportThresholds;
  pageCache: Record<number, PageComparison>;
  annotations: Annotation[];
  /** Live pdf.js documents, used to recover the original bytes. */
  docA: PDFDocumentProxy | null;
  docB: PDFDocumentProxy | null;
}

export type ZipProgress = (step: string, done: number, total: number) => void;

const PIN_R = 9;
const PIN_FILL = rgb(0.86, 0.15, 0.15);
const PIN_TEXT = rgb(1, 1, 1);

/** Filesystem-safe version of a PDF filename, without its extension. */
function safeStem(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'document';
}

/**
 * Draws one pin and attaches a matching PDF text annotation.
 *
 * Annotation coordinates are stored as a fraction of the rendered page with the
 * origin top-left; PDF user space has its origin bottom-left, hence the flip.
 */
function stampPin(pdfDoc: PDFDocument, page: PDFPage, font: PDFFont, a: NumberedAnnotation) {
  const { width, height } = page.getSize();
  const cx = a.x * width;
  const cy = height - a.y * height;

  page.drawCircle({ x: cx, y: cy, size: PIN_R, color: PIN_FILL, opacity: 0.92 });

  const label = String(a.number);
  const size = 9;
  page.drawText(label, {
    x: cx - font.widthOfTextAtSize(label, size) / 2,
    y: cy - size / 3,
    size,
    font,
    color: PIN_TEXT,
  });

  // A real /Text annotation, so PDF readers list the comment instead of the
  // reviewer having to spot a red dot.
  const annot = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Name: 'Comment',
    Rect: [cx - PIN_R, cy - PIN_R, cx + PIN_R, cy + PIN_R],
    Contents: PDFString.of(a.text || '(no text)'),
    T: PDFString.of(a.author || 'Reviewer'),
    Subj: PDFString.of(`Comment ${a.number}`),
    C: [1, 0.25, 0.25],
    F: 4, // print
  });
  const ref = pdfDoc.context.register(annot);
  const existing = page.node.lookup(PDFName.of('Annots'));
  if (existing && 'push' in existing) (existing as { push: (r: unknown) => void }).push(ref);
  else page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));
}

/** Appends a plain summary page listing every comment, for printed review. */
function addIndexPage(pdfDoc: PDFDocument, font: PDFFont, bold: PDFFont, byPage: Map<number, NumberedAnnotation[]>, title: string) {
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let y = height - 56;

  const line = (text: string, opts: { size?: number; font?: PDFFont; indent?: number } = {}) => {
    const size = opts.size ?? 10;
    if (y < 56) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      y = height - 56;
    }
    page.drawText(text, {
      x: 48 + (opts.indent ?? 0),
      y,
      size,
      font: opts.font ?? font,
      color: rgb(0.12, 0.14, 0.18),
      maxWidth: width - 96 - (opts.indent ?? 0),
    });
    y -= size + 6;
  };

  line('Review comments', { size: 18, font: bold });
  line(title, { size: 10 });
  y -= 8;

  const pages = [...byPage.keys()].sort((a, b) => a - b);
  for (const p of pages) {
    y -= 6;
    line(`Page ${p + 1}`, { size: 12, font: bold });
    for (const a of byPage.get(p)!) {
      const who = a.author ? ` — ${a.author}` : '';
      line(`${a.number}. ${a.text || '(no text)'}${who}`, { indent: 14 });
    }
  }
}

/** Original bytes + stamped comments for one side. Null when that side has no doc. */
async function annotatePdf(
  doc: PDFDocumentProxy | null,
  annotations: Annotation[],
  side: CompareSide,
  title: string,
): Promise<Uint8Array | null> {
  if (!doc) return null;
  const byPage = bySidePage(annotations, side);
  const bytes = await doc.getData();

  // ignoreEncryption: reading already succeeded in pdf.js, so refusing here
  // would only lose the reviewer their comments.
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const [pageIndex, list] of byPage) {
    const page = pages[pageIndex];
    if (!page) continue; // comment on a page this side does not have
    for (const a of list) stampPin(pdfDoc, page, font, a);
  }

  if (byPage.size > 0) addIndexPage(pdfDoc, font, bold, byPage, title);

  return pdfDoc.save();
}

/** Comments as their own file, so they are readable without opening a PDF. */
function annotationsMarkdown(annotations: Annotation[], meta: ExportMeta): string {
  const out: string[] = ['# Review comments', ''];
  out.push(`- **Golden PDF**: \`${meta.nameA}\``);
  out.push(`- **PDF under test**: \`${meta.nameB}\``);
  out.push(`- **Comments**: ${annotations.length}`);
  out.push('');

  if (annotations.length === 0) {
    out.push('_No comments were added._');
    return out.join('\n');
  }

  for (const side of ['A', 'B'] as CompareSide[]) {
    const byPage = bySidePage(annotations, side);
    if (byPage.size === 0) continue;
    out.push(`## ${side === 'A' ? 'Golden PDF' : 'PDF under test'}`);
    out.push('');
    for (const p of [...byPage.keys()].sort((a, b) => a - b)) {
      out.push(`### Page ${p + 1}`);
      out.push('');
      out.push('| # | Comment | Position (x, y) | Author |');
      out.push('|---|---|---|---|');
      for (const a of byPage.get(p)!) {
        const pos = `${(a.x * 100).toFixed(1)}%, ${(a.y * 100).toFixed(1)}%`;
        out.push(`| ${a.number} | ${(a.text || '(no text)').replace(/\|/g, '\\|')} | ${pos} | ${a.author || '—'} |`);
      }
      out.push('');
    }
  }
  return out.join('\n');
}

function manifest(src: ZipSource, files: string[]) {
  const passCount = src.summary.pages.filter((p) => judgePage(p, src.thresholds)).length;
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      goldenPdf: src.meta.nameA,
      pdfUnderTest: src.meta.nameB,
      thresholds: src.thresholds,
      overall: passCount === src.summary.pages.length ? 'PASS' : 'FAIL',
      pagesCompared: src.summary.pages.length,
      pagesPassing: passCount,
      commentCount: src.annotations.length,
      files,
    },
    null,
    2,
  );
}

export async function exportZipBundle(src: ZipSource, onProgress?: ZipProgress) {
  const { summary, meta, thresholds, pageCache, annotations } = src;
  const zip = new JSZip();
  const reports = zip.folder('reports')!;
  const pdfs = zip.folder('annotated-pdfs')!;

  const steps = 6;
  let done = 0;
  const tick = (step: string) => onProgress?.(step, ++done, steps);

  onProgress?.('Building HTML report', 0, steps);
  reports.file('comparison-report.html', await buildHtmlReport(summary, meta, thresholds, pageCache));
  tick('HTML report');

  reports.file('remediation.md', buildMarkdownReport(summary, meta, thresholds, pageCache));
  tick('Markdown fix-list');

  reports.file('comparison.json', buildJsonReport(summary, meta, thresholds));
  reports.file('comparison.csv', buildCsvReport(summary, thresholds));
  tick('JSON + CSV');

  reports.file('comments.md', annotationsMarkdown(annotations, meta));
  tick('Comments');

  const goldenStem = safeStem(meta.nameA);
  const testStem = safeStem(meta.nameB);

  const a = await annotatePdf(src.docA, annotations, 'A', `Golden PDF — ${meta.nameA}`);
  if (a) pdfs.file(`${goldenStem}-annotated.pdf`, a);
  tick('Annotated golden PDF');

  const b = await annotatePdf(src.docB, annotations, 'B', `PDF under test — ${meta.nameB}`);
  if (b) pdfs.file(`${testStem}-annotated.pdf`, b);
  tick('Annotated PDF under test');

  const names: string[] = [];
  zip.forEach((path, f) => {
    if (!f.dir) names.push(path);
  });
  zip.file('manifest.json', manifest(src, names.sort()));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  download(`pdf-comparison-bundle-${stamp()}.zip`, blob, 'application/zip');
}
