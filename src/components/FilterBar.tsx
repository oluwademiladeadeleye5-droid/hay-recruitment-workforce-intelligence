import React, { useMemo } from 'react';
import { FilterX, Search, X } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { CrossFilterState } from '../types/workforce';

export const FilterBar: React.FC = () => {
  const { allRecords, filteredRecords, filters, isFiltered, setFilterPatch, clearFilterKey, resetAllFilters } =
    useWorkforce();

  const options = useMemo(() => {
    const uniq = (arr: string[]) => Array.from(new Set(arr)).sort();
    return {
      departments: uniq(allRecords.map((r) => r.department)),
      locations: uniq(allRecords.map((r) => r.location)),
      workStatuses: uniq(allRecords.map((r) => r.workStatus)),
      workArrangements: uniq(allRecords.map((r) => r.workArrangement)),
      jobLevels: uniq(allRecords.map((r) => r.jobLevel)),
      workloadLevels: ['Critical', 'High', 'Moderate', 'Low'].filter((w) =>
        allRecords.some((r) => r.workloadLevel === w)
      ),
      attentionStatuses: uniq(allRecords.map((r) => r.attentionStatus)),
    };
  }, [allRecords]);

  const formatDisplayVal = (key: keyof CrossFilterState, value: string) => {
    if (key === 'attentionStatuses') {
      return value === 'Needs Attention' ? 'Needs Check-In' : 'Doing Great';
    }
    return value;
  };

  const activePills = useMemo(() => {
    const pills: Array<{ key: keyof CrossFilterState; label: string; value: string; displayValue: string }> = [];
    filters.departments.forEach((v) => pills.push({ key: 'departments', label: 'Department', value: v, displayValue: v }));
    filters.locations.forEach((v) => pills.push({ key: 'locations', label: 'Location', value: v, displayValue: v }));
    filters.workStatuses.forEach((v) => pills.push({ key: 'workStatuses', label: "Today's Status", value: v, displayValue: v }));
    filters.workArrangements.forEach((v) => pills.push({ key: 'workArrangements', label: 'Work Setup', value: v, displayValue: v }));
    filters.jobLevels.forEach((v) => pills.push({ key: 'jobLevels', label: 'Role Level', value: v, displayValue: v }));
    filters.workloadLevels.forEach((v) => pills.push({ key: 'workloadLevels', label: 'Workload', value: v, displayValue: v }));
    filters.attentionStatuses.forEach((v) =>
      pills.push({
        key: 'attentionStatuses',
        label: 'Check-In',
        value: v,
        displayValue: formatDisplayVal('attentionStatuses', v),
      })
    );
    filters.attentionReasons.forEach((v) => pills.push({ key: 'attentionReasons', label: 'Reason', value: v, displayValue: v }));
    if (filters.quadrant) pills.push({ key: 'quadrant', label: 'Group', value: filters.quadrant, displayValue: filters.quadrant });
    if (filters.searchQuery.trim()) pills.push({ key: 'searchQuery', label: 'Search', value: filters.searchQuery.trim(), displayValue: filters.searchQuery.trim() });
    return pills;
  }, [filters]);

  const removePill = (key: keyof CrossFilterState, value: string) => {
    if (key === 'quadrant' || key === 'searchQuery') {
      clearFilterKey(key);
      return;
    }
    const current = filters[key] as string[];
    setFilterPatch({ [key]: current.filter((v) => v !== value) });
  };

  const renderSelect = (
    allLabel: string,
    key: Exclude<keyof CrossFilterState, 'quadrant' | 'searchQuery' | 'attentionReasons'>,
    items: string[]
  ) => {
    const selected = filters[key][0] || '';
    return (
      <select
        aria-label={allLabel}
        value={selected}
        onChange={(e) => setFilterPatch({ [key]: e.target.value ? [e.target.value] : [] })}
        className="h-9 px-2.5 text-xs font-medium rounded-lg bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#533AFD] cursor-pointer"
      >
        <option value="">{allLabel}</option>
        {items.map((item) => (
          <option key={item} value={item}>
            {formatDisplayVal(key, item)}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="space-y-3 no-print">
      <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-3.5 shadow-sm flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setFilterPatch({ searchQuery: e.target.value })}
            placeholder="Search by name, Staff ID, team, or office..."
            aria-label="Search staff"
            className="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-[#F8FAFC] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#533AFD]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {renderSelect('All Teams', 'departments', options.departments)}
          {renderSelect('All Offices', 'locations', options.locations)}
          {renderSelect("Today's Status", 'workStatuses', options.workStatuses)}
          {renderSelect('Work Setup', 'workArrangements', options.workArrangements)}
          {renderSelect('Role Level', 'jobLevels', options.jobLevels)}
          {renderSelect('Workload', 'workloadLevels', options.workloadLevels)}
          {renderSelect('Check-In Status', 'attentionStatuses', options.attentionStatuses)}
        </div>
      </div>

      {/* Unmistakable Always-Visible Active Filter Reset Banner */}
      {isFiltered && activePills.length > 0 && (
        <div className="rounded-2xl bg-[#EEF2FF] dark:bg-[#533AFD]/20 border border-[#533AFD]/35 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#0A2540] dark:text-white tabular-nums">
              Showing ({filteredRecords.length} of {allRecords.length} staff):
            </span>
            {activePills.map((p) => (
              <button
                key={`${p.key}-${p.value}`}
                type="button"
                onClick={() => removePill(p.key, p.value)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#533AFD] dark:bg-[#7C6BFF] text-white hover:bg-[#4434D4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="text-white/80">{p.label}:</span>
                <span>{p.displayValue}</span>
                <X className="w-3 h-3 text-white/90" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] text-[#533AFD] dark:text-[#7C6BFF] border border-[#533AFD]/30 hover:bg-[#533AFD] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Show Everyone (Reset)</span>
          </button>
        </div>
      )}
    </div>
  );
};
