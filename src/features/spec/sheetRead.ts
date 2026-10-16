/**
 * Reading a spec workbook in the browser.
 *
 * A sheet arrives here as a plain grid of trimmed strings — rows of cells — and
 * nothing more. Everything that interprets those strings lives in
 * `sheetSpec.ts`; this file only gets the text out of the file.
 *
 * `.xlsx` is a zip of XML, and JSZip is already a dependency, so the format is
 * read directly rather than pulling in a spreadsheet library: one less 400KB
 * dependency in a bundle that is already watched, and nothing in a spec sheet
 * needs more than cell text.
 */

export interface SheetGrid {
  name: string;
  /** Rows of cells, already trimmed. Ragged: trailing empties are dropped. */
  rows: string[][];
}

export interface Workbook {
  name: string;
  sheets: SheetGrid[];
}

/** "BC12" → 28 (0-based column). */
function colOf(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Drop trailing empty cells and trailing empty rows, which Excel emits freely. */
function trimGrid(rows: string[][]): string[][] {
  const out = rows.map((r) => {
    let end = r.length;
    while (end > 0 && !r[end - 1]) end--;
    return r.slice(0, end);
  });
  let last = out.length;
  while (last > 0 && out[last - 1].length === 0) last--;
  return out.slice(0, last);
}

function parseXml(xml: string): Document {
  // application/xml, so the parser never runs scripts or applies HTML parsing.
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('The workbook contains malformed XML.');
  return doc;
}

/** Shared strings, by index. An `<si>` may be split across several runs. */
function sharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const doc = parseXml(xml);
  return [...doc.getElementsByTagName('si')].map((si) => {
    const runs = si.getElementsByTagName('t');
    let out = '';
    for (const t of runs) out += t.textContent ?? '';
    return out;
  });
}

function cellText(c: Element, shared: string[]): string {
  const type = c.getAttribute('t');
  if (type === 's') {
    const i = Number(c.getElementsByTagName('v')[0]?.textContent ?? -1);
    return shared[i] ?? '';
  }
  if (type === 'inlineStr') {
    const runs = c.getElementsByTagName('t');
    let out = '';
    for (const t of runs) out += t.textContent ?? '';
    return out;
  }
  if (type === 'b') {
    return c.getElementsByTagName('v')[0]?.textContent === '1' ? 'TRUE' : 'FALSE';
  }
  // 'str' (a formula's cached string) and numbers both sit in <v>.
  return c.getElementsByTagName('v')[0]?.textContent ?? '';
}

function sheetFromXml(name: string, xml: string, shared: string[]): SheetGrid {
  const doc = parseXml(xml);
  const rows: string[][] = [];
  for (const row of doc.getElementsByTagName('row')) {
    // `r` is 1-based and may skip rows entirely when they are empty.
    const at = Number(row.getAttribute('r') ?? rows.length + 1) - 1;
    const cells: string[] = [];
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r');
      const col = ref ? colOf(ref) : cells.length;
      const text = clean(cellText(c, shared));
      while (cells.length < col) cells.push('');
      cells[col] = text;
    }
    while (rows.length < at) rows.push([]);
    rows[at] = cells;
  }
  return { name, rows: trimGrid(rows) };
}

/**
 * Read an `.xlsx`/`.xlsm` workbook into grids, in the workbook's own sheet
 * order — which is the order the author sees, so it is the order to show.
 */
export async function readWorkbook(file: File): Promise<Workbook> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const bookXml = await zip.file('xl/workbook.xml')?.async('string');
  if (!bookXml) throw new Error('Not a workbook — xl/workbook.xml is missing.');

  // Sheet name → part path, via the workbook's relationships.
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const targets = new Map<string, string>();
  if (relsXml) {
    for (const rel of parseXml(relsXml).getElementsByTagName('Relationship')) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (id && target) targets.set(id, target.replace(/^\/?xl\//, '').replace(/^\//, ''));
    }
  }

  const shared = sharedStrings((await zip.file('xl/sharedStrings.xml')?.async('string')) ?? null);

  const sheets: SheetGrid[] = [];
  const entries = [...parseXml(bookXml).getElementsByTagName('sheet')];
  for (let i = 0; i < entries.length; i++) {
    const el = entries[i];
    const name = el.getAttribute('name') ?? `Sheet${i + 1}`;
    const rid =
      el.getAttribute('r:id') ??
      el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const path = (rid && targets.get(rid)) || `worksheets/sheet${i + 1}.xml`;
    const xml = await zip.file(`xl/${path}`)?.async('string');
    // A chart or macro sheet has no cells; skip it rather than fail the upload.
    if (!xml) continue;
    sheets.push(sheetFromXml(name, xml, shared));
  }

  if (sheets.length === 0) throw new Error('The workbook has no readable sheets.');
  return { name: file.name, sheets };
}

/** One CSV row, honouring quotes and doubled quotes inside them. */
function csvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(clean(cur));
      cur = '';
    } else cur += ch;
  }
  out.push(clean(cur));
  return out;
}

/**
 * A `.csv` is one sheet, named after the file.
 *
 * Newlines inside a quoted cell are joined with a space: a spec sheet uses them
 * for wrapped prose, and the parsers downstream read a cell as one string.
 */
export async function readCsv(file: File): Promise<Workbook> {
  const text = await file.text();
  const lines: string[] = [];
  let cur = '';
  let quotes = 0;
  for (const raw of text.split(/\r\n|\n|\r/)) {
    cur = cur ? `${cur} ${raw}` : raw;
    quotes += (raw.match(/"/g) ?? []).length;
    if (quotes % 2 === 0) {
      lines.push(cur);
      cur = '';
    }
  }
  if (cur) lines.push(cur);

  const name = file.name.replace(/\.csv$/i, '');
  return { name: file.name, sheets: [{ name, rows: trimGrid(lines.map(csvRow)) }] };
}

export function readSheetFile(file: File): Promise<Workbook> {
  if (/\.csv$/i.test(file.name)) return readCsv(file);
  return readWorkbook(file);
}
