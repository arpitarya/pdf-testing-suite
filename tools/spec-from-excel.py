#!/usr/bin/env python3
"""Convert a page-layout spec workbook into a pdfsuite JSON spec.

The workbook this reads has one sheet per output page, and each sheet is a
hierarchical key/value tree spread across columns:

    A  Element              e.g. "Solid blue left sidebar container"
    B  Sub-element          e.g. "Container", "Container content", "Header"
    C  Sub-sub-element      e.g. "Program name", "Sidebar copy", "Watermark"
    D  Parameter group      e.g. "Position", "Alignment", "Text", "Font", "Size"
    E  Parameter            e.g. "Vertical", "Wording", "Font name", "Height"
    F  Description (value)  e.g. "3 inches from left of page", "Roboto", "8 pt"

Labels only appear on the first row of a block and are blank on continuation
rows, so the reader carries the last non-empty value down each column.

Not every row can become a check. Font colour, background fills and box sizes
describe things the checker cannot measure from a rendered PDF, so they are
skipped and listed in the conversion report rather than silently dropped — see
`--report`.

Usage
    python spec-from-excel.py spec.xlsx --sheet 2 --out page-2.json
    python spec-from-excel.py page2.csv --out page-2.json
    python spec-from-excel.py spec.xlsx --all --out-dir ./specs

Reading .csv needs nothing. Reading .xlsx needs openpyxl (`pip install openpyxl`);
otherwise export each sheet to CSV first.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys

# --------------------------------------------------------------------------
# Page geometry
#
# The workbook expresses some positions from the bottom or right edge, which the
# JSON spec has no concept of — it is top-left only. Converting those needs the
# page size, so it is stated here and can be overridden per run.
# --------------------------------------------------------------------------
DEFAULT_PAGE = {"landscape": (11.0, 8.5), "portrait": (8.5, 11.0)}

# Column indexes (0-based) in the sheet.
COL_ELEMENT, COL_SUB, COL_SUB2, COL_GROUP, COL_PARAM, COL_VALUE = 0, 1, 2, 3, 4, 5

# Rows whose parameter names carry no checkable meaning. They are recorded in
# the report so nothing disappears without a trace.
UNCHECKABLE_PARAMS = {
    "font color", "font colour", "hex code", "color", "colour",
    "font case", "font underline",
}
UNCHECKABLE_GROUPS = {"background", "color", "colour"}


# --------------------------------------------------------------------------
# Value parsing
# --------------------------------------------------------------------------
def parse_inches(value: str):
    """Pull a leading measurement out of a description.

    Handles the shapes the workbook actually uses:
        "3 inches from left of page"          -> 3.0
        ".375 inches from right of page"      -> 0.375
        "0.875 inches from top of page"       -> 0.875
        "1.4 inches"                          -> 1.4
    """
    if value is None:
        return None
    # Cells often hold the measurement on line 1 and prose on line 2.
    value = str(value).splitlines()[0] if str(value).strip() else ""
    m = re.search(r"(-?\d*\.?\d+)\s*(?:inches|inch|in\b|\")", str(value), re.I)
    if not m:
        m = re.match(r"\s*(-?\d*\.?\d+)\s*$", str(value))
    return float(m.group(1)) if m else None


def parse_points(value: str):
    """'8 pt' / '8.75 pt' / '15pt' -> float."""
    if value is None:
        return None
    m = re.search(r"(-?\d*\.?\d+)\s*(?:pt|point)", str(value), re.I)
    return float(m.group(1)) if m else None


def parse_edge(value: str) -> str | None:
    """Which page edge a measurement is taken from."""
    v = (value or "").lower()
    for edge in ("top", "bottom", "left", "right"):
        if re.search(r"from\s+(?:the\s+)?%s" % edge, v):
            return edge
    if "from top and bottom" in v:
        return "top"
    return None


def parse_bool(value: str):
    """Yes/No columns, which the workbook writes several ways.

    Returns None for anything conditional — "As provided", "Yes, words as shown",
    "Only the word siddharth is italicized". Those describe runs within a line
    rather than the line as a whole, so asserting them would be wrong.
    """
    if value is None:
        return None
    v = str(value).strip().lower()
    if v in ("yes", "y", "true"):
        return True
    if v in ("no", "n", "false", "none"):
        return False
    return None  # conditional or descriptive — not assertable


def clean_font_name(value: str):
    """'Roboto Medium' -> 'Roboto Medium'; strips trailing notes."""
    if not value:
        return None
    name = str(value).splitlines()[0].split("(")[0].strip()
    return name or None


# Placeholders the document fills at generation time.
PLACEHOLDER = re.compile(r"<<[^>]*>>")


def usable_text(wording: str):
    """Turn a wording cell into something matchable.

    Returns (text, match_mode) or (None, None) when nothing stable remains.

    A wording containing placeholders — "Proposal ID: <<dynamic>>",
    "<<Page name>> | Page <<X>> of <<XX>>" — cannot be matched literally, so the
    longest fixed fragment is used with a `contains` match instead.
    """
    if not wording:
        return None, None
    text = " ".join(str(wording).split())
    if not text:
        return None, None

    if PLACEHOLDER.search(text):
        fragments = [f.strip(" |:-") for f in PLACEHOLDER.split(text)]
        # A fragment shorter than this ("Page", "of") appears all over a document
        # and would match the wrong line.
        fragments = [f for f in fragments if len(f) >= 8]
        if not fragments:
            return None, None
        return max(fragments, key=len), "contains"

    # Long prose is matched on its opening words: quoting a whole paragraph makes
    # the spec fail on any wording edit, which is the compare workspace's job.
    if len(text) > 120:
        return " ".join(text.split()[:8]), "contains"
    return text, "contains"


def slugify(*parts: str) -> str:
    raw = "-".join(p for p in parts if p)
    slug = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")
    return slug or "element"


# --------------------------------------------------------------------------
# Sheet reading
# --------------------------------------------------------------------------
def read_csv(path: str) -> list[list[str]]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return [row for row in csv.reader(fh)]


def read_xlsx(path: str, sheet: str | None) -> tuple[list[list[str]], str]:
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise SystemExit(
            "Reading .xlsx needs openpyxl:  pip install openpyxl\n"
            "Or export the sheet to CSV and pass that instead."
        )
    wb = load_workbook(path, data_only=True, read_only=True)
    name = sheet or wb.sheetnames[0]
    if name not in wb.sheetnames:
        raise SystemExit(
            "No sheet named %r. Available: %s" % (name, ", ".join(wb.sheetnames))
        )
    ws = wb[name]
    rows = [["" if c is None else str(c) for c in row] for row in ws.iter_rows(values_only=True)]
    return rows, name


def sheet_names(path: str) -> list[str]:
    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=True, read_only=True)
    return wb.sheetnames


# --------------------------------------------------------------------------
# The tree walk
# --------------------------------------------------------------------------
class Block:
    """One element under construction, keyed by its column A/B/C path."""

    def __init__(self, path: tuple[str, ...]):
        self.path = path
        self.params: dict[str, str] = {}      # "position.vertical" -> value
        self.order: list[str] = []
        self.notes: list[str] = []            # free text attached to the block

    def put(self, group: str, param: str, value: str) -> None:
        key = ("%s.%s" % (group, param)).strip(".").lower()
        if key not in self.params:
            self.order.append(key)
        self.params[key] = value

    @staticmethod
    def _bare(key: str) -> str:
        """Drop a parenthetical qualifier so "vertical (all)" matches "vertical"."""
        return re.sub(r"\s*\([^)]*\)", "", key).strip()

    def get(self, *candidates: str):
        for c in candidates:
            want = c.lower()
            for key, value in self.params.items():
                if self._bare(key).endswith(want):
                    return value
        return None

    def matching(self, suffix: str) -> list[tuple[str, str]]:
        """Every parameter whose name contains `suffix`, in sheet order."""
        return [(k, self.params[k]) for k in self.order if suffix.lower() in k]


def parse_sheet(rows: list[list[str]]) -> tuple[list[Block], str, str]:
    """Walk the sheet into blocks, carrying labels down blank cells."""
    carried = ["", "", "", "", ""]
    blocks: list[Block] = []
    by_path: dict[tuple, Block] = {}
    title = ""
    orientation = "landscape"

    for row in rows:
        cells = [(row[i].strip() if i < len(row) and row[i] else "") for i in range(6)]

        if not any(cells):
            continue
        if not title:
            filled = [c for c in cells if c]
            # A merged title row has exactly one value and no "Element" header yet.
            if len(filled) == 1 and cells[COL_ELEMENT] == "" and filled[0].lower() != "element":
                title = filled[0]
                continue
        if cells[COL_ELEMENT].lower() == "element":
            continue  # header row
        if cells[COL_ELEMENT].lower() == "page orientation":
            orientation = (cells[COL_VALUE] or "landscape").strip().lower()
            continue

        # Carry labels down: a blank cell means "same as the row above".
        for i in range(5):
            if cells[i]:
                carried[i] = cells[i]
                for j in range(i + 1, 5):
                    carried[j] = ""  # a new label at this level resets deeper ones

        value = cells[COL_VALUE]
        if not value:
            continue

        path = tuple(p for p in carried[:3] if p)
        if not path:
            continue
        block = by_path.get(path)
        if block is None:
            block = Block(path)
            by_path[path] = block
            blocks.append(block)
        # A row carrying a value but no parameter name is a free-text note about
        # the block — an applicability condition, or guidance for the designer.
        if not carried[COL_GROUP] and not carried[COL_PARAM]:
            block.notes.append(value)
        else:
            block.put(carried[COL_GROUP], carried[COL_PARAM], value)

    return blocks, title, orientation


# --------------------------------------------------------------------------
# Block -> spec element
# --------------------------------------------------------------------------
def to_top_left(value: str, axis: str, page_w: float, page_h: float, size: float = 0.0):
    """Normalise a measurement to a distance from the page's top-left corner.

    Returns (position, note). `position` is None when the measurement cannot be
    converted honestly:

    A measurement from the RIGHT edge fixes where text *ends*, and turning that
    into a left coordinate needs the rendered width of the string — which depends
    on per-glyph metrics this converter does not have. Guessing would produce a
    check that always fails, so those are reported for manual attention instead.

    A measurement from the BOTTOM fixes the text's baseline area, and there the
    font size is a good enough stand-in for the line height.
    """
    n = parse_inches(value)
    if n is None:
        return None, None

    edge = parse_edge(value) or ("top" if axis == "v" else "left")

    if edge == "bottom":
        return round(page_h - n - size, 4), (
            None if size else "measured from the bottom edge; no height known, so the top may be off by one line"
        )
    if edge == "right":
        if size:
            return round(page_w - n - size, 4), None
        return None, "measured from the right edge — the text width is unknown, so `left` cannot be derived"
    return round(n, 4), None


# Wording that makes an element conditional. Something that appears on only some
# documents must not be asserted unconditionally — a spec that demands it would
# fail every time it is legitimately absent.
# Phrases that make an element conditional. Plain substring matching rather
# than a regex: the vocabulary is small, and it stays readable for whoever
# has to add to it.
CONDITIONAL_PHRASES = (
    "should only be displayed",
    "should only be shown",
    "should only appear",
    "only be displayed",
    "only be shown",
    "only displayed on",
    "only shown on",
    "only appears on",
    "only on prospect",
    "if applicable",
    "when applicable",
    "does not apply",
    "do not apply",
)


def conditional_note(notes):
    """The first note that makes this element conditional, or None.

    An element that appears on only some documents must not be asserted
    unconditionally: a spec demanding it would fail every time it is
    legitimately absent.
    """
    for note in notes:
        low = " ".join(str(note).split()).lower()
        if any(phrase in low for phrase in CONDITIONAL_PHRASES):
            return note
    return None


def build_elements(block: Block, page_w: float, page_h: float, skipped: list[str]):
    """Turn one block into zero or more spec elements."""
    label = " / ".join(block.path)
    out = []

    conditional = conditional_note(block.notes)
    if conditional:
        skipped.append(
            "%s - CONDITIONAL, not asserted: %s" % (label, " ".join(conditional.split()))
        )
        return out

    for note in block.notes:
        skipped.append("%s - NOTE (not checkable): %s" % (label, " ".join(note.split())))

    v_raw = block.get("position.vertical", "alignment.vertical", "vertical")
    h_raw = block.get("position.horizontal", "alignment.horizontal", "horizontal")

    # ---- image -----------------------------------------------------------
    file_name = block.get("image.file name", "image.file", "file name", "file")
    if file_name:
        width = parse_inches(block.get("image size.width", "size.width", "width"))
        height = parse_inches(block.get("image size.height", "size.height", "height"))
        top, _ = to_top_left(v_raw, "v", page_w, page_h, height or 0)
        left, _ = to_top_left(h_raw, "h", page_w, page_h, width or 0)
        if None in (top, left, width, height):
            skipped.append("%s - image needs top, left, width and height" % label)
        else:
            out.append({
                "type": "image",
                "id": slugify(*block.path),
                "label": label,
                "top": top,
                "left": left,
                "width": width,
                "height": height,
            })
        return out

    # ---- text / paragraph ------------------------------------------------
    # A block may hold several numbered wordings ("Wording 1 (Plan description)")
    # that share one set of font settings, each with its own horizontal position.
    wordings = block.matching("wording")
    if not wordings:
        reason = "no wording"
        param_names = ", ".join(sorted({k.split(".")[-1] for k in block.order})) or "nothing"
        skipped.append("%s - %s (has: %s)" % (label, reason, param_names))
        return out

    horizontals = block.matching("horizontal")
    font_name = clean_font_name(block.get("font name"))
    font_size = parse_points(block.get("font size"))
    bold = parse_bool(block.get("font bold"))
    italic = parse_bool(block.get("font italicize", "font italic"))

    for index, (key, wording) in enumerate(wordings):
        text, match = usable_text(wording)
        if not text:
            skipped.append("%s - wording is entirely dynamic, nothing stable to match" % label)
            continue

        # Variant wordings pair with the matching horizontal by suffix in
        # parentheses, e.g. "Wording 3 (Implement description)".
        variant = re.search(r"\(([^)]+)\)", key)
        h_for_this = h_raw
        if variant and len(horizontals) > 1:
            token = variant.group(1).split()[0].lower()
            for hk, hv in horizontals:
                if token in hk:
                    h_for_this = hv
                    break
        elif len(wordings) > 1 and index < len(horizontals):
            h_for_this = horizontals[index][1]

        # The font size stands in for line height when a position is measured
        # from the bottom edge.
        line_h = (font_size / 72.0) if font_size else 0.0
        top, top_note = to_top_left(v_raw, "v", page_w, page_h, line_h)
        left, left_note = to_top_left(h_for_this, "h", page_w, page_h)
        if top is None or left is None:
            why = left_note or top_note or "no usable position (%r / %r)" % (v_raw, h_for_this)
            skipped.append("%s - %s" % (label, why))
            continue
        for note in (top_note, left_note):
            if note:
                skipped.append("%s - NOTE: %s" % (label, note))

        suffix = variant.group(1) if variant else ("%d" % (index + 1) if len(wordings) > 1 else "")
        element = {
            "type": "text",
            "id": slugify(*block.path, suffix),
            "label": (label + " - " + suffix) if suffix else label,
            "text": text,
            "match": match,
            "top": top,
            "left": left,
        }
        if font_size is not None:
            element["fontSize"] = font_size
        if font_name:
            element["fontName"] = font_name
        if bold is not None:
            element["fontBold"] = bold
        if italic is not None:
            element["fontItalic"] = italic
        out.append(element)

    return out


def note_unconvertible(block: Block, skipped: list[str]) -> None:
    """Record parameters the checker has no way to verify."""
    label = " / ".join(block.path)
    for key, value in block.params.items():
        tail = key.split(".")[-1]
        head = key.split(".")[0]
        if tail in UNCHECKABLE_PARAMS or head in UNCHECKABLE_GROUPS:
            skipped.append("%s - %s: %s (not measurable from a rendered PDF)" % (label, tail, value))


# --------------------------------------------------------------------------
# Conversion
# --------------------------------------------------------------------------
def convert(rows, page_number: int, page_size=None, title_override=None):
    blocks, title, orientation = parse_sheet(rows)
    page_w, page_h = page_size or DEFAULT_PAGE.get(orientation, DEFAULT_PAGE["landscape"])

    elements, skipped = [], []
    for block in blocks:
        note_unconvertible(block, skipped)
        elements.extend(build_elements(block, page_w, page_h, skipped))

    # ids must be unique within a page
    seen = {}
    for el in elements:
        base = el["id"]
        if base in seen:
            seen[base] += 1
            el["id"] = "%s-%d" % (base, seen[base])
        else:
            seen[base] = 1

    spec = {
        "title": title_override or title or "Converted spec",
        "units": "in",
        "pageSize": {"width": page_w, "height": page_h},
        "tolerance": {"position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2},
        "pages": [{"page": page_number, "elements": elements}],
    }
    return spec, skipped, orientation


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Convert a page-layout spec sheet into a pdfsuite JSON spec.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage")[-1],
    )
    ap.add_argument("input", help=".xlsx workbook or a .csv exported from one sheet")
    ap.add_argument("--sheet", help="sheet name (xlsx only; default: first sheet)")
    ap.add_argument("--all", action="store_true", help="convert every sheet (xlsx only)")
    ap.add_argument("--out", help="output .json path")
    ap.add_argument("--out-dir", help="output directory when using --all")
    ap.add_argument("--page", type=int, default=1, help="PDF page this spec describes (default 1)")
    ap.add_argument("--page-width", type=float, help="page width in inches (overrides orientation)")
    ap.add_argument("--page-height", type=float, help="page height in inches")
    ap.add_argument("--report", help="write the skipped-rows report here instead of stderr")
    args = ap.parse_args()

    size = None
    if args.page_width and args.page_height:
        size = (args.page_width, args.page_height)

    is_xlsx = args.input.lower().endswith((".xlsx", ".xlsm"))

    jobs = []
    if args.all:
        if not is_xlsx:
            raise SystemExit("--all only works with an .xlsx workbook")
        for name in sheet_names(args.input):
            rows, _ = read_xlsx(args.input, name)
            # a sheet named "12" describes page 12
            page = int(re.sub(r"\D", "", name) or args.page)
            jobs.append((rows, name, page))
    elif is_xlsx:
        rows, name = read_xlsx(args.input, args.sheet)
        page = args.page if args.sheet is None else int(re.sub(r"\D", "", args.sheet) or args.page)
        jobs.append((rows, name, page))
    else:
        jobs.append((read_csv(args.input), os.path.basename(args.input), args.page))

    report_lines = []
    for rows, name, page in jobs:
        spec, skipped, orientation = convert(rows, page, size)
        count = len(spec["pages"][0]["elements"])

        if args.all:
            os.makedirs(args.out_dir or ".", exist_ok=True)
            out_path = os.path.join(args.out_dir or ".", "page-%s.json" % re.sub(r"\W+", "-", name))
        else:
            out_path = args.out or "spec.json"

        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(spec, fh, indent=2, ensure_ascii=False)
            fh.write("\n")

        report_lines.append("%s -> %s" % (name, out_path))
        report_lines.append("  %s page, %d element(s) converted, %d row(s) not convertible"
                            % (orientation, count, len(skipped)))
        for s in skipped:
            report_lines.append("    - %s" % s)
        report_lines.append("")

    text = "\n".join(report_lines)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            fh.write(text)
        print("wrote %s" % args.report)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
