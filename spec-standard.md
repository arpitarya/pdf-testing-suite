# PDF Spec Standard

Reference for the JSON spec format consumed by the **Test new pages** workspace and the
`pdfsuite` CLI.

Written to be used two ways: as the authority on what each field means, and as the
conversion guide for turning an Excel workbook (one tab per PDF page) into a JSON spec.

---

## 1. What a spec is

A spec describes what a page **should** contain — text, images, tables, paragraphs — and
where. The checker renders the actual PDF, extracts its real content, and reports every
element as `pass`, `fail`, or `not-found`, with expected-vs-actual values for each check.

A spec is not a template and is not compared against another PDF. It is a standalone
statement of intent, which is what makes it usable when there is no reference document.

---

## 2. File structure

```json
{
  "title": "Monthly Statement Template v3",
  "units": "in",
  "pageSize": { "width": 8.5, "height": 11 },
  "tolerance": { "position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2 },
  "pages": [
    { "page": 1, "elements": [ /* … */ ] },
    { "page": 2, "elements": [ /* … */ ] }
  ]
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `title` | no | — | Shown on the report. Use the template name and version. |
| `units` | no | `"in"` | `"in"`, `"pt"`, or `"mm"`. Applies to **every** measurement except `fontSize`. |
| `pageSize` | no | — | Documentation only; not currently asserted. |
| `tolerance` | no | see §4 | Defaults for all elements. |
| `pages` | **yes** | — | Non-empty array. One entry per page you want checked. |

`pages[].page` is **1-based** and must be a number.

> **You do not have to renumber a single-page spec.** A spec exported from one sheet will say
> `"page": 1`. In the app, switch **Test new pages** to **One page** and point it at whichever
> PDF page it actually describes — the spec is left alone, and the report records the mapping.
 Pages not listed are not checked. A
page number beyond the end of the PDF is reported as `not-found` for every element on it.

---

## 3. Coordinate system

- Origin is the **top-left corner of the page**.
- `top` increases **downward**, `left` increases **rightward**.
- Values are in `units` (inches by default).
- `fontSize` is always in **points**, regardless of `units`.

> **Excel note.** If your sheet records positions from the *bottom* of the page (some
> layout tools do), convert with `top = pageHeight − bottom − height` during export. The
> checker has no way to detect that mistake; everything will simply fail on `Top`.

---

## 4. Tolerances

```json
"tolerance": { "position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2 }
```

| Key | Default | Units | Applies to |
|---|---|---|---|
| `position` | `0.06` | spec units | `Left`, `Top` checks |
| `size` | `0.06` | spec units | `Width`, `Height` checks |
| `spacing` | `0.03` | spec units | paragraph `Line spacing` |
| `fontSize` | `2` | **points** | text `Font size` |

**Precedence:** element `tolerance` → spec-level `tolerance` → built-in default. Each key
resolves independently, so an element can override `position` alone and still inherit the
rest.

Set tolerances from what your renderer actually achieves. Too tight produces noise nobody
acts on; too loose lets real regressions through.

---

## 5. Element types

Every element carries these:

| Field | Required | Meaning |
|---|---|---|
| `type` | **yes** | `text` \| `image` \| `table` \| `paragraph` |
| `id` | **yes** | Stable identifier. Reporting only — **never used to find the element**. Keep it stable across revisions so results stay comparable. |
| `label` | no | Human name in the report. Defaults to the text (for `text`) or the `id`. |
| `top`, `left` | **yes** | Expected position, spec units, from the page's top-left. |
| `tolerance` | no | Per-element override (§4). |
| `anchor` | no | Locate relative to a nearby label instead of by position (§6). |

### 5.1 `text`

A single line of static text.

```json
{
  "type": "text",
  "id": "statement-title",
  "label": "Statement title",
  "text": "MONTHLY STATEMENT",
  "match": "exact",
  "top": 0.75,
  "left": 0.75,
  "fontSize": 20
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `text` | **yes** | — | The string to find. Whitespace is collapsed and case is ignored. |
| `match` | no | `"contains"` | `"exact"` compares the whole line; `"contains"` matches a substring. |
| `fontSize` | no | — | Points. Omit to skip the check. |
| `fontName` | no | — | Typeface, e.g. `"Roboto Medium"`. Matched loosely: a subset prefix is stripped and case, spaces and hyphens are ignored, so it matches an embedded `ABCDEF+Roboto-Medium`. |
| `fontBold` | no | — | `true` / `false`. Omit when the weight varies within the line. |
| `fontItalic` | no | — | `true` / `false`. Omit when the slant varies within the line. |

**How it is located:** all lines whose text matches are collected, then the one nearest the
expected `top` wins. Content is the anchor, position is the assertion — so an element that
moved is still *found*, and correctly reported as a `Top`/`Left` failure.

**Checks produced:** `Present`, `Left`, `Top`, plus `Font size`, `Font name`, `Font bold`
and `Font italic` for whichever of those the spec states.

`fontName`, `fontBold` and `fontItalic` also apply to `paragraph`. They read the font the
PDF actually embedded; when it cannot be resolved the check reports `not resolved` rather
than failing, so an unreadable font never masquerades as a mismatch.

> `match: "contains"` is the default and is usually what you want for values that vary
> (dates, amounts, account numbers): specify the stable label portion only. Use `"exact"`
> for fixed headings where an accidental suffix should fail.

### 5.2 `image`

```json
{
  "type": "image",
  "id": "brand-logo",
  "label": "Brand logo",
  "top": 0.55,
  "left": 6.4,
  "width": 1.6,
  "height": 0.6,
  "anchor": { "text": "MONTHLY STATEMENT", "position": "right", "within": 6 }
}
```

| Field | Required | Meaning |
|---|---|---|
| `width`, `height` | **yes** | Expected size in spec units. |

**How it is located:** images carry no text, so without an `anchor` the checker picks the
image nearest the expected top-left. On a page with one image that always "finds" it —
useful for reporting drift, but it cannot detect the *wrong* image. On a page with several,
a large enough move can match a neighbour. **Use an `anchor` whenever a page has more than
one image.**

**Checks produced:** `Anchor` (if used), `Present`, `Left`, `Top`, `Width`, `Height`.

### 5.3 `table`

```json
{
  "type": "table",
  "id": "charges-table",
  "label": "Charges table",
  "top": 3.0,
  "left": 0.75,
  "width": 7.0,
  "rows": 5,
  "columns": 4
}
```

| Field | Required | Meaning |
|---|---|---|
| `width` | **yes** | Expected overall width in spec units. |
| `rows` | no | Expected row count, **including the header row**. Omit to skip. |
| `columns` | no | Expected column count. Omit to skip. |

**How it is located:** there are no ruling lines to rely on, so rows are inferred from text
— lines with **two or more** items falling inside the horizontal span. The first row must
start near the expected `top` (or near the anchor, if given); subsequent rows are collected
while the vertical gap stays under `max(rowHeight × 2, 24pt)`, which is what stops it
running on into the paragraph below.

**Checks produced:** `Anchor` (if used), `Present` (with the row count found), `Left`,
`Top`, `Width`, plus `Rows`/`Columns` when specified.

> Tables whose row count varies with data are the common case. Omit `rows` and assert
> position, width and `columns` only — otherwise the spec fails every time the data
> changes, which trains people to ignore it.

### 5.4 `paragraph`

```json
{
  "type": "paragraph",
  "id": "payment-terms",
  "label": "Payment terms",
  "text": "Payment is due within",
  "top": 6.2,
  "left": 0.75,
  "lineSpacing": 0.18
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `text` | **yes** | — | A **starting snippet**, not the whole paragraph. Used to locate the first line. |
| `match` | no | `"contains"` | As for `text`. |
| `lineSpacing` | **yes** | — | Expected distance between consecutive baselines, in spec units. |

Give enough of the opening words to be unique on the page, and no more — quoting the whole
paragraph makes the spec fail on any wording edit, which is what the Compare workspace is
for.

**Checks produced:** `Present`, `Left`, `Top`, `Line spacing`.

---

## 6. Anchors — locating by label instead of coordinates

An `anchor` ties an element to text that actually appears on the page. Add it whenever an
element's position depends on how much content sits above it.

```json
"anchor": {
  "text": "Statement period",
  "position": "below",
  "within": 2,
  "match": "contains",
  "occurrence": 1
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `text` | **yes** | — | Label to find. Case-insensitive, whitespace collapsed. |
| `position` | no | `"below"` | Where the element sits relative to the label: `above`, `below`, `left`, `right`. |
| `within` | no | `2` | Search distance from the label, in spec units. |
| `match` | no | `"contains"` | How `text` is matched. |
| `occurrence` | no | `1` | Which occurrence to use (1-based, reading order) when the label repeats. |

### What an anchor does and does not change

An anchor changes **how the element is found**, never **what is asserted**. `top` and
`left` are still required and still checked — so a correct anchor plus a wrong position
reports a clean `Top` failure instead of an uninformative `not-found`.

Measured on the sample statement, with the table's `top` deliberately set 2.5in wrong:

| Spec | Result |
|---|---|
| position only | `not-found` — no information about what went wrong |
| with `anchor` | `Present: ok`, `Top: FAIL` — found it, and said exactly how far off it is |

### When the anchor text is missing

The element reports `not-found` with a single failing `Anchor` check naming the text it
looked for. It deliberately does **not** fall back to position matching: silently matching
a neighbour is worse than saying "the label I key off is gone".

### Choosing an anchor

- Pick a **static** label, never a value. `"Statement period"` is a good anchor;
  `"Statement period: June 2026"` breaks every month.
- Pick the **nearest** label, so `within` can stay small.
- Set `position` to the true geometric relationship. A logo beside a title is `"right"`,
  not `"above"` — anchoring the wrong side makes the element unfindable.
- Raise `within` when a legitimately large gap separates the label from the element. The
  default of `2` suits a label directly above its element; it is **too small** for
  side-by-side relationships across a page. A logo 2.8in right of its title needs
  `"within": 6`, and without it you get `Anchor: ok` with `Present: FAIL`.

---

## 7. Converting the layout workbook

The source specs are an Excel workbook with **one sheet per output page** (`1`, `2`, `3`, …
`9A`, `9B`, `16A`, `16B`, …). Each sheet is a hierarchical key/value tree, not a flat table.

### Sheet shape

| Col | Holds | Examples |
|---|---|---|
| **A** | Element | `Solid blue left sidebar container`, `Right side of page`, `Faceted blue left sidebar` |
| **B** | Sub-element | `Container`, `Container content`, `Header`, `Body`, `Disclosure`, `Object` |
| **C** | Sub-sub-element | `Program name`, `Sidebar copy`, `Watermark`, `Proposal ID`, `Header box text` |
| **D** | Parameter group | `Position`, `Alignment`, `Text`, `Font`, `Size`, `Image`, `Background` |
| **E** | Parameter | `Vertical`, `Horizontal`, `Wording`, `Font name`, `Font size`, `Height`, `File name` |
| **F** | Description (the value) | `3 inches from left of page`, `Roboto`, `8 pt`, `#003D6D (siddharth Blue)` |

Row 1 is the sheet title (`PR Page - Value prop`), row 3 is the header row, and
`Page orientation` in column A gives `Landscape` or `Portrait`.

**Labels appear only on the first row of a block** and are blank on continuation rows, so a
reader must carry the last non-empty value down each column — and reset the deeper columns
whenever a shallower one changes.

### Five rules the workbook follows

1. **Positions are prose, not numbers.** `".375 inches from left of page"`. Both the number
   and the edge have to be parsed out.
2. **Some positions are measured from the bottom or right edge.** The JSON spec is top-left
   only, so these must be converted against the page size — which is why `Page orientation`
   matters. Landscape is 11 × 8.5 in.
3. **One block can hold several elements.** `Wording 1 (Plan description)` … `Wording 5
   (Adjust description)` share one set of font settings but each has its own
   `Horizontal (Plan description)` row. They expand into five spec elements.
4. **`Vertical (all)`** means one vertical shared by every variant in the block.
5. **Yes/No columns are not always yes or no.** `As provided`, `Yes, words as shown` and
   `Only the word siddharth is italicized` describe runs *within* a line, not the line as a
   whole. Those must be left unasserted rather than coerced to `true`.

### What converts, and what cannot

| Workbook row | Becomes |
|---|---|
| `Wording` + `Position` | a `text` element |
| `Wording 1..5` + `Horizontal (…)` | one `text` element each |
| `Image` `File name` + `Position` + `Size` | an `image` element |
| `Font name` / `Font size` / `Font bold` / `Font italicize` | `fontName` / `fontSize` / `fontBold` / `fontItalic` |
| `Font color`, `Hex code`, `Background` `Color` | **nothing** — not measurable from a rendered PDF |
| `Font case`, `Font underline` | **nothing** — not currently checked |
| A container with size but no text | **nothing** — a box with no content cannot be located |
| Wording that is entirely `<<placeholders>>` | **nothing** — no stable text to match |

Roughly a third of the rows become checks. The rest describe colour, casing and box geometry
that a rendered-PDF checker has no way to verify. **They are reported, never silently
dropped.**

### The converter

[`tools/spec-from-excel.py`](tools/spec-from-excel.py) implements all of the above.

```bash
# one sheet exported to CSV — needs nothing beyond Python
python tools/spec-from-excel.py page2.csv --page 2 --out page-2.json --report page-2-report.txt

# straight from the workbook — needs: pip install openpyxl
python tools/spec-from-excel.py "Output Pages List.xlsx" --sheet 2 --page 2 --out page-2.json

# every sheet at once; the sheet name supplies the page number
python tools/spec-from-excel.py "Output Pages List.xlsx" --all --out-dir ./specs
```

It handles the prose positions, the bottom/right-edge conversion, the numbered-variant
expansion, the conditional Yes/No values, and `<<placeholder>>` wordings — reducing those to
a `contains` match on the longest fixed fragment, or skipping them when nothing distinctive
remains.

**Always read the report.** It lists every row that did not become a check, and why:

```
landscape page, 20 element(s) converted, 37 row(s) not convertible
  - Right side of page / Header - font color: #003D6D (not measurable from a rendered PDF)
  - Right side of page / Page name and page number - wording is entirely dynamic,
    nothing stable to match
  - ... - measured from the right edge, the text width is unknown, so `left` cannot be derived
```

That last one is the case to watch. A measurement from the **right** edge fixes where text
*ends*; deriving a `left` from it needs the rendered width of the string, which the converter
cannot know. Rather than emit a check that would always fail, it skips the element and tells
you. Add those by hand, or anchor them to a nearby label (§6).

A worked example is checked in:
[`tools/samples/pr-page-value-prop.csv`](tools/samples/pr-page-value-prop.csv) and the
[JSON it produces](tools/samples/pr-page-value-prop.json).


## 8. Validation and common mistakes

The checker's own validation is **deliberately shallow**. It enforces only:

- the spec is a JSON object;
- `pages` is a non-empty array;
- every page has a numeric `page` and an `elements` array.

**Element fields are not validated.** A misspelled key, a string where a number belongs, or
a missing `width` will not be rejected — it will produce a confusing failure, or silently
skip a check. Your conversion script is the real validation layer, so make it strict.

| Mistake | Symptom |
|---|---|
| `top`/`left` as strings | Everything fails on position with nonsensical expected values |
| Measured from the page bottom | Every `Top` fails by a consistent amount |
| `fontSize` in spec units instead of points | Font-size check always fails |
| `text` too long for a paragraph | `not-found` after any wording change |
| `rows` set on a data-driven table | Fails whenever the data changes |
| Anchor text includes a variable value | Passes this month, `not-found` next month |
| Wrong `anchor.position` | `Anchor: ok` but `Present: FAIL` — the label was found, the element was not where you said |
| `anchor.within` too small | `Anchor: ok` but `Present: FAIL`. The default reach is **2 spec units**; a logo across the page from its label needs `within` raised. Measure the real gap and add margin. |
| Blank exported as `""` rather than omitted | Matches the first line on the page |

### Pre-flight checklist for a generated spec

- [ ] Parses as JSON
- [ ] `units` set, and every measurement uses it
- [ ] Every element has `type`, `id`, `top`, `left`
- [ ] `text` present on every `text` and `paragraph`
- [ ] `width`/`height` present on every `image`; `width` on every `table`
- [ ] `lineSpacing` present on every `paragraph`
- [ ] No `null`, no `""`, no numeric strings
- [ ] `anchor` present only where an anchor text was given
- [ ] `id` unique within each page
- [ ] Run it against one known-good PDF and confirm it passes before rolling it out

That last step matters most. A spec that has never passed against a correct document is not
a spec — it is a list of assumptions.

---

## 9. Quick reference

```jsonc
{
  "title":     "string",              // optional
  "units":     "in" | "pt" | "mm",    // default "in"
  "pageSize":  { "width": 0, "height": 0 },   // optional, documentation only
  "tolerance": { "position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2 },
  "pages": [{
    "page": 1,                        // 1-based, required
    "elements": [{
      "type":  "text" | "image" | "table" | "paragraph",   // required
      "id":    "string",              // required, reporting only
      "label": "string",              // optional
      "top":   0, "left": 0,          // required, spec units, from top-left

      // text / paragraph
      "text":  "string",
      "match": "exact" | "contains",  // default "contains"
      "fontSize":    0,               // text + paragraph, POINTS
      "fontName":   "Roboto Medium", // text + paragraph
      "fontBold":   true,            // text + paragraph
      "fontItalic": false,           // text + paragraph
      "lineSpacing": 0,               // paragraph only, required

      // image / table
      "width":   0,                   // image + table
      "height":  0,                   // image only
      "rows":    0, "columns": 0,     // table only, optional

      // optional on any type
      "anchor": {
        "text":       "string",       // required within anchor
        "position":   "above" | "below" | "left" | "right",  // default "below"
        "within":     2,              // spec units, default 2
        "match":      "exact" | "contains",                  // default "contains"
        "occurrence": 1               // default 1
      },
      "tolerance": { "position": 0, "size": 0, "spacing": 0, "fontSize": 0 }
    }]
  }]
}
```
