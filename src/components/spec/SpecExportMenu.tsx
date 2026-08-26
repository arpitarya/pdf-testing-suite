import { useEffect, useRef, useState } from 'react';
import { useSpecStore } from '../../store/specStore';
import { exportSpecHtml, exportSpecJson } from '../../services/specExport';

// Header-mounted twin of the compare workspace's ExportMenu: always on screen
// while the spec workspace is active, disabled until a spec run has produced a report.
export default function SpecExportMenu() {
  const report = useSpecStore((s) => s.report);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!report) setMenuOpen(false);
  }, [report]);

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className="btn"
        disabled={!report}
        onClick={() => setMenuOpen((o) => !o)}
        title={report ? 'Export results' : 'Run the spec check first — there is nothing to export yet'}
      >
        ⬇ Export ▾
      </button>
      {menuOpen && report && (
        <div className="export-dropdown">
          <button
            onClick={() => {
              exportSpecHtml(report);
              setMenuOpen(false);
            }}
          >
            HTML report
            <small>Annotated pages + checks · print to PDF</small>
          </button>
          <button
            onClick={() => {
              exportSpecJson(report);
              setMenuOpen(false);
            }}
          >
            JSON
            <small>Full results, machine-readable</small>
          </button>
        </div>
      )}
    </div>
  );
}
