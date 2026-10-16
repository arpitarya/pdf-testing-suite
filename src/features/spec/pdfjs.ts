/**
 * pdf.js setup for the spec-driven feature.
 *
 * This duplicates about ten lines of `src/services/pdfCompare.ts` on purpose.
 * The feature used to import `loadPdf` from there, which meant a change to the
 * comparison engine could break the spec tab, and the two are worked on from
 * different machines (see `README.md`). Ten duplicated lines are a far smaller
 * cost than a shared file across that boundary.
 *
 * Assigning `workerSrc` twice is harmless: both modules resolve the same asset
 * URL, so whichever loads first wins and the value is identical.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const buffer = await file.arrayBuffer();
  // Copy — getDocument transfers/detaches the original buffer.
  const data = new Uint8Array(buffer.slice(0));
  return pdfjsLib.getDocument({ data }).promise;
}
