import React, { useMemo } from 'react';
import { Sparkles, FilterX, Eye } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { FilterBar } from '../components/FilterBar';
import { ExecutiveKpiRow } from '../components/ExecutiveKpiRow';
import { ExecutiveCharts } from '../components/ExecutiveCharts';

export const ExecutiveOverviewPage: React.FC = () => {
  const {
    dataset,
    filteredRecords,
    kpis,
    isFiltered,
    resetAllFilters,
    setActivePage,
  } = useWorkforce();

  const summarySentence = useMemo(() => {
    if (filteredRecords.length === 0) {
      return 'No staff match the filters selected right now. Click Show Everyone to reset.';
    }

    // Find top 2 departments with most Needs Check-In staff in the active selection
    const deptCounts = new Map<string, number>();
    filteredRecords.forEach((r) => {
      if (r.attentionStatus === 'Needs Attention') {
        deptCounts.set(r.department, (deptCounts.get(r.department) || 0) + 1);
      }
    });
    const topDepts = Array.from(deptCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);

    const deptNote =
      kpis.needsAttentionCount === 0
        ? 'Everyone in this group is On Track!'
        : topDepts.length >= 2
          ? `most of them are in ${topDepts[0]} and ${topDepts[1]}.`
          : topDepts.length === 1
            ? `mostly in ${topDepts[0]}.`
            : '';

    return `Right now, ${kpis.availableCount.toLocaleString()} of ${kpis.totalWorkforce.toLocaleString()} staff are working (Present or Remote). ${kpis.needsAttentionCount.toLocaleString()} ${
      kpis.needsAttentionCount === 1 ? 'person needs' : 'people need'
    } a check-in${deptNote ? `, ${deptNote}` : '.'}`;
  }, [filteredRecords, kpis]);

  return (
    <div className="space-y-5">
      {/* Live Plain-English Summary Strip */}
      <section className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] hay-card-shadow p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-[#7C6BFF]/15 text-[#533AFD] dark:text-[#7C6BFF] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#533AFD] dark:text-[#7C6BFF]">
              Live Summary · {dataset.sourceType === 'demo' ? 'Sample Team Data' : dataset.filename}
            </p>
            <p className="text-sm sm:text-base font-medium text-[#0A2540] dark:text-white leading-relaxed mt-0.5">
              {summarySentence}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActivePage('watchlist')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold bg-[#FFF1F2] dark:bg-[#FB7185]/15 text-[#E11D48] dark:text-[#FB7185] hover:bg-[#E11D48] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center no-print"
        >
          <Eye className="w-4 h-4" />
          <span>See Who Needs Help ({kpis.needsAttentionCount})</span>
        </button>
      </section>

      {/* Filter Bar + Prominent Reset Banner */}
      <FilterBar />

      {/* 5 Self-Explaining KPI Cards */}
      <ExecutiveKpiRow />

      {/* 4 Question-Driven Charts */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-12 text-center space-y-3">
          <p className="text-base font-bold text-[#0A2540] dark:text-white">
            No staff match those filters
          </p>
          <p className="text-sm text-[#425466] dark:text-slate-400 max-w-md mx-auto">
            Try clearing a filter or click below to show all {dataset.records.length} staff again.
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#533AFD] text-white hover:bg-[#4434D4] cursor-pointer"
            >
              <FilterX className="w-4 h-4" />
              <span>Show Everyone (Reset)</span>
            </button>
          )}
        </div>
      ) : (
        <ExecutiveCharts />
      )}
    </div>
  );
};
