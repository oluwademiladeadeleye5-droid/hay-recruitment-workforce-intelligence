import React, { useMemo } from 'react';
import {
  Sparkles,
  FilterX,
  Eye,
  AlertTriangle,
  Users,
  Lightbulb,
  SlidersHorizontal,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { FilterBar } from '../components/FilterBar';
import { ExecutiveKpiRow } from '../components/ExecutiveKpiRow';
import { ExecutiveCharts } from '../components/ExecutiveCharts';

export const ExecutiveOverviewPage: React.FC = () => {
  const {
    dataset,
    filteredRecords,
    kpis,
    overallKpis,
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

      {/* Quick-Jump Workspace Pills */}
      <nav
        aria-label="Explore Workspace"
        className="flex flex-wrap items-center gap-2 no-print"
      >
        <span className="text-xs font-semibold text-[#425466] dark:text-slate-400 mr-1">
          Explore Workspace:
        </span>
        <button
          type="button"
          onClick={() => setActivePage('watchlist')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-200 hover:border-[#E11D48] hover:text-[#E11D48] dark:hover:text-[#FB7185] transition-colors cursor-pointer whitespace-nowrap"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#E11D48] dark:text-[#FB7185]" />
          <span>Who Needs Help ({overallKpis.needsAttentionCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePage('directory')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-200 hover:border-[#00A859] hover:text-[#008A48] dark:hover:text-[#10B981] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Users className="w-3.5 h-3.5 text-[#00A859] dark:text-[#10B981]" />
          <span>All Staff ({dataset.records.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePage('insights')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-200 hover:border-[#533AFD] hover:text-[#533AFD] dark:hover:text-[#7C6BFF] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Lightbulb className="w-3.5 h-3.5 text-[#533AFD] dark:text-[#7C6BFF]" />
          <span>Insights & AI Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePage('data-hub')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-200 hover:border-[#00A859] hover:text-[#008A48] dark:hover:text-[#10B981] transition-colors cursor-pointer whitespace-nowrap"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#00A859] dark:text-[#10B981]" />
          <span>Upload & Settings</span>
        </button>
      </nav>

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
