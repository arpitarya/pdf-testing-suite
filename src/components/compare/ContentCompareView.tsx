import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import type { CompareSide, RenderedPageImage } from '../../types/compare';
import {
  buildChanges,
  changeSummary,
  fmtInch,
  isOnSide,
  TYPE_LABEL,
  type Change,
  type ChangeType,
} from '../../services/changes';
import { ignoredList, ignoredRefsFor, useIgnoreStore } from '../../store/ignoreStore';
import AnnotationLayer, { AnnotationToolbar } from './AnnotationLayer';
import { flags } from '../../flags';

const TYPE_ORDER: ChangeType[] = ['removed', 'added', 'styled', 'moved'];

const LEGEND_HELP =
  'Removed / added = the words changed. Restyled = same words, different type. Moved = same words and type, shifted.\n\nClick a type to filter it out. Hover a change to link it to the page.';

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

type DrawerTab = 'changes' | 'diff' | 'ignored';

// Fit height for a page in this view. Two pages sit side by side, so this is
// shorter than the single-stage Overlapping view uses.
const MAX_DISPLAY_H = 520;
/** Gap between the two page frames, matching .pages-row in the stylesheet. */
const PAGE_GAP = 16;

// ── Rendered page with change boxes overlaid ──────────────────────────
function PageWithBoxes({
  image,
  side,
  label,
  changes,
  hlGroup,
  setHighlighted,
  currentPage,
  dispW,
  dispH,
}: {
  image: RenderedPageImage | null;
  side: CompareSide;
  label: string;
  changes: Change[];
  hlGroup: number | null;
  setHighlighted: (id: number | null) => void;
  currentPage: number;
  dispW: number;
  dispH: number;
}) {
  const boxes = changes.filter((c) => isOnSide(c, side));

  return (
    <div className="page-frame">
      <div className="plabel">{label}</div>
      {image ? (
        <div className="page-overlay-wrap" style={{ width: dispW, height: dispH }}>
          <img src={image.dataUrl} alt={`Page ${side}`} style={{ width: dispW, height: dispH }} />
          {boxes.map((c) => {
            const box = (side === 'A' ? c.a : c.b)!;
            return (
              <div
                key={c.id}
                className={`chg-box chg-${c.type} ${c.group === hlGroup ? 'hl' : ''}`}
                style={{
                  left: `${(box.x / image.width) * 100}%`,
                  top: `${(box.y / image.height) * 100}%`,
                  width: `${(box.w / image.width) * 100}%`,
                  height: `${(box.h / image.height) * 100}%`,
                }}
                onMouseEnter={() => setHighlighted(c.id)}
                onMouseLeave={() => setHighlighted(null)}
                title={`${TYPE_LABEL[c.type]}: ${c.text}`}
              >
                <span className="chg-num-badge">{c.label}</span>
              </div>
            );
          })}
          {flags.annotations && <AnnotationLayer page={currentPage} side={side} />}
        </div>
      ) : (
        <div className="page-missing" style={{ width: dispW, height: dispH }}>
          No page {currentPage + 1} on this side.
        </div>
      )}
    </div>
  );
}

export default function ContentCompareView() {
  const currentPage = useCompareStore((s) => s.currentPage);
  const pc = useCompareStore((s) => s.pageCache[s.currentPage]);
  const computing = useCompareStore((s) => s.computing);
  const movedThreshold = useCompareStore((s) => s.offsetThresholdIn);
  const contentZoom = useCompareStore((s) => s.contentZoom);
  const ignoredMap = useIgnoreStore((s) => s.ignored);
  const ignoreChange = useIgnoreStore((s) => s.ignore);
  const restoreChange = useIgnoreStore((s) => s.restore);
  const setContentZoom = useCompareStore((s) => s.setContentZoom);

  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stageW, setStageW] = useState(0);
  /** The change whose ⋯ menu is open, which step it is on, and the reason typed so far. */
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [menuStep, setMenuStep] = useState<'menu' | 'reason'>('menu');
  const [reason, setReason] = useState('');
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('changes');
  const [enabled, setEnabled] = useState<Record<ChangeType, boolean>>({
    removed: true,
    added: true,
    styled: true,
    moved: true,
  });

  const ignoredKeys = useMemo(() => ignoredRefsFor(ignoredMap, currentPage), [ignoredMap, currentPage]);
  const ignoredHere = useMemo(
    () => ignoredList(ignoredMap).filter((e) => e.page === currentPage).length,
    [ignoredMap, currentPage],
  );
  const allIgnored = useMemo(() => ignoredList(ignoredMap), [ignoredMap]);

  // Everything downstream — the page boxes, the counts, the list, the filters —
  // works from the surviving changes, so one filter here removes an ignored
  // difference from the whole view.
  const allChanges = useMemo(
    () => (pc ? buildChanges(pc, movedThreshold) : []),
    [pc, movedThreshold],
  );
  const changes = useMemo(
    () => allChanges.filter((c) => !ignoredKeys.has(c.key)),
    [allChanges, ignoredKeys],
  );

  const counts = useMemo(() => {
    const c: Record<ChangeType, number> = { removed: 0, added: 0, styled: 0, moved: 0 };
    for (const ch of changes) c[ch.type]++;
    return c;
  }, [changes]);

  const visible = useMemo(() => changes.filter((c) => enabled[c.type]), [changes, enabled]);

  // The highlight group of the hovered change — paired removed/added share a group,
  // so hovering either half lights up both.
  const groupById = useMemo(() => new Map(changes.map((c) => [c.id, c.group])), [changes]);
  const labelById = useMemo(() => new Map(changes.map((c) => [c.id, c.label])), [changes]);
  const hlGroup = highlighted != null ? groupById.get(highlighted) ?? null : null;

  // Fit has to mean "fits", so it answers to the width actually on offer as
   // well as a height cap — the column narrows when the drawer opens, and laptop
   // viewports vary. Measured on the card rather than the page row, since the
   // row's own width follows the pages and would feed back into itself.
  const roRef = useRef<ResizeObserver | null>(null);
  const measureStage = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    roRef.current = ro;
    setStageW(el.clientWidth);
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  useEffect(() => {
    if (menuFor == null) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.chg-more')) setMenuFor(null);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuFor]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Map normalized change text → change id, so word-diff spans can link to a box.
  const textToChange = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of visible) {
      const key = normalize(c.text);
      if (key && !m.has(key)) m.set(key, c.id);
    }
    return m;
  }, [visible]);

  if (computing && !pc) {
    return (
      <div className="loading-center">
        <span className="spinner" /> Computing page comparison…
      </div>
    );
  }
  if (!pc) return <div className="loading-center">Preparing…</div>;

  const refImg = pc.imageA ?? pc.imageB;
  const widthFit = refImg && stageW ? (stageW - PAGE_GAP) / (refImg.width * 2) : 1;
  const fitScale = refImg ? Math.min(1, MAX_DISPLAY_H / refImg.height, widthFit) : 1;
  const dispScale = fitScale * contentZoom;
  const dispW = refImg ? refImg.width * dispScale : 0;
  const dispH = refImg ? refImg.height * dispScale : 0;
  const zoomPct = Math.round(dispScale * 100);

  const bothEmpty = !pc.textA && !pc.textB;

  return (
    <div className={`stack-col content-view ${drawerOpen ? 'drawer-open' : ''}`}>
      {/* Rendered pages with change highlights */}
      <div className="card section-pad" ref={measureStage}>
        <div className="overlay-legend">
          <div className="legend-chips">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                className={`legend-toggle ${enabled[t] ? 'on' : 'off'}`}
                disabled={counts[t] === 0}
                onClick={() => setEnabled((p) => ({ ...p, [t]: !p[t] }))}
                title={`Show / hide ${TYPE_LABEL[t].toLowerCase()} changes`}
              >
                <i className={`dot ${t}`} /> {TYPE_LABEL[t]} <span className="cnt">{counts[t]}</span>
              </button>
            ))}
            {/* The full explanation is a tooltip rather than a paragraph: it is
                read once, but it was crowding the bar on every page. */}
            <button className="legend-info" title={LEGEND_HELP} aria-label="What the change types mean">
              ?
            </button>
          </div>

          <div className="spacer" />

          {flags.annotations && <AnnotationToolbar page={currentPage} />}

          <div className="zoom-group" title="Zoom the page view">
            <button className="zoombtn" onClick={() => setContentZoom(contentZoom / 1.25)} title="Zoom out">
              −
            </button>
            <span className="zoom-label">{zoomPct}%</span>
            <button className="zoombtn" onClick={() => setContentZoom(contentZoom * 1.25)} title="Zoom in">
              +
            </button>
            <button className="btn sm" onClick={() => setContentZoom(1)} title="Fit to view">
              Fit
            </button>
            {fitScale > 0 && (
              <button className="btn sm" onClick={() => setContentZoom(1 / fitScale)} title="Actual pixel size">
                1:1
              </button>
            )}
          </div>

          <button
            className={`btn sm view-changes ${drawerOpen ? 'on' : ''}`}
            onClick={() => setDrawerOpen((o) => !o)}
            aria-expanded={drawerOpen}
            title="Open the change list and the verbiage differences"
          >
            <i className="drawer-ico" aria-hidden="true">
              <span />
            </i>
            View changes{changes.length > 0 ? ` · ${changes.length}` : ''}
            {ignoredHere > 0 && <span className="ign-badge">{ignoredHere} ignored</span>}
          </button>
        </div>
        <div className="pages-row">
          <PageWithBoxes
            image={pc.imageA}
            side="A"
            label="Golden PDF"
            changes={visible}
            hlGroup={hlGroup}
            setHighlighted={setHighlighted}
            currentPage={currentPage}
            dispW={dispW}
            dispH={dispH}
          />
          <PageWithBoxes
            image={pc.imageB}
            side="B"
            label="PDF to test"
            changes={visible}
            hlGroup={hlGroup}
            setHighlighted={setHighlighted}
            currentPage={currentPage}
            dispW={dispW}
            dispH={dispH}
          />
        </div>
      </div>

      {/* Notes */}
      {pc.notes.length > 0 && (
        <div className="notes-box">
          <strong>Notes</strong>
          <ul>
            {pc.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* The change list and the word diff are reference material read against
          the pages, not something to scroll past to reach them — so they live in
          a drawer. Deliberately non-modal: hovering an entry highlights its box
          on the pages, which have to stay visible. */}
      {drawerOpen && (
        <aside className="chg-drawer" role="dialog" aria-label="Changes on this page">
          <div className="chg-drawer-head">
            <div className="tabs">
              <button
                className={`tab ${drawerTab === 'changes' ? 'active' : ''}`}
                onClick={() => setDrawerTab('changes')}
              >
                Changes{changes.length > 0 ? ` · ${visible.length}` : ''}
              </button>
              <button
                className={`tab ${drawerTab === 'diff' ? 'active' : ''}`}
                onClick={() => setDrawerTab('diff')}
              >
                Verbiage differences
              </button>
              <button
                className={`tab ${drawerTab === 'ignored' ? 'active' : ''}`}
                onClick={() => setDrawerTab('ignored')}
              >
                Ignored{allIgnored.length > 0 ? ` · ${allIgnored.length}` : ''}
              </button>
            </div>
            <span className="spacer" />
            <button className="btn sm" onClick={() => setDrawerOpen(false)} title="Close (Esc)">
              ✕
            </button>
          </div>

          <div className="chg-drawer-body">
            {drawerTab === 'changes' ? (
              changes.length === 0 ? (
                <div className="chg-empty">
                  ✓ No positional text changes detected on page {currentPage + 1}.
                </div>
              ) : visible.length === 0 ? (
                <div className="chg-empty muted-empty">
                  All change types are hidden — enable a filter in the toolbar.
                </div>
              ) : (
                <div className="chg-list">
                  {visible.map((c) => (
                      <div
                        key={c.id}
                        className={`chg-item ${c.group === hlGroup ? 'hl' : ''}`}
                        onMouseEnter={() => setHighlighted(c.id)}
                        onMouseLeave={() => setHighlighted(null)}
                      >
                        <span className={`chg-num chg-${c.type}`}>{c.label}</span>
                        <span className={`chg-chip chg-${c.type}`}>{TYPE_LABEL[c.type]}</span>
                        <span className="chg-text" title={c.text}>{c.text}</span>

                        <span className="chg-more">
                          <button
                            className="chg-more-btn"
                            title="Mark this difference as expected"
                            aria-label="Difference options"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReason('');
                              setMenuStep('menu');
                              setMenuFor(menuFor === c.id ? null : c.id);
                            }}
                          >
                            ⋯
                          </button>

                          {menuFor === c.id && menuStep === 'menu' && (
                            <div className="chg-menu compact" onClick={(e) => e.stopPropagation()}>
                              <button className="chg-menu-item" onClick={() => setMenuStep('reason')}>
                                Ignore this difference
                                <small>Expected — remove it from the comparison</small>
                              </button>
                            </div>
                          )}

                          {menuFor === c.id && menuStep === 'reason' && (
                            <div className="chg-menu" onClick={(e) => e.stopPropagation()}>
                              <div className="chg-menu-head">Why is this expected?</div>
                              <textarea
                                autoFocus
                                value={reason}
                                placeholder="Optional — recorded in the report"
                                onChange={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setMenuFor(null);
                                }}
                              />
                              <div className="chg-menu-foot">
                                <button className="btn sm" onClick={() => setMenuStep('menu')}>
                                  Back
                                </button>
                                <span className="spacer" />
                                <button
                                  className="btn sm primary"
                                  onClick={() => {
                                    const members = allChanges.filter((m) => m.group === c.group);
                                    ignoreChange({
                                      page: currentPage,
                                      key: c.key,
                                      label: c.label,
                                      summary: changeSummary(members),
                                      reason: reason.trim(),
                                    });
                                    setMenuFor(null);
                                    setReason('');
                                  }}
                                >
                                  Ignore
                                </button>
                              </div>
                            </div>
                          )}
                        </span>
                        {/* Only what changed — an added or removed run has no
                            second line, since its coordinates say nothing the
                            highlighted box on the page does not already show. */}
                        {c.type === 'styled' && c.style ? (
                          <span className="chg-pos">{c.style.summary}</span>
                        ) : c.type === 'moved' && c.offset != null ? (
                          <span className="chg-pos">moved {fmtInch(c.offset, pc.pxPerInch)}</span>
                        ) : null}
                      </div>
                  ))}
                </div>
              )
            ) : drawerTab === 'ignored' ? (
              allIgnored.length === 0 ? (
                <div className="chg-empty muted-empty">
                  Nothing ignored. Use the ⋯ menu on a change to mark it as expected.
                </div>
              ) : (
                <div className="ign-list">
                  {allIgnored.map((e) => (
                    <div key={e.ref} className="ign-item">
                      <div className="ign-head">
                        <span className="ign-page">Page {e.page + 1}</span>
                        <span className="spacer" />
                        <button
                          className="btn sm"
                          onClick={() => restoreChange(e.ref)}
                          title="Put this difference back into the comparison"
                        >
                          Undo
                        </button>
                      </div>
                      <div className="ign-summary">{e.summary}</div>
                      {e.reason ? (
                        <div className="ign-reason">{e.reason}</div>
                      ) : (
                        <div className="ign-reason none">No reason given</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : bothEmpty ? (
              <div className="diff-box">No selectable text on this page to diff.</div>
            ) : (
              <div className="diff-box">
                {pc.diff.map((seg, i) => {
                  const kind = seg.added ? 'added' : seg.removed ? 'removed' : '';
                  const linkId = kind ? textToChange.get(normalize(seg.value)) : undefined;
                  const linkGroup = linkId != null ? groupById.get(linkId) ?? null : null;
                  return (
                    <span
                      key={i}
                      className={`${kind} ${linkId != null ? 'locatable' : ''} ${
                        linkGroup != null && linkGroup === hlGroup ? 'hl' : ''
                      }`}
                      onMouseEnter={linkId != null ? () => setHighlighted(linkId) : undefined}
                      onMouseLeave={linkId != null ? () => setHighlighted(null) : undefined}
                      title={linkId != null ? `Change #${labelById.get(linkId) ?? linkId} — highlighted on the page` : undefined}
                    >
                      {seg.value}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
