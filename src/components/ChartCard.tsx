import React, { useEffect, useState } from 'react';
import { Maximize2, Download, FilterX, X } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  isFiltered?: boolean;
  onClearFilter?: () => void;
  onExportCsv?: () => void;
  heightClass?: string;
  children: (expanded: boolean) => React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  isFiltered,
  onClearFilter,
  onExportCsv,
  heightClass = 'h-72',
  children,
}) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <>
      <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] hay-card-shadow p-5 flex flex-col min-w-0 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0A2540] dark:text-[#F8FAFC] leading-snug truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isFiltered && onClearFilter && (
              <button
                type="button"
                onClick={onClearFilter}
                title="Clear chart filter"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-[#EEF2FF] dark:bg-[#7C6BFF]/15 text-[#533AFD] dark:text-[#7C6BFF] hover:bg-[#533AFD]/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                title="Export chart data CSV"
                aria-label={`Export ${title} CSV`}
                className="p-1.5 rounded-lg text-[#425466] dark:text-slate-400 hover:text-[#0A2540] dark:hover:text-white hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title="Expand chart"
              aria-label={`Expand ${title}`}
              className="p-1.5 rounded-lg text-[#425466] dark:text-slate-400 hover:text-[#0A2540] dark:hover:text-white hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className={`w-full min-w-0 ${heightClass}`}>{children(false)}</div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-[#071321]/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-2xl w-full max-w-5xl p-6 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-[#0A2540] dark:text-[#F8FAFC]">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-[#425466] dark:text-slate-400 mt-0.5">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isFiltered && onClearFilter && (
                  <button
                    type="button"
                    onClick={onClearFilter}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-[#EEF2FF] dark:bg-[#7C6BFF]/15 text-[#533AFD] dark:text-[#7C6BFF] hover:bg-[#533AFD]/20 cursor-pointer"
                  >
                    <FilterX className="w-3.5 h-3.5" />
                    <span>Clear Filter</span>
                  </button>
                )}
                {onExportCsv && (
                  <button
                    type="button"
                    onClick={onExportCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-200 hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label="Close expanded chart"
                  className="p-2 rounded-lg text-slate-500 hover:text-[#0A2540] dark:hover:text-white hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="w-full min-w-0 h-[520px]">{children(true)}</div>
          </div>
        </div>
      )}
    </>
  );
};
