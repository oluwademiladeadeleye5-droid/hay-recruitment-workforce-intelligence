import React, { useState } from 'react';
import {
  Users,
  Smile,
  AlertTriangle,
  Clock,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';

export const ExecutiveKpiRow: React.FC = () => {
  const {
    kpis,
    filters,
    settings,
    toggleFilter,
    resetAllFilters,
    setActivePage,
  } = useWorkforce();

  const [openTip, setOpenTip] = useState<string | null>(null);

  const isAttentionFiltered = filters.attentionStatuses.includes('Needs Attention');
  const isCriticalFiltered = filters.workloadLevels.includes('Critical');
  const moodHealthy = kpis.avgEngagement >= settings.thresholds.engagementTarget;

  const InfoBadge: React.FC<{ id: string; text: string; lightOnDark?: boolean }> = ({
    id,
    text,
    lightOnDark = false,
  }) => {
    const visible = openTip === id;
    return (
      <div
        className="relative inline-flex"
        onMouseEnter={() => setOpenTip(id)}
        onMouseLeave={() => setOpenTip((cur) => (cur === id ? null : cur))}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label={text}
          onClick={(e) => {
            e.stopPropagation();
            setOpenTip((cur) => (cur === id ? null : id));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              setOpenTip((cur) => (cur === id ? null : id));
            }
          }}
          className={`p-0.5 rounded-full cursor-help transition-colors ${
            lightOnDark
              ? 'text-white/80 hover:text-white'
              : 'text-slate-400 hover:text-[#533AFD] dark:hover:text-[#7C6BFF]'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
        </span>
        {visible && (
          <div className="absolute right-0 bottom-full mb-2 w-56 z-30 rounded-xl bg-[#0A2540] text-white text-[11px] leading-relaxed p-2.5 shadow-xl border border-[#533AFD]/40 pointer-events-none">
            {text}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Total Staff */}
      <button
        type="button"
        onClick={() => resetAllFilters()}
        className="group relative text-left bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD]/60 dark:hover:border-[#7C6BFF]/60 shadow-sm p-5 transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#533AFD]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#533AFD] dark:text-[#7C6BFF]" />
            <span className="text-xs font-semibold text-[#425466] dark:text-slate-300">
              Total Staff
            </span>
          </div>
          <InfoBadge
            id="kpi-total"
            text="Everyone currently shown. Click to reset filters and show the whole company."
          />
        </div>
        <div className="mt-2.5 text-3xl font-extrabold text-[#0A2540] dark:text-white tabular-nums">
          {kpis.totalWorkforce.toLocaleString()}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#425466] dark:text-slate-300 tabular-nums">
          <span>Present {kpis.presentCount}</span>
          <span aria-hidden="true">·</span>
          <span>Remote {kpis.remoteCount}</span>
          <span aria-hidden="true">·</span>
          <span>Leave {kpis.leaveCount}</span>
          <span aria-hidden="true">·</span>
          <span>Absent {kpis.absentCount}</span>
        </div>
        <span className="block mt-2 text-[10px] font-medium text-[#533AFD] dark:text-[#7C6BFF] opacity-0 group-hover:opacity-100 transition-opacity">
          Click to show everyone
        </span>
      </button>

      {/* 2. Team Mood (Avg Engagement) */}
      <button
        type="button"
        onClick={() => setActivePage('directory')}
        className="group relative text-left bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD]/60 shadow-sm p-5 transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#533AFD]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-[#00A859] dark:text-[#10B981]" />
            <span className="text-xs font-semibold text-[#425466] dark:text-slate-300">
              Team Mood
            </span>
          </div>
          <InfoBadge
            id="kpi-mood"
            text="Average engagement score out of 100 across the selected staff. Higher is better."
          />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
          <span className="text-3xl font-extrabold text-[#0A2540] dark:text-white">
            {kpis.avgEngagement}
          </span>
          <span className="text-xs text-slate-400">/ 100</span>
          <span
            className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              moodHealthy
                ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#008A48] dark:text-[#10B981]'
                : 'bg-[#FFFBEB] dark:bg-[#FBBF24]/15 text-[#B45309] dark:text-[#FBBF24]'
            }`}
          >
            {moodHealthy ? 'Healthy' : 'Needs Boost'}
          </span>
        </div>
        <div className="mt-2.5 text-xs text-[#425466] dark:text-slate-300 tabular-nums">
          Goal: {settings.thresholds.engagementTarget} or higher
        </div>
        <span className="block mt-2 text-[10px] font-medium text-[#533AFD] dark:text-[#7C6BFF] opacity-0 group-hover:opacity-100 transition-opacity">
          Click to view staff mood
        </span>
      </button>

      {/* 3. Needs Check-In */}
      <button
        type="button"
        onClick={(e) => toggleFilter('attentionStatuses', 'Needs Attention', e.ctrlKey || e.metaKey)}
        className={`group relative text-left rounded-2xl border shadow-sm p-5 transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#533AFD] ${
          isAttentionFiltered
            ? 'bg-[#E11D48] text-white border-[#533AFD] ring-2 ring-[#533AFD]/45'
            : 'bg-[#FFF1F2] dark:bg-[#FB7185]/10 border-[#E11D48]/30 dark:border-[#FB7185]/35 hover:border-[#E11D48]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle
              className={`w-4 h-4 ${
                isAttentionFiltered ? 'text-white' : 'text-[#E11D48] dark:text-[#FB7185]'
              }`}
            />
            <span
              className={`text-xs font-bold ${
                isAttentionFiltered ? 'text-white' : 'text-[#E11D48] dark:text-[#FB7185]'
              }`}
            >
              Needs Check-In
            </span>
          </div>
          <InfoBadge
            id="kpi-checkin"
            lightOnDark={isAttentionFiltered}
            text="Staff flagged for low mood, late tasks, or heavy workload. Click to filter the whole page to them."
          />
        </div>
        <div
          className={`mt-2.5 flex items-baseline gap-2 tabular-nums ${
            isAttentionFiltered ? 'text-white' : 'text-[#E11D48] dark:text-[#FB7185]'
          }`}
        >
          <span className="text-3xl font-extrabold">{kpis.needsAttentionCount.toLocaleString()}</span>
          <span className="text-xs font-semibold">({kpis.needsAttentionRate}%)</span>
        </div>
        <div
          className={`mt-2.5 text-xs ${
            isAttentionFiltered ? 'text-white/90' : 'text-[#425466] dark:text-slate-300'
          }`}
        >
          {isAttentionFiltered ? 'Filtered to flagged staff' : 'People needing support'}
        </div>
        <span
          className={`block mt-2 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
            isAttentionFiltered ? 'text-white' : 'text-[#E11D48] dark:text-[#FB7185]'
          }`}
        >
          {isAttentionFiltered ? 'Click to clear filter' : 'Click to filter'}
        </span>
      </button>

      {/* 4. Open Tasks */}
      <button
        type="button"
        onClick={() => setActivePage('directory')}
        className="group relative text-left bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD]/60 shadow-sm p-5 transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#533AFD]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24]" />
            <span className="text-xs font-semibold text-[#425466] dark:text-slate-300">
              Open Tasks
            </span>
          </div>
          <InfoBadge
            id="kpi-open"
            text="Total tasks still in progress across the selected staff, plus the average per person."
          />
        </div>
        <div className="mt-2.5 text-3xl font-extrabold text-[#0A2540] dark:text-white tabular-nums">
          {kpis.pendingTasks.toLocaleString()}
        </div>
        <div className="mt-2.5 text-xs text-[#425466] dark:text-slate-300 tabular-nums">
          About {kpis.avgPendingPerEmployee} open per person
        </div>
        <span className="block mt-2 text-[10px] font-medium text-[#533AFD] dark:text-[#7C6BFF] opacity-0 group-hover:opacity-100 transition-opacity">
          Click to view staff tasks
        </span>
      </button>

      {/* 5. Late Tasks */}
      <button
        type="button"
        onClick={(e) => toggleFilter('workloadLevels', 'Critical', e.ctrlKey || e.metaKey)}
        className={`group relative text-left bg-white dark:bg-[#0F2035] rounded-2xl border shadow-sm p-5 transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#533AFD] ${
          isCriticalFiltered
            ? 'border-[#533AFD] ring-1 ring-[#533AFD]/45'
            : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD]/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-[#E11D48] dark:text-[#FB7185]" />
            <span className="text-xs font-semibold text-[#425466] dark:text-slate-300">
              Late Tasks
            </span>
          </div>
          <InfoBadge
            id="kpi-late"
            text="Tasks past their due date across the selected team. Click to see the busiest staff."
          />
        </div>
        <div className="mt-2.5 text-3xl font-extrabold text-[#E11D48] dark:text-[#FB7185] tabular-nums">
          {kpis.overdueTasks.toLocaleString()}
        </div>
        <div className="mt-2.5 text-xs text-[#425466] dark:text-slate-300 tabular-nums">
          {kpis.overdueShareOfTotal}% of all assigned tasks
        </div>
        <span className="block mt-2 text-[10px] font-medium text-[#533AFD] dark:text-[#7C6BFF] opacity-0 group-hover:opacity-100 transition-opacity">
          {isCriticalFiltered ? 'Click to clear filter' : 'Click to filter'}
        </span>
      </button>
    </div>
  );
};
