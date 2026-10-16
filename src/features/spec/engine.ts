/**
 * The spec-driven feature's headless surface.
 *
 * `index.ts` is the UI barrel: it pulls in React components and a stylesheet,
 * which a Node process cannot use. The CLI needs the checker and nothing else,
 * so it imports this file instead of reaching at a file inside the folder.
 *
 * Both barrels are the contract. Anything not exported from one of them is
 * internal and may be renamed or removed by whoever is working on this folder,
 * without warning to the rest of the repository.
 */

export { runSpec, validateSpec, loadPdf } from './specCheck';
export { sheetToSpec, parseLength, usableText } from './sheetSpec';
export { readSheetFile, readWorkbook, readCsv } from './sheetRead';
export { exportSpecJson, exportSpecHtml } from './specExport';

export type {
  PdfSpec, SpecPage, SpecElement, SpecUnit, SpecTolerance, SpecAnchor,
  TextSpec, ImageSpec, TableSpec, ParagraphSpec,
  SpecReport, SpecPageResult, ElementResult, CheckResult, Box,
} from './types';
export type { SheetConversion, ConversionNote } from './sheetSpec';
export type { Workbook, SheetGrid } from './sheetRead';
