/**
 * Turning one spec sheet into a spec page.
 *
 * The tabs of a real spec workbook share no fixed layout, so nothing here reads
 * "column C is the measurement". What is stable across authors is the
 * *vocabulary*: everyone writes "Font size" somewhere, even when they put it in
 * a different cell. So every cell in an element's block is scanned for a known
 * property label and the value taken from wherever it sits — the cell to the
 * right, or the cell below.
 *
 * Two layouts cover most sheets and are detected rather than assumed:
 *
 *   column — a header row naming the properties, one element per row after it
 *   block  — an element heading, then label/value rows beneath it
 *
 * What cannot be converted is **reported, never guessed**: a colour, a
 * conditional rule, a wording cell that is entirely placeholders. A spec that
 * silently invents a number is worse than one that says it skipped a row, so
 * every skip comes back as a note for the reader.
 *
 * This is deliberately a first pass over a semi-structured document — see
 * `tools/plan.md` for the reviewable-extraction design it does not yet have.
 */

import type { PdfSpec, SpecElement, SpecPage, SpecUnit } from './types';
import type { SheetGrid } from './sheetRead';

export interface ConversionNote {
  severity: 'warn' | 'info';
  /** Where in the sheet, for a reader holding the workbook open. */
  where: string;
  message: string;
}

export interface SheetConversion {
  sheet: string;
  spec: PdfSpec;
  notes: ConversionNote[];
  /** Elements that made it into the spec. */
  converted: number;
  /** Element blocks found but not convertible. */
  skipped: number;
}

// ── vocabulary ────────────────────────────────────────────────────────

type Prop =
  | 'type' | 'label' | 'text' | 'top' | 'left' | 'width' | 'height'
  | 'fontSize' | 'lineSpacing' | 'rows' | 'columns' | 'match';

/** Canonical property → the labels authors actually write. Order matters: the
 *  longest match wins, so "font size" is not read as "font". */
const LABELS: [Prop, string[]][] = [
  ['fontSize', ['font size', 'fontsize', 'type size', 'point size', 'pt size']],
  ['lineSpacing', ['line spacing', 'linespacing', 'leading', 'line height', 'baseline spacing']],
  ['top', ['top edge', 'from top', 'top position', 'vertical position', 'top', 'y position', 'y']],
  ['left', ['left edge', 'from left', 'left position', 'horizontal position', 'left', 'x position', 'x']],
  ['width', ['width', 'w']],
  ['height', ['height', 'h']],
  ['rows', ['rows', 'row count', 'number of rows']],
  ['columns', ['columns', 'cols', 'column count', 'number of columns']],
  ['text', ['text', 'wording', 'copy', 'content', 'string', 'value']],
  ['label', ['element', 'field', 'component', 'item', 'name', 'description']],
  ['type', ['type', 'kind', 'element type']],
  ['match', ['match', 'matching', 'match type']],
];

/** Recorded as a note rather than asserted — the sheet is describing a rule. */
const CONDITIONAL_PHRASES = [
  'only displayed', 'only shown', 'only appears', 'if applicable', 'where applicable',
  'conditional', 'optional', 'if present', 'when present', 'may not appear',
  'depending on', 'prospect documents', 'client documents',
];

/**
 * Rows that describe the sheet rather than an element on the page. They are
 * skipped silently: the author has not forgotten a measurement, so warning
 * about one would be noise in the only place a real gap is reported.
 */
const METADATA = [
  'page size', 'paper size', 'page width', 'page height', 'orientation', 'units', 'unit',
  'document', 'template', 'template name', 'version', 'date', 'author', 'owner',
  'revision', 'notes', 'comments', 'sheet', 'tab',
];

/** Properties the checker has no way to verify from a PDF's text layer. */
const UNCHECKABLE = [
  'colour', 'color', 'background', 'bg', 'opacity', 'shading', 'fill', 'border colour',
  'border color', 'rgb', 'cmyk', 'hex', 'pantone', 'alignment', 'align', 'tracking',
  'kerning', 'case', 'style guide',
];

const norm = (s: string) => s.toLowerCase().replace(/[:\-–—]+$/g, '').replace(/\s+/g, ' ').trim();

/** The property a cell is labelling, or null. */
function labelOf(cell: string): Prop | null {
  const n = norm(cell);
  if (!n || n.length > 40) return null;
  for (const [prop, aliases] of LABELS) {
    for (const a of aliases) {
      if (n === a || n === `${a}s` || n.startsWith(`${a} (`) || n === `${a} in inches`) return prop;
    }
  }
  return null;
}

function isMetadata(cell: string): boolean {
  const n = norm(cell);
  return !!n && METADATA.some((m) => n === m || n.startsWith(`${m} `));
}

function unconvertible(cell: string): string | null {
  const n = norm(cell);
  if (!n) return null;
  return UNCHECKABLE.find((u) => n === u || n.startsWith(`${u} `)) ?? null;
}

function conditionalIn(text: string): string | null {
  const n = text.toLowerCase();
  return CONDITIONAL_PHRASES.find((p) => n.includes(p)) ?? null;
}

// ── units ─────────────────────────────────────────────────────────────

/**
 * A measurement in the spec's own unit.
 *
 * Handles what authors write: `2.125`, `2 1/8"`, `2-1/8 in`, `54 mm`, `13 pt`,
 * `1/2"`. A bare number is read as the sheet's unit, which is how the cells are
 * meant. Returns null rather than 0 when nothing numeric is there — a missing
 * measurement must not become a confident zero.
 */
export function parseLength(raw: string, unit: SpecUnit): number | null {
  const s = raw.toLowerCase().replace(/[, ]/g, ' ').trim();
  if (!s) return null;

  const mixed = s.match(/^(\d+)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)/);
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  const plain = s.match(/^-?\d*\.?\d+/);

  let value: number | null = null;
  if (mixed) value = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  else if (frac) value = Number(frac[1]) / Number(frac[2]);
  else if (plain) value = Number(plain[0]);
  if (value == null || !Number.isFinite(value)) return null;

  // An explicit unit in the cell wins over the sheet's default.
  const inUnit: SpecUnit = /mm\b|millimet/.test(s)
    ? 'mm'
    : /\bpt\b|point/.test(s)
      ? 'pt'
      : /"|''|\bin\b|inch/.test(s)
        ? 'in'
        : unit;

  if (inUnit === unit) return value;
  const toIn = inUnit === 'mm' ? value / 25.4 : inUnit === 'pt' ? value / 72 : value;
  return unit === 'mm' ? toIn * 25.4 : unit === 'pt' ? toIn * 72 : toIn;
}

/** Font size is always points, whatever the sheet's unit is. */
function parsePoints(raw: string): number | null {
  const m = raw.match(/-?\d*\.?\d+/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function parseCount(raw: string): number | null {
  const m = raw.match(/\d+/);
  if (!m) return null;
  const v = Number(m[0]);
  return v > 0 ? v : null;
}

/**
 * The part of a wording cell that can actually be asserted.
 *
 * `<<FirstName>>` and `[AMOUNT]` are merge fields: the generated PDF holds a
 * value, not the placeholder. So the cell is cut at every placeholder and the
 * **longest surviving fragment** is used — never the fragments joined up.
 * "Dear <<FirstName>>, your statement" must look for "your statement", because
 * "Dear , your statement" appears in no PDF ever generated and would fail every
 * time while looking like a real defect.
 *
 * A fragment shorter than the minimum identifies nothing on a page, so a cell
 * that is all placeholders yields no text assertion at all.
 */
const MIN_FRAGMENT = 4;

export function usableText(raw: string): string | null {
  const fragments = raw
    .replace(/<<[^>]*>>/g, '\u0000')
    .replace(/\{\{[^}]*\}\}/g, '\u0000')
    .replace(/\[[A-Z0-9_ ]{2,}\]/g, '\u0000')
    .split('\u0000')
    // Punctuation and whitespace left against a cut identify nothing.
    .map((f) => f.replace(/\s+/g, ' ').replace(/^[\s.,;:!?\-–—/|)\]]+/, '').replace(/[\s.,;:\-–—/|(\[]+$/, ''))
    .filter((f) => f.length >= MIN_FRAGMENT && /[a-z0-9]/i.test(f));

  if (fragments.length === 0) return null;
  return fragments.reduce((a, b) => (b.length > a.length ? b : a));
}

const slug = (s: string, i: number) =>
  `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'element'}-${i + 1}`;

// ── a gathered element, before it becomes a SpecElement ───────────────

interface Draft {
  where: string;
  heading: string;
  props: Partial<Record<Prop, string>>;
}

/** Build a SpecElement, or say why not. */
function toElement(
  d: Draft,
  i: number,
  unit: SpecUnit,
  notes: ConversionNote[],
): SpecElement | null {
  const label = d.props.label || d.heading || `Element ${i + 1}`;
  const top = d.props.top != null ? parseLength(d.props.top, unit) : null;
  const left = d.props.left != null ? parseLength(d.props.left, unit) : null;
  const width = d.props.width != null ? parseLength(d.props.width, unit) : null;
  const height = d.props.height != null ? parseLength(d.props.height, unit) : null;
  const fontSize = d.props.fontSize != null ? parsePoints(d.props.fontSize) : null;
  const spacing = d.props.lineSpacing != null ? parseLength(d.props.lineSpacing, unit) : null;
  const rows = d.props.rows != null ? parseCount(d.props.rows) : null;
  const columns = d.props.columns != null ? parseCount(d.props.columns) : null;
  const text = d.props.text ? usableText(d.props.text) : null;
  const match = /exact/i.test(d.props.match ?? '') ? 'exact' : undefined;

  const conditional = conditionalIn([d.heading, d.props.text ?? '', d.props.label ?? ''].join(' '));
  if (conditional) {
    notes.push({
      severity: 'info',
      where: d.where,
      message: `"${label}" is conditional ("${conditional}") — checked anyway; a NOT FOUND here may be correct.`,
    });
  }

  if (top == null || left == null) {
    const missing = [top == null ? 'top' : null, left == null ? 'left' : null].filter(Boolean);
    notes.push({
      severity: 'warn',
      where: d.where,
      message: `"${label}" skipped — no ${missing.join(' or ')} measurement found. Add it to the sheet, or edit the exported JSON.`,
    });
    return null;
  }

  const base = { id: slug(label, i), label, top, left } as const;

  // A merge-field-only wording cell leaves a text element with nothing to look
  // for, since text is what locates it on the page. An image or a table is
  // found by geometry, so for those the same cell costs nothing.
  const placeholdersOnly = !!d.props.text && !text;

  // Declared type first, then what the properties imply.
  const declared = norm(d.props.type ?? '');
  const kind =
    /image|logo|graphic|picture/.test(declared) ? 'image'
      : /table|grid/.test(declared) ? 'table'
        : /paragraph|body|prose/.test(declared) ? 'paragraph'
          : /text|label|heading|title/.test(declared) ? 'text'
            : rows != null || columns != null || /table|grid/.test(norm(d.heading)) ? 'table'
              : spacing != null ? 'paragraph'
                : width != null && height != null && !text ? 'image'
                  : 'text';

  if (placeholdersOnly && (kind === 'image' || kind === 'table')) {
    notes.push({
      severity: 'info',
      where: d.where,
      message: `"${label}" — the wording is all merge fields, which this element does not need; position and size are checked.`,
    });
  }

  if (kind === 'image') {
    if (width == null || height == null) {
      notes.push({
        severity: 'warn',
        where: d.where,
        message: `"${label}" looks like an image but has no ${width == null ? 'width' : 'height'} — skipped.`,
      });
      return null;
    }
    return { ...base, type: 'image', width, height };
  }

  if (kind === 'table') {
    if (width == null) {
      notes.push({
        severity: 'warn',
        where: d.where,
        message: `"${label}" looks like a table but has no width — skipped.`,
      });
      return null;
    }
    return {
      ...base, type: 'table', width,
      ...(rows != null ? { rows } : {}),
      ...(columns != null ? { columns } : {}),
    };
  }

  if (!text) {
    notes.push({
      severity: 'warn',
      where: d.where,
      message: placeholdersOnly
        ? `"${label}" skipped — its wording is all merge fields (<<…>>), so there is no text to search for. Give it a fixed label, or check it as an image or table with a width.`
        : `"${label}" skipped — a text element needs wording to look for.`,
    });
    return null;
  }

  if (kind === 'paragraph') {
    if (spacing == null) {
      notes.push({
        severity: 'warn',
        where: d.where,
        message: `"${label}" looks like a paragraph but has no line spacing — skipped.`,
      });
      return null;
    }
    return { ...base, type: 'paragraph', text, lineSpacing: spacing, ...(match ? { match } : {}) };
  }

  return {
    ...base, type: 'text', text,
    ...(match ? { match } : {}),
    ...(fontSize != null ? { fontSize } : {}),
  };
}

// ── layout detection ──────────────────────────────────────────────────

const nonEmpty = (r: string[]) => r.filter((c) => c);

/** A row naming two or more properties is a column header. */
function findHeaderRow(rows: string[][]): { at: number; cols: Map<number, Prop> } | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const cols = new Map<number, Prop>();
    rows[i].forEach((cell, j) => {
      const p = labelOf(cell);
      if (p && ![...cols.values()].includes(p)) cols.set(j, p);
    });
    const props = [...cols.values()];
    const positional = props.includes('top') || props.includes('left');
    if (cols.size >= 3 && positional) return { at: i, cols };
  }
  return null;
}

function draftsFromColumns(
  rows: string[][],
  header: { at: number; cols: Map<number, Prop> },
  notes: ConversionNote[],
): Draft[] {
  const drafts: Draft[] = [];
  for (let i = header.at + 1; i < rows.length; i++) {
    const row = rows[i];
    if (nonEmpty(row).length === 0) continue;

    const props: Draft['props'] = {};
    for (const [col, prop] of header.cols) {
      const v = row[col];
      if (v) props[prop] = v;
    }
    // Cells under an unrecognised column still deserve a mention.
    row.forEach((cell, j) => {
      if (header.cols.has(j) || !cell) return;
      const u = unconvertible(rows[header.at][j] ?? '');
      if (u) {
        notes.push({
          severity: 'info',
          where: `Row ${i + 1}`,
          message: `"${rows[header.at][j]}" (${u}) is not checkable from a PDF's text — ignored.`,
        });
      }
    });

    if (Object.keys(props).length === 0) continue;
    if (isMetadata(props.label ?? '')) continue;
    drafts.push({ where: `Row ${i + 1}`, heading: props.label ?? '', props });
  }
  return drafts;
}

/** A heading row: one lone cell that is not itself a property label. */
function isHeading(row: string[]): boolean {
  const cells = nonEmpty(row);
  if (cells.length !== 1) return false;
  const text = cells[0];
  return text.length <= 80 && !labelOf(text) && !unconvertible(text);
}

/** A two-cell metadata row, e.g. "Page size | 8.5 x 11", belongs to no block. */
function isMetadataRow(row: string[]): boolean {
  const cells = nonEmpty(row);
  return cells.length <= 2 && cells.length > 0 && isMetadata(cells[0]);
}

function draftsFromBlocks(rows: string[][], notes: ConversionNote[]): Draft[] {
  const drafts: Draft[] = [];
  let cur: Draft | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (nonEmpty(row).length === 0) continue;
    if (isMetadataRow(row)) continue;

    if (isHeading(row)) {
      if (cur && Object.keys(cur.props).length) drafts.push(cur);
      // A metadata heading opens no block, so its rows are not collected.
      cur = isMetadata(nonEmpty(row)[0])
        ? null
        : { where: `Row ${i + 1}`, heading: nonEmpty(row)[0], props: {} };
      continue;
    }
    if (!cur) cur = { where: `Row ${i + 1}`, heading: '', props: {} };

    // Scan the whole row: a label takes its value from the next non-empty cell
    // to its right, or from the cell directly below it.
    for (let j = 0; j < row.length; j++) {
      const prop = labelOf(row[j]);
      if (!prop) {
        const u = unconvertible(row[j]);
        if (u) {
          notes.push({
            severity: 'info',
            where: `Row ${i + 1}`,
            message: `"${row[j]}" (${u}) is not checkable from a PDF's text — ignored.`,
          });
        }
        continue;
      }
      let value = '';
      for (let k = j + 1; k < row.length; k++) {
        if (row[k]) { value = row[k]; break; }
      }
      if (!value) value = rows[i + 1]?.[j] ?? '';
      if (value && cur.props[prop] == null) cur.props[prop] = value;
    }
  }
  if (cur && Object.keys(cur.props).length) drafts.push(cur);
  return drafts;
}

// ── page size ─────────────────────────────────────────────────────────

/** US Letter, portrait — the overwhelmingly common case for these documents. */
const DEFAULT_PAGE = { width: 8.5, height: 11 };

function pageSizeFrom(rows: string[][], unit: SpecUnit): { width: number; height: number } {
  let w: number | null = null;
  let h: number | null = null;
  let landscape = false;

  for (const row of rows) {
    for (let j = 0; j < row.length; j++) {
      const n = norm(row[j]);
      const next = row.slice(j + 1).find((c) => c) ?? '';
      if (/^page (width|size w)/.test(n)) w = parseLength(next, unit) ?? w;
      if (/^page height/.test(n)) h = parseLength(next, unit) ?? h;
      if (/landscape/.test(n) || /landscape/.test(norm(next))) landscape = true;
      if (/^(page size|paper size|page)$/.test(n)) {
        const pair = next.match(/(\d*\.?\d+)\s*(?:x|×|by)\s*(\d*\.?\d+)/i);
        if (pair) {
          w = parseLength(pair[1], unit) ?? w;
          h = parseLength(pair[2], unit) ?? h;
        }
      }
    }
  }

  if (w != null && h != null) return { width: w, height: h };
  const d = unit === 'in' ? DEFAULT_PAGE
    : unit === 'pt' ? { width: 612, height: 792 }
      : { width: 215.9, height: 279.4 };
  return landscape ? { width: d.height, height: d.width } : d;
}

// ── the conversion ────────────────────────────────────────────────────

/** Whether the sheet names its measurements in something other than inches. */
function unitOf(rows: string[][]): SpecUnit {
  const head = rows.slice(0, 25).flat().join(' ').toLowerCase();
  if (/\bmm\b|millimet/.test(head) && !/\binch|"/.test(head)) return 'mm';
  if (/\bpt\b|points?\b/.test(head) && !/\binch|"|font size/.test(head)) return 'pt';
  return 'in';
}

/**
 * Convert one sheet into a single-page spec.
 *
 * The page is always numbered 1: a sheet describes *a* page, and which PDF page
 * it is checked against is the reader's choice, carried separately.
 */
export function sheetToSpec(grid: SheetGrid): SheetConversion {
  const notes: ConversionNote[] = [];
  const rows = grid.rows;

  if (rows.length === 0) {
    return {
      sheet: grid.name,
      spec: { title: grid.name, units: 'in', pageSize: DEFAULT_PAGE, pages: [{ page: 1, elements: [] }] },
      notes: [{ severity: 'warn', where: grid.name, message: 'The sheet is empty.' }],
      converted: 0,
      skipped: 0,
    };
  }

  const unit = unitOf(rows);
  const header = findHeaderRow(rows);
  const drafts = header ? draftsFromColumns(rows, header, notes) : draftsFromBlocks(rows, notes);

  notes.unshift({
    severity: 'info',
    where: grid.name,
    message: header
      ? `Read as a table: row ${header.at + 1} names the properties (${[...header.cols.values()].join(', ')}).`
      : 'Read as labelled blocks: a heading, then its properties beneath.',
  });

  const elements: SpecElement[] = [];
  let skipped = 0;
  drafts.forEach((d, i) => {
    const el = toElement(d, i, unit, notes);
    if (el) elements.push(el);
    else skipped++;
  });

  // Two ids colliding would make one result unreadable in the report.
  const seen = new Set<string>();
  for (const el of elements) {
    let id = el.id;
    let n = 2;
    while (seen.has(id)) id = `${el.id}-${n++}`;
    seen.add(id);
    el.id = id;
  }

  if (elements.length === 0) {
    notes.push({
      severity: 'warn',
      where: grid.name,
      message: 'Nothing checkable was found on this sheet — every element needs at least a top and left measurement.',
    });
  }

  return {
    sheet: grid.name,
    spec: {
      title: `${grid.name}`,
      units: unit,
      pageSize: pageSizeFrom(rows, unit),
      pages: [{ page: 1, elements }] as SpecPage[],
    },
    notes,
    converted: elements.length,
    skipped,
  };
}
