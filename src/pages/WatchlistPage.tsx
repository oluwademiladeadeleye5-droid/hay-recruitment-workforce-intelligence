import React, { useMemo, useState } from 'react';
import { AlertTriangle, Flame, Clock, HeartCrack, Download, ChevronRight } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { FilterBar } from '../components/FilterBar';
import { exportRecordsToCsv, getStressLevel, isHealthyReason } from '../utils/analytics';

type WatchlistTab = 'all' | 'low-engagement' | 'high-overdue' | 'burnout-trap';

export const WatchlistPage: React.FC = () => {
  const { filteredRecords, settings, openEmployeeDrawer, pushToast } = useWorkforce();
  const [tab, setTab] = useState<WatchlistTab>('all');

  const flaggedBase = useMemo(
    () =>
      filteredRecords.filter(
        (r) =>
          r.attentionStatus === 'Needs Attention' ||
          r.engagementScore < settings.thresholds.lowEngagementCutoff ||
          r.overdueTasks >= settings.thresholds.overdueTaskCutoff ||
          r.isBurnoutTrap
      ),
    [filteredRecords, settings.thresholds]
  );

  const tabCounts = useMemo(() => {
    return {
      all: flaggedBase.length,
      lowEngagement: flaggedBase.filter(
        (r) => r.engagementScore < settings.thresholds.lowEngagementCutoff
      ).length,
      highOverdue: flaggedBase.filter(
        (r) => r.overdueTasks >= settings.thresholds.overdueTaskCutoff
      ).length,
      burnoutTrap: flaggedBase.filter((r) => r.isBurnoutTrap).length,
    };
  }, [flaggedBase, settings.thresholds]);

  const queue = useMemo(() => {
    let list = flaggedBase;
    if (tab === 'low-engagement') {
      list = flaggedBase.filter((r) => r.engagementScore < settings.thresholds.lowEngagementCutoff);
    } else if (tab === 'high-overdue') {
      list = flaggedBase.filter((r) => r.overdueTasks >= settings.thresholds.overdueTaskCutoff);
    } else if (tab === 'burnout-trap') {
      list = flaggedBase.filter((r) => r.isBurnoutTrap);
    }
    return [...list].sort((a, b) => b.compositeBurnoutRiskScore - a.compositeBurnoutRiskScore);
  }, [flaggedBase, tab, settings.thresholds]);

  const tabs: Array<{ id: WatchlistTab; label: string; count: number; icon: React.ReactNode }> = [
    {
      id: 'all',
      label: 'All Flagged',
      count: tabCounts.all,
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    {
      id: 'low-engagement',
      label: `Low Mood (< ${settings.thresholds.lowEngagementCutoff})`,
      count: tabCounts.lowEngagement,
      icon: <HeartCrack className="w-3.5 h-3.5" />,
    },
    {
      id: 'high-overdue',
      label: `Too Many Late Tasks (${settings.thresholds.overdueTaskCutoff}+)`,
      count: tabCounts.highOverdue,
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      id: 'burnout-trap',
      label: 'Heavy Workload + Unused Leave',
      count: tabCounts.burnoutTrap,
      icon: <Flame className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
            Who Needs Help
          </h1>
          <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
            Sorted so the people carrying the most stress appear first · Click anyone to see how you can help
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            exportRecordsToCsv(queue, `hay_who_needs_help_${tab}.csv`);
            pushToast({ type: 'success', title: 'List downloaded as CSV' });
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] text-white cursor-pointer whitespace-nowrap shrink-0 self-start"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download List ({queue.length})</span>
        </button>
      </div>

      <FilterBar />

      {/* Plain-English Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F]">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#533AFD] text-white dark:bg-[#7C6BFF]'
                  : 'text-[#425466] dark:text-slate-300 hover:bg-[#F6F9FC] dark:hover:bg-[#162B45]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              <span
                className={`font-mono tabular-nums ${
                  active ? 'text-white/90' : 'text-slate-400'
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Staff Cards */}
      <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-sm overflow-hidden">
        {queue.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#425466] dark:text-slate-400">
            Great news, no one matches this category with your current filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1E3A5F]">
            {queue.map((emp) => {
              const stress = getStressLevel(emp.compositeBurnoutRiskScore);
              const needsCheckIn = emp.attentionStatus === 'Needs Attention';
              const stressDotColor =
                stress === 'High'
                  ? 'bg-[#E11D48] dark:bg-[#FB7185]'
                  : stress === 'Medium'
                    ? 'bg-[#D97706] dark:bg-[#FBBF24]'
                    : 'bg-[#00A859] dark:bg-[#10B981]';
              const stressTextColor =
                stress === 'High'
                  ? 'text-[#E11D48] dark:text-[#FB7185]'
                  : stress === 'Medium'
                    ? 'text-[#D97706] dark:text-[#FBBF24]'
                    : 'text-[#00A859] dark:text-[#10B981]';

              return (
                <button
                  key={emp.employeeId}
                  type="button"
                  onClick={() => openEmployeeDrawer(emp.employeeId)}
                  className="w-full text-left px-5 py-4 hover:bg-[#F6F9FC] dark:hover:bg-[#162B45]/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#533AFD] dark:text-[#7C6BFF]">
                        {emp.employeeId}
                      </span>
                      <span className="font-bold text-sm text-[#0A2540] dark:text-white">
                        {emp.employeeName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          needsCheckIn
                            ? 'bg-[#FFF1F2] dark:bg-[#FB7185]/15 text-[#E11D48] dark:text-[#FB7185]'
                            : 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#008A48] dark:text-[#10B981]'
                        }`}
                      >
                        {needsCheckIn ? 'Needs Check-In' : 'On Track'}
                      </span>
                      <span className="text-[#425466] dark:text-slate-300">
                        {emp.department} · {emp.location}
                      </span>
                    </div>
                    <p className="text-xs text-[#425466] dark:text-slate-300">
                      {!isHealthyReason(emp.attentionReason) ? (
                        <>
                          Highlighted for:{' '}
                          <span className="font-semibold text-[#E11D48] dark:text-[#FB7185]">
                            {emp.attentionReason}
                          </span>
                        </>
                      ) : (
                        <span>Showing signs of strain based on mood, late tasks, or workload</span>
                      )}
                      {emp.isBurnoutTrap && ' · Heavy workload + unused holiday'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 shrink-0 tabular-nums text-xs">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">Team Mood</p>
                      <p className="font-semibold text-[#0A2540] dark:text-slate-100">
                        {emp.engagementScore}/100
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">Late Tasks</p>
                      <p className="font-semibold text-[#E11D48] dark:text-[#FB7185]">
                        {emp.overdueTasks} tasks
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">Leave Left</p>
                      <p className="font-semibold text-[#0A2540] dark:text-slate-100">
                        {emp.leaveDaysRemaining}d
                      </p>
                    </div>
                    <div className="text-right min-w-[76px]">
                      <p className="text-[11px] text-slate-400">Stress Level</p>
                      <p className={`inline-flex items-center justify-end gap-1.5 text-sm font-bold ${stressTextColor}`}>
                        <span className={`w-2 h-2 rounded-full ${stressDotColor}`} />
                        <span>{stress}</span>
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
