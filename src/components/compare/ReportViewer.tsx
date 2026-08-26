import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { useCompareStore } from '../../store/compareStore';
import { buildHtmlReport, download, stamp, type ExportMeta } from '../../services/exportReport';
import { buildMarkdownReport } from '../../services/exportMarkdown';

type Tab = 'html' | 'md';

const TABS: [Tab, string][] = [
  ['html', 'HTML report'],
  ['md', 'Markdown fix-list'],
];

/**
 * Full-screen preview of the exportable reports.
 *
 * The HTML report goes into a sandboxed iframe rather than being injected into
 * the page: it ships its own stylesheet with bare-element selectors that would
 * otherwise repaint the whole app. Markdown is rendered with marked and passed
 * through DOMPurify — the report embeds text lifted out of the PDFs, which is
 * untrusted input no matter how it looks.
 */
export default function ReportViewer({ onClose }: { onClose: () => void }) {
  const summary = useCompareStore((s) => s.summary);
  const pageCache = useCompareStore((s) => s.pageCache);
  const sideA = useCompareStore((s) => s.sideA);
  const sideB = useCompareStore((s) => s.sideB);
  const thresholds = useCompareStore((s) => s.reportThresholds);

  const [tab, setTab] = useState<Tab>('html');
  const [html, setHtml] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [mdHtml, setMdHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const meta: ExportMeta = {
    nameA: sideA?.name ?? 'Golden PDF',
    nameB: sideB?.name ?? 'PDF to test',
    pageCountA: sideA?.pageCount ?? 0,
    pageCountB: sideB?.pageCount ?? 0,
    generatedAt: new Date().toISOString(),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Thresholds and the page cache are both live: if either moves while the
  // viewer is open, the cached render is stale and must be thrown away.
  useEffect(() => {
    setHtml(null);
    setMarkdown(null);
    setMdHtml(null);
  }, [summary, thresholds, pageCache]);

  // Each report is built once, on first view of its tab — the HTML one rescales
  // every page image, which is slow enough to be worth not repeating.
  useEffect(() => {
    if (!summary) return;
    let cancelled = false;

    if (tab === 'html' && html === null) {
      setBusy(true);
      buildHtmlReport(summary, meta, thresholds, pageCache)
        .then((out) => {
          if (!cancelled) setHtml(out);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }

    if (tab === 'md' && markdown === null) {
      setBusy(true);
      const md = buildMarkdownReport(summary, meta, thresholds, pageCache);
      const rendered = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
      setMarkdown(md);
      setMdHtml(DOMPurify.sanitize(rendered));
      setBusy(false);
    }

    return () => {
      cancelled = true;
    };
    // meta carries a fresh timestamp each render; the report content depends on
    // the comparison, not on when this effect happened to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, summary, pageCache, thresholds, html, markdown]);

  if (!summary) return null;

  const printHtml = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const saveCurrent = () => {
    if (tab === 'html' && html) download(`pdf-comparison-report-${stamp()}.html`, html, 'text/html');
    if (tab === 'md' && markdown) download(`pdf-remediation-${stamp()}.md`, markdown, 'text/markdown');
  };

  return (
    <div className="viewer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label="Report preview">
        <div className="viewer-head">
          <div className="tabs">
            {TABS.map(([id, label]) => (
              <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          <span className="viewer-sub">
            {meta.nameA} vs {meta.nameB}
          </span>

          <div className="spacer" />

          {tab === 'html' && (
            <button className="btn sm" onClick={printHtml} disabled={!html} title="Print, or save as PDF">
              Print
            </button>
          )}
          <button className="btn sm" onClick={saveCurrent} disabled={tab === 'html' ? !html : !markdown}>
            Download
          </button>
          <button className="btn sm" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className="viewer-body">
          {busy && (
            <div className="loading-center">
              <span className="spinner" /> Building {tab === 'html' ? 'HTML report' : 'Markdown'}…
            </div>
          )}

          {!busy && tab === 'html' && html && (
            <iframe
              ref={frameRef}
              className="viewer-frame"
              title="HTML report"
              srcDoc={html}
              // No allow-scripts: the report is static, and this keeps text
              // pulled out of the PDFs from ever executing.
              sandbox="allow-same-origin allow-modals allow-popups"
            />
          )}

          {!busy && tab === 'md' && mdHtml && (
            <div className="viewer-md">
              <div className="md-body" dangerouslySetInnerHTML={{ __html: mdHtml }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
