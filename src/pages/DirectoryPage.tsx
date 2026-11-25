import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { FilterBar } from '../components/FilterBar';
import { EmployeeRecord } from '../types/workforce';
import { exportRecordsToCsv, getStressLevel } from '../utils/analytics';

type SortKey =
  | 'employeeId'
  | 'employeeName'
  | 'department'
  | 'engagementScore'
  | 'overdueTasks'
  | 'pendingTasks'
  | 'leaveDaysRemaining'
  | 'compositeBurnoutRiskScore';

export const DirectoryPage: React.FC = () => {
  const { filteredRecords, settings, openEmployeeDrawer, pushToast } = useWorkforce();
  const [sortKey, setSortKey] = useState<SortKey>('compositeBurnoutRiskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const sorted = useMemo(() => {
    const copy = [...filteredRecords];
    copy.sort((a: EmployeeRecord, b: EmployeeRecord) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [filteredRecords, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'employeeId' || key === 'employeeName' || key === 'department' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const compact = settings.tableDensity === 'compact';

  const renderStressBadge = (score: number) => {
    const level = getStressLevel(score);
    const dot =
      level === 'High'
        ? 'bg-[#E11D48] dark:bg-[#FB7185]'
        : level === 'Medium'
          ? 'bg-[#D97706] dark:bg-[#FBBF24]'
          : 'bg-[#00A859] dark:bg-[#10B981]';
    const text =
      level === 'High'
        ? 'text-[#E11D48] dark:text-[#FB7185]'
        : level === 'Medium'
          ? 'text-[#D97706] dark:text-[#FBBF24]'
          : 'text-[#00A859] dark:text-[#10B981]';
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold ${text}`}>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span>{level}</span>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
            All Staff
          </h1>
          <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5 tabular-nums">
            Showing {sorted.length.toLocaleString()} staff members · Click any person to open their full card
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            exportRecordsToCsv(sorted, 'hay_all_staff.csv');
            pushToast({ type: 'success', title: 'Staff list downloaded as CSV' });
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] text-white cursor-pointer whitespace-nowrap shrink-0 self-start"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Staff List</span>
        </button>
      </div>

      <FilterBar />

      {/* Mobile Cards (< 640px) */}
      <div className="sm:hidden space-y-3">
        {pageRows.map((emp) => (
          <button
            key={emp.employeeId}
            type="button"
            onClick={() => openEmployeeDrawer(emp.employeeId)}
            className="w-full text-left bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-4 space-y-2 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-[#533AFD] dark:text-[#7C6BFF]">
                {emp.employeeId}
              </span>
              <span className="text-xs">{renderStressBadge(emp.compositeBurnoutRiskScore)}</span>
            </div>
            <p className="text-sm font-bold text-[#0A2540] dark:text-white">{emp.employeeName}</p>
            <p className="text-xs text-[#425466] dark:text-slate-400">
              {emp.department} · {emp.location} · {emp.workStatus}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-[#1E3A5F] text-xs tabular-nums">
              <div>
                <span className="text-slate-400 block text-[10px]">Team Mood</span>
                <span className="font-semibold">{emp.engagementScore}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Late Tasks</span>
                <span className="font-semibold text-[#E11D48] dark:text-[#FB7185]">{emp.overdueTasks}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Leave Left</span>
                <span className="font-semibold">{emp.leaveDaysRemaining}d</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop / Tablet Data Grid (>= 640px) */}
      <div className="hidden sm:block bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F6F9FC] dark:bg-[#162B45]/80 text-[11px] font-semibold text-[#425466] dark:text-slate-300">
                {[
                  { key: 'employeeId' as SortKey, label: 'Staff ID', sticky: true },
                  { key: 'employeeName' as SortKey, label: 'Name & Role' },
                  { key: 'department' as SortKey, label: 'Team & Office' },
                  { key: 'engagementScore' as SortKey, label: 'Team Mood', numeric: true },
                  { key: 'pendingTasks' as SortKey, label: 'Open Tasks', numeric: true },
                  { key: 'overdueTasks' as SortKey, label: 'Late Tasks', numeric: true },
                  { key: 'leaveDaysRemaining' as SortKey, label: 'Leave Left', numeric: true },
                  { key: 'compositeBurnoutRiskScore' as SortKey, label: 'Stress Level', numeric: true },
                ].map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 whitespace-nowrap ${
                      col.sticky ? 'sticky left-0 z-10 bg-[#F6F9FC] dark:bg-[#162B45]' : ''
                    } ${col.numeric ? 'text-right' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-[#0A2540] dark:hover:text-white cursor-pointer"
                    >
                      <span>{col.label}</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 whitespace-nowrap">Today&apos;s Status &amp; Check-In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E3A5F] text-xs">
              {pageRows.map((emp) => {
                const needsCheckIn = emp.attentionStatus === 'Needs Attention';
                return (
                  <tr
                    key={emp.employeeId}
                    onClick={() => openEmployeeDrawer(emp.employeeId)}
                    className="hover:bg-[#F6F9FC] dark:hover:bg-[#162B45]/60 transition-colors cursor-pointer"
                  >
                    <td
                      className={`sticky left-0 z-10 bg-white dark:bg-[#0F2035] px-4 font-mono font-semibold text-[#533AFD] dark:text-[#7C6BFF] whitespace-nowrap ${
                        compact ? 'py-2' : 'py-3'
                      }`}
                    >
                      {emp.employeeId}
                    </td>
                    <td className={`px-4 whitespace-nowrap ${compact ? 'py-2' : 'py-3'}`}>
                      <p className="font-semibold text-[#0A2540] dark:text-white">{emp.employeeName}</p>
                      <p className="text-[11px] text-[#425466] dark:text-slate-400">{emp.jobLevel}</p>
                    </td>
                    <td className={`px-4 whitespace-nowrap ${compact ? 'py-2' : 'py-3'}`}>
                      <p className="text-[#0A2540] dark:text-slate-200">{emp.department}</p>
                      <p className="text-[11px] text-[#425466] dark:text-slate-400">
                        {emp.location} · {emp.workArrangement}
                      </p>
                    </td>
                    <td className={`px-4 text-right tabular-nums ${compact ? 'py-2' : 'py-3'}`}>
                      <div className="inline-flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-[#162B45] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${emp.engagementScore}%`,
                              backgroundColor:
                                emp.engagementScore < settings.thresholds.lowEngagementCutoff
                                  ? '#E11D48'
                                  : '#00A859',
                            }}
                          />
                        </div>
                        <span className="font-semibold text-[#0A2540] dark:text-white w-7">
                          {emp.engagementScore}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 text-right tabular-nums text-[#0A2540] dark:text-slate-200 ${compact ? 'py-2' : 'py-3'}`}>
                      {emp.pendingTasks}
                    </td>
                    <td
                      className={`px-4 text-right tabular-nums font-semibold ${
                        emp.overdueTasks >= settings.thresholds.overdueTaskCutoff
                          ? 'text-[#E11D48] dark:text-[#FB7185]'
                          : 'text-[#0A2540] dark:text-slate-200'
                      } ${compact ? 'py-2' : 'py-3'}`}
                    >
                      {emp.overdueTasks}
                    </td>
                    <td className={`px-4 text-right tabular-nums text-[#0A2540] dark:text-slate-200 ${compact ? 'py-2' : 'py-3'}`}>
                      {emp.leaveDaysRemaining}d
                    </td>
                    <td className={`px-4 text-right whitespace-nowrap ${compact ? 'py-2' : 'py-3'}`}>
                      {renderStressBadge(emp.compositeBurnoutRiskScore)}
                    </td>
                    <td className={`px-4 whitespace-nowrap ${compact ? 'py-2' : 'py-3'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#0A2540] dark:text-slate-200">
                          {emp.workStatus}
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
                      </div>
                      <p className="text-[11px] text-[#425466] dark:text-slate-400 mt-0.5">
                        {emp.attentionReason}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-[#E2E8F0] dark:border-[#1E3A5F] flex items-center justify-between text-xs text-[#425466] dark:text-slate-400">
          <span className="tabular-nums">
            Page {safePage} of {totalPages} ({sorted.length} staff)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] disabled:opacity-40 cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] disabled:opacity-40 cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
