import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { PdfSpec, SpecReport } from './types';
import { loadPdf, runSpec, validateSpec } from './specCheck';
import type { Workbook } from './sheetRead';
import { sheetToSpec, type ConversionNote } from './sheetSpec';

interface SpecState {
  pdfDoc: PDFDocumentProxy | null;
  pdfName: string | null;
  pdfPageCount: number;
  loadingPdf: boolean;
  errorPdf: string | null;

  spec: PdfSpec | null;
  specName: string | null;
  errorSpec: string | null;

  /**
   * An uploaded spec workbook, when the spec came from a sheet rather than from
   * JSON. The sheets are kept as read so switching tabs is instant and the
   * conversion can be re-run without touching the file again.
   */
  workbook: Workbook | null;
  loadingWorkbook: boolean;
  /** The sheet currently converted into `spec`. */
  activeSheet: string | null;
  /** What the conversion could not do, for the sheet in `activeSheet`. */
  sheetNotes: ConversionNote[];
  /** Elements converted / blocks skipped, for the sheet in `activeSheet`. */
  sheetStats: { converted: number; skipped: number } | null;

  report: SpecReport | null;
  running: boolean;
  progress: { current: number; total: number } | null;
  currentPage: number; // 0-based index into report.pages / spec.pages

  loadingExample: boolean;

  /**
   * 'all'    — check every page the spec declares, at the page it declares.
   * 'single' — check ONE spec page against ONE chosen PDF page.
   *
   * A spec exported from a single sheet always says `"page": 1`, but the page it
   * describes may sit anywhere in a long document. 'single' lets it be pointed at
   * the right place without editing the spec.
   */
  mode: 'all' | 'single';
  /** 1-based PDF page to check in 'single' mode. */
  targetPdfPage: number;
  /** 1-based position in spec.pages to use in 'single' mode. */
  targetSpecPage: number;

  setMode: (m: 'all' | 'single') => void;
  setTargetPdfPage: (n: number) => void;
  setTargetSpecPage: (n: number) => void;

  loadPdfFile: (file: File) => Promise<void>;
  loadSpecFile: (file: File) => Promise<void>;
  selectSheet: (name: string) => void;
  clearWorkbook: () => void;
  loadSpecText: (text: string, name: string) => void;
  clearPdf: () => void;
  clearSpec: () => void;
  run: () => Promise<void>;
  setPage: (i: number) => void;
  loadExample: () => Promise<void>;
}

export const useSpecStore = create<SpecState>((set, get) => ({
  pdfDoc: null,
  pdfName: null,
  pdfPageCount: 0,
  loadingPdf: false,
  errorPdf: null,

  spec: null,
  specName: null,
  errorSpec: null,

  workbook: null,
  loadingWorkbook: false,
  activeSheet: null,
  sheetNotes: [],
  sheetStats: null,

  report: null,
  running: false,
  progress: null,
  currentPage: 0,

  loadingExample: false,

  mode: 'all',
  targetPdfPage: 1,
  targetSpecPage: 1,

  setMode(m) {
    // Changing what gets checked invalidates the previous result.
    set({ mode: m, report: null, currentPage: 0 });
  },
  setTargetPdfPage(n) {
    const max = Math.max(1, get().pdfPageCount);
    set({ targetPdfPage: Math.min(Math.max(1, n), max), report: null, currentPage: 0 });
  },
  setTargetSpecPage(n) {
    const max = Math.max(1, get().spec?.pages.length ?? 1);
    set({ targetSpecPage: Math.min(Math.max(1, n), max), report: null, currentPage: 0 });
  },

  async loadPdfFile(file) {
    set({ loadingPdf: true, errorPdf: null });
    try {
      const doc = await loadPdf(file);
      set({ pdfDoc: doc, pdfName: file.name, pdfPageCount: doc.numPages, loadingPdf: false, report: null, currentPage: 0, targetPdfPage: 1 });
    } catch (err) {
      set({ loadingPdf: false, errorPdf: err instanceof Error ? err.message : 'Failed to read PDF' });
    }
  },

  async loadSpecFile(file) {
    // A workbook or a sheet is read and converted here; JSON goes straight in.
    if (/\.(csv|xlsx|xlsm)$/i.test(file.name)) {
      set({ loadingWorkbook: true, errorSpec: null });
      try {
        const { readSheetFile } = await import('./sheetRead');
        const wb = await readSheetFile(file);
        set({
          workbook: wb,
          loadingWorkbook: false,
          spec: null,
          specName: null,
          activeSheet: null,
          sheetNotes: [],
          sheetStats: null,
          report: null,
          currentPage: 0,
          // A sheet describes one page, pointed at one page of the PDF.
          mode: 'single',
          targetSpecPage: 1,
        });
        // One sheet is no choice at all, so make it.
        if (wb.sheets.length === 1) get().selectSheet(wb.sheets[0].name);
      } catch (err) {
        set({
          loadingWorkbook: false,
          errorSpec: err instanceof Error ? err.message : 'Failed to read the workbook',
        });
      }
      return;
    }

    try {
      const text = await file.text();
      get().loadSpecText(text, file.name);
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Failed to read spec file' });
    }
  },

  selectSheet(name) {
    const wb = get().workbook;
    const grid = wb?.sheets.find((sh) => sh.name === name);
    if (!grid) return;
    const out = sheetToSpec(grid);
    set({
      spec: out.spec,
      specName: `${wb!.name} · ${name}`,
      activeSheet: name,
      sheetNotes: out.notes,
      sheetStats: { converted: out.converted, skipped: out.skipped },
      errorSpec: null,
      report: null,
      currentPage: 0,
      mode: 'single',
      targetSpecPage: 1,
    });
  },

  clearWorkbook() {
    set({
      workbook: null,
      activeSheet: null,
      sheetNotes: [],
      sheetStats: null,
      spec: null,
      specName: null,
      errorSpec: null,
      report: null,
      currentPage: 0,
    });
  },

  loadSpecText(text, name) {
    try {
      const parsed = validateSpec(JSON.parse(text));
      set({
        spec: parsed, specName: name, errorSpec: null, report: null, currentPage: 0, targetSpecPage: 1,
        workbook: null, activeSheet: null, sheetNotes: [], sheetStats: null,
      });
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Invalid spec JSON' });
    }
  },

  clearPdf() {
    set({ pdfDoc: null, pdfName: null, pdfPageCount: 0, errorPdf: null, report: null, currentPage: 0 });
  },
  clearSpec() {
    set({
      spec: null, specName: null, errorSpec: null, report: null, currentPage: 0,
      workbook: null, activeSheet: null, sheetNotes: [], sheetStats: null,
    });
  },

  async run() {
    const { pdfDoc, spec, mode, targetPdfPage, targetSpecPage } = get();
    if (!pdfDoc || !spec || get().running) return;

    const single = mode === 'single';
    set({ running: true, progress: { current: 0, total: single ? 1 : spec.pages.length } });
    try {
      const report = await runSpec(pdfDoc, spec, {
        onProgress: (current, total) => set({ progress: { current, total } }),
        specPageIndex: single ? targetSpecPage : undefined,
        pdfPageOverride: single ? targetPdfPage : undefined,
      });
      set({ report, running: false, progress: null, currentPage: 0 });
    } catch (err) {
      set({ running: false, progress: null, errorSpec: err instanceof Error ? err.message : 'Check failed' });
    }
  },

  setPage(i) {
    const total = get().report?.pages.length ?? 0;
    set({ currentPage: Math.max(0, Math.min(i, Math.max(0, total - 1))) });
  },

  async loadExample() {
    set({ loadingExample: true });
    try {
      const base = import.meta.env.BASE_URL;
      const [pdfRes, specRes] = await Promise.all([
        fetch(`${base}samples/spec-sample.pdf`),
        fetch(`${base}samples/spec-sample.json`),
      ]);
      if (!pdfRes.ok || !specRes.ok) throw new Error('Could not fetch the bundled spec example.');
      const pdfBlob = await pdfRes.blob();
      const specText = await specRes.text();
      await get().loadPdfFile(new File([pdfBlob], 'spec-sample.pdf', { type: 'application/pdf' }));
      get().loadSpecText(specText, 'spec-sample.json');
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Failed to load example' });
    } finally {
      set({ loadingExample: false });
    }
  },
}));
