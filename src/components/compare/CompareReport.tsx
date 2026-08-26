import { lazy, Suspense, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import type { PageSummary } from '../../types/compare';

// marked + DOMPurify are only needed once someone opens the preview.
const ReportViewer = lazy(() => import('./ReportViewer'));

export default function CompareReport() {
  const summary = useCompareStore((s) => s.summary);
  const computingSummary = useCompareStore((s) => s.computingSummary);
  const progress = useCompareStore((s) => s.summaryProgress);
  const computeAll = useCompareStore((s) => s.computeAll);
  const setCurrentPage = useCompareStore((s) => s.setCurrentPage);
  const setMode = useCompareStore((s) => s.setMode);
  const { contentPct, pixelPct, offsetIn } = useCompareStore((s) => s.reportThresholds);
  const setThreshold = useCompareStore((s) => s.setReportThreshold);

  const [viewerOpen, setViewerOpen] = useState(false);

  const judge = (p: PageSummary) =>
    !p.missing &&
    p.contentMatch * 100 >= contentPct &&
    p.pixelRatio * 100 <= pixelPct &&
    p.maxOffset / p.pxPerInch <= offsetIn;

  const overallPass = summary ? summary.pages.every(judge) : false;

  const drillTo = (i: number) => {
    setCurrentPage(i);
    setMode('layout');
  };

  return (
    <div className="stack-col">
      {/* Controls */}
      <div className="card section-pad">
        <div className="report-controls">
          <button className="btn primary" onClick={computeAll} disabled={computingSummary}>
            {computingSummary ? (
              <>
                <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} />
                Comparing {progress?.current}/{progress?.total}…
              </>
            ) : summary ? (
              'Re-run all pages'
            ) : (
              'Compare all pages'
            )}
          </button>

          <div className="thresh-group">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>PASS if</span>
            <label className="thresh">
              content ≥
              <input type="number" value={contentPct} onChange={(e) => setThreshold('contentPct', Number(e.target.value))} />%
            </label>
            <label className="thresh">
              pixels ≤
              <input type="number" value={pixelPct} onChange={(e) => setThreshold('pixelPct', Number(e.target.value))} />%
            </label>
            <label className="thresh">
              offset ≤
              <input type="number" step={0.01} value={offsetIn} onChange={(e) => setThreshold('offsetIn', Number(e.target.value))} />in
            </label>
          </div>

          <div className="spacer" />

          {summary && (
            <span className={`verdict-badge ${overallPass ? 'pass' : 'fail'}`}>
              {overallPass ? '✓ PASS' : '✗ FAIL'}
            </span>
          )}

          <button
            className="btn"
            disabled={!summary}
            onClick={() => setViewerOpen(true)}
            title={summary ? 'Read the reports without downloading them' : 'Compare all pages first'}
          >
            👁 View reports
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {!summary ? (
          <div className="stage-notice">Run a full comparison to see the per-page report.</div>
        ) : (
          <table className="report">
            <thead>
              <tr>
                <th>Page</th>
                <th>Content match</th>
                <th>Pixels different</th>
                <th>Max offset</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {summary.pages.map((p) => {
                const pass = judge(p);
                return (
                  <tr key={p.pageIndex} onClick={() => drillTo(p.pageIndex)} title="Open this page in Layout view">
                    <td>{p.pageIndex + 1}</td>
                    <td>{p.missing ? '—' : `${(p.contentMatch * 100).toFixed(1)}%`}</td>
                    <td>{p.missing ? '—' : `${(p.pixelRatio * 100).toFixed(1)}%`}</td>
                    <td>{p.missing ? '—' : `${(p.maxOffset / p.pxPerInch).toFixed(2)}″`}</td>
                    <td className={p.missing ? '' : pass ? 'res-pass' : 'res-fail'}>
                      {p.missing ? <span className="badge-missing">missing</span> : pass ? '✓' : '✗'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {viewerOpen && (
        <Suspense
          fallback={
            <div className="viewer-backdrop">
              <div className="loading-center">
                <span className="spinner" /> Loading viewer…
              </div>
            </div>
          }
        >
          <ReportViewer onClose={() => setViewerOpen(false)} />
        </Suspense>
      )}

    </div>
  );
}
