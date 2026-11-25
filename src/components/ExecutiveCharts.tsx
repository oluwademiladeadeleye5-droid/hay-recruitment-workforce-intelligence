import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWorkforce } from '../context/WorkforceContext';
import { ChartCard } from './ChartCard';
import { exportGenericCsv, isHealthyReason } from '../utils/analytics';

const STATUS_COLORS: Record<string, string> = {
  Present: '#00A859',
  Remote: '#533AFD',
  Leave: '#D97706',
  Absent: '#E11D48',
};

const INDIGO_STROKE = '#533AFD';

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  payload?: Record<string, unknown>;
}

const PlainTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  totalBase?: number;
  hint?: string;
}> = ({ active, payload, label, totalBase = 0, hint = 'Click to filter' }) => {
  if (!active || !payload || payload.length === 0) return null;
  const firstPayload = payload[0]?.payload || {};
  const title = label || String(firstPayload.name || payload[0]?.name || '');

  return (
    <div
      className="rounded-xl px-3.5 py-2.5 text-xs text-white shadow-xl border border-[#533AFD]/55 pointer-events-none"
      style={{ backgroundColor: 'rgba(10, 37, 64, 0.96)', backdropFilter: 'blur(8px)' }}
    >
      <p className="font-semibold text-[#7C6BFF] mb-1.5">{title}</p>
      <div className="flex flex-col gap-1 tabular-nums">
        {payload.map((entry, idx) => {
          const val = Number(entry.value ?? 0);
          const showPct =
            totalBase > 0 &&
            typeof entry.name === 'string' &&
            !entry.name.includes('Mood') &&
            !entry.name.includes('Late');
          const pct = showPct ? ` (${((val / totalBase) * 100).toFixed(0)}%)` : '';
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="text-slate-200">{entry.name}:</span>
              <span className="font-semibold text-white">
                {val.toLocaleString()}
                {pct}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-300/85 mt-2 pt-1.5 border-t border-white/10">{hint}</p>
    </div>
  );
};

export const ExecutiveCharts: React.FC = () => {
  const { allRecords, filteredRecords, filters, toggleFilter, clearFilterKey } = useWorkforce();

  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [hoveredReason, setHoveredReason] = useState<string | null>(null);
  const [hoveredLoc, setHoveredLoc] = useState<string | null>(null);

  const baseRecords = filteredRecords;

  // 1. Where is everyone today? (Donut)
  const statusSource = useMemo(() => {
    if (filters.workStatuses.length === 0) return baseRecords;
    return allRecords.filter((r) => {
      if (filters.departments.length && !filters.departments.includes(r.department)) return false;
      if (filters.locations.length && !filters.locations.includes(r.location)) return false;
      if (filters.workArrangements.length && !filters.workArrangements.includes(r.workArrangement)) return false;
      if (filters.jobLevels.length && !filters.jobLevels.includes(r.jobLevel)) return false;
      if (filters.workloadLevels.length && !filters.workloadLevels.includes(r.workloadLevel)) return false;
      if (filters.attentionStatuses.length && !filters.attentionStatuses.includes(r.attentionStatus)) return false;
      if (filters.attentionReasons.length && !filters.attentionReasons.includes(r.attentionReason)) return false;
      return true;
    });
  }, [allRecords, baseRecords, filters]);

  const statusData = useMemo(() => {
    const order = ['Present', 'Remote', 'Leave', 'Absent'];
    const map = new Map<string, number>();
    statusSource.forEach((r) => map.set(r.workStatus, (map.get(r.workStatus) || 0) + 1));
    return Array.from(map.entries())
      .map(([name, Staff]) => ({
        name,
        Staff,
        pct: statusSource.length ? Number(((Staff / statusSource.length) * 100).toFixed(0)) : 0,
      }))
      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }, [statusSource]);

  const activeStatusSlice = useMemo(() => {
    if (hoveredStatus) return statusData.find((d) => d.name === hoveredStatus) || null;
    if (filters.workStatuses.length === 1) {
      return statusData.find((d) => d.name === filters.workStatuses[0]) || null;
    }
    return null;
  }, [hoveredStatus, filters.workStatuses, statusData]);

  // 2. Which departments need the most help? (Bar)
  const deptSource = useMemo(() => {
    if (filters.departments.length === 0) return baseRecords;
    return allRecords.filter((r) => {
      if (filters.locations.length && !filters.locations.includes(r.location)) return false;
      if (filters.workStatuses.length && !filters.workStatuses.includes(r.workStatus)) return false;
      if (filters.workArrangements.length && !filters.workArrangements.includes(r.workArrangement)) return false;
      if (filters.jobLevels.length && !filters.jobLevels.includes(r.jobLevel)) return false;
      if (filters.workloadLevels.length && !filters.workloadLevels.includes(r.workloadLevel)) return false;
      if (filters.attentionStatuses.length && !filters.attentionStatuses.includes(r.attentionStatus)) return false;
      if (filters.attentionReasons.length && !filters.attentionReasons.includes(r.attentionReason)) return false;
      return true;
    });
  }, [allRecords, baseRecords, filters]);

  const deptData = useMemo(() => {
    const map = new Map<string, { flagged: number; total: number }>();
    deptSource.forEach((r) => {
      const cur = map.get(r.department) || { flagged: 0, total: 0 };
      cur.total += 1;
      if (r.attentionStatus === 'Needs Attention') cur.flagged += 1;
      map.set(r.department, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        shortName: name.split(' ')[0],
        'Needs Check-In': v.flagged,
        'Total Staff': v.total,
      }))
      .sort((a, b) => b['Needs Check-In'] - a['Needs Check-In']);
  }, [deptSource]);

  // 3. Why do staff need help? (Horizontal Bar)
  const reasonSource = useMemo(() => {
    if (filters.attentionReasons.length === 0) return baseRecords;
    return allRecords.filter((r) => {
      if (filters.departments.length && !filters.departments.includes(r.department)) return false;
      if (filters.locations.length && !filters.locations.includes(r.location)) return false;
      if (filters.workStatuses.length && !filters.workStatuses.includes(r.workStatus)) return false;
      if (filters.workArrangements.length && !filters.workArrangements.includes(r.workArrangement)) return false;
      if (filters.jobLevels.length && !filters.jobLevels.includes(r.jobLevel)) return false;
      if (filters.workloadLevels.length && !filters.workloadLevels.includes(r.workloadLevel)) return false;
      if (filters.attentionStatuses.length && !filters.attentionStatuses.includes(r.attentionStatus)) return false;
      return true;
    });
  }, [allRecords, baseRecords, filters]);

  const reasonData = useMemo(() => {
    const map = new Map<string, number>();
    reasonSource.forEach((r) => {
      if (!isHealthyReason(r.attentionReason)) {
        map.set(r.attentionReason, (map.get(r.attentionReason) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, Staff]) => ({ name, Staff }))
      .sort((a, b) => b.Staff - a.Staff);
  }, [reasonSource]);

  // 4. How is each UK office doing? (Grouped Bar: Avg Team Mood & Late Tasks)
  const locSource = useMemo(() => {
    if (filters.locations.length === 0) return baseRecords;
    return allRecords.filter((r) => {
      if (filters.departments.length && !filters.departments.includes(r.department)) return false;
      if (filters.workStatuses.length && !filters.workStatuses.includes(r.workStatus)) return false;
      if (filters.workArrangements.length && !filters.workArrangements.includes(r.workArrangement)) return false;
      if (filters.jobLevels.length && !filters.jobLevels.includes(r.jobLevel)) return false;
      if (filters.workloadLevels.length && !filters.workloadLevels.includes(r.workloadLevel)) return false;
      if (filters.attentionStatuses.length && !filters.attentionStatuses.includes(r.attentionStatus)) return false;
      if (filters.attentionReasons.length && !filters.attentionReasons.includes(r.attentionReason)) return false;
      return true;
    });
  }, [allRecords, baseRecords, filters]);

  const locationData = useMemo(() => {
    const map = new Map<string, { count: number; engSum: number; overdue: number }>();
    locSource.forEach((r) => {
      const cur = map.get(r.location) || { count: 0, engSum: 0, overdue: 0 };
      cur.count += 1;
      cur.engSum += r.engagementScore;
      cur.overdue += r.overdueTasks;
      map.set(r.location, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        'Avg Team Mood': Number((v.engSum / Math.max(v.count, 1)).toFixed(0)),
        'Late Tasks': v.overdue,
      }))
      .sort((a, b) => b['Late Tasks'] - a['Late Tasks']);
  }, [locSource]);

  const getCellOpacity = (itemKey: string, selectedArr: string[], hoveredKey: string | null) => {
    if (selectedArr.length > 0) {
      return selectedArr.includes(itemKey) ? 1 : 0.3;
    }
    if (hoveredKey !== null) {
      return hoveredKey === itemKey ? 1 : 0.65;
    }
    return 1;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* 1. Donut Chart: Where is everyone today? */}
      <div className="lg:col-span-5 min-w-0">
        <ChartCard
          title="Where is everyone today?"
          subtitle="Present, Remote, Leave, and Absent. Click a slice to filter"
          isFiltered={filters.workStatuses.length > 0}
          onClearFilter={() => clearFilterKey('workStatuses')}
          onExportCsv={() => exportGenericCsv(statusData, 'hay_where_everyone_is.csv')}
          heightClass="h-72"
        >
          {() => (
            <div className="relative w-full h-full flex flex-col">
              <div className="flex-1 min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="Staff"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={2.5}
                      onMouseLeave={() => setHoveredStatus(null)}
                    >
                      {statusData.map((entry) => {
                        const isSelected = filters.workStatuses.includes(entry.name);
                        const isHovered = hoveredStatus === entry.name;
                        const opacity = getCellOpacity(entry.name, filters.workStatuses, hoveredStatus);
                        return (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name] || '#533AFD'}
                            fillOpacity={opacity}
                            stroke={isSelected || isHovered ? INDIGO_STROKE : 'transparent'}
                            strokeWidth={isSelected || isHovered ? 2 : 0}
                            style={{
                              cursor: 'pointer',
                              filter: isHovered ? 'brightness(1.1)' : undefined,
                              transition: 'opacity 150ms ease, filter 150ms ease',
                            }}
                            onMouseEnter={() => setHoveredStatus(entry.name)}
                            onClick={(e) => {
                              const ev = e as unknown as React.MouseEvent;
                              toggleFilter('workStatuses', entry.name, ev?.ctrlKey || ev?.metaKey);
                            }}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip cursor={false} content={<PlainTooltip totalBase={statusSource.length} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-[#0A2540] dark:text-white tabular-nums">
                    {activeStatusSlice ? activeStatusSlice.Staff : statusSource.length}
                  </span>
                  <span className="text-[11px] font-medium text-[#425466] dark:text-slate-400">
                    {activeStatusSlice ? `${activeStatusSlice.name} (${activeStatusSlice.pct}%)` : 'Total Staff'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
                {statusData.map((s) => {
                  const active = filters.workStatuses.length === 0 || filters.workStatuses.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={(e) => toggleFilter('workStatuses', s.name, e.ctrlKey || e.metaKey)}
                      className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
                        active ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[s.name] || '#533AFD' }}
                      />
                      <span className="text-[#0A2540] dark:text-slate-200 font-medium">{s.name}</span>
                      <span className="text-[#425466] dark:text-slate-400 tabular-nums">{s.pct}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* 2. Bar Chart: Which departments need the most help? */}
      <div className="lg:col-span-7 min-w-0">
        <ChartCard
          title="Which departments need the most help?"
          subtitle="Number of staff flagged for a check-in. Click a bar to filter"
          isFiltered={filters.departments.length > 0}
          onClearFilter={() => clearFilterKey('departments')}
          onExportCsv={() => exportGenericCsv(deptData, 'hay_departments_needing_help.csv')}
          heightClass="h-72"
        >
          {(expanded) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deptData}
                margin={{ top: 8, right: 12, left: -14, bottom: expanded ? 28 : 12 }}
                onMouseLeave={() => setHoveredDept(null)}
              >
                <XAxis
                  dataKey={expanded ? 'name' : 'shortName'}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={expanded ? -18 : 0}
                  textAnchor={expanded ? 'end' : 'middle'}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={false} content={<PlainTooltip />} />
                <Bar
                  dataKey="Needs Check-In"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                  onClick={(data, _idx, e) => {
                    const ev = e as unknown as React.MouseEvent;
                    if (data?.name) toggleFilter('departments', String(data.name), ev?.ctrlKey || ev?.metaKey);
                  }}
                >
                  {deptData.map((entry) => {
                    const isSelected = filters.departments.includes(entry.name);
                    const isHovered = hoveredDept === entry.name;
                    return (
                      <Cell
                        key={entry.name}
                        fill="#E11D48"
                        fillOpacity={getCellOpacity(entry.name, filters.departments, hoveredDept)}
                        stroke={isSelected || isHovered ? INDIGO_STROKE : 'transparent'}
                        strokeWidth={isSelected || isHovered ? 2 : 0}
                        style={{
                          cursor: 'pointer',
                          filter: isHovered ? 'brightness(1.12)' : undefined,
                          transition: 'opacity 150ms ease, filter 150ms ease',
                        }}
                        onMouseEnter={() => setHoveredDept(entry.name)}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* 3. Horizontal Bar Chart: Why do staff need help? */}
      <div className="lg:col-span-6 min-w-0">
        <ChartCard
          title="Why do staff need help?"
          subtitle="Top reasons listed across flagged employees"
          isFiltered={filters.attentionReasons.length > 0}
          onClearFilter={() => clearFilterKey('attentionReasons')}
          onExportCsv={() => exportGenericCsv(reasonData, 'hay_why_staff_need_help.csv')}
          heightClass="h-72"
        >
          {() =>
            reasonData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#425466] dark:text-slate-400">
                Everyone shown here is On Track!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reasonData}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                  onMouseLeave={() => setHoveredReason(null)}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={155}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={false}
                    content={
                      <PlainTooltip totalBase={reasonData.reduce((s, r) => s + r.Staff, 0)} />
                    }
                  />
                  <Bar
                    dataKey="Staff"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                    onClick={(data, _idx, e) => {
                      const ev = e as unknown as React.MouseEvent;
                      if (data?.name) toggleFilter('attentionReasons', String(data.name), ev?.ctrlKey || ev?.metaKey);
                    }}
                  >
                    {reasonData.map((entry) => {
                      const isSelected = filters.attentionReasons.includes(entry.name);
                      const isHovered = hoveredReason === entry.name;
                      return (
                        <Cell
                          key={entry.name}
                          fill="#533AFD"
                          fillOpacity={getCellOpacity(entry.name, filters.attentionReasons, hoveredReason)}
                          stroke={isSelected || isHovered ? '#00A859' : 'transparent'}
                          strokeWidth={isSelected || isHovered ? 2 : 0}
                          style={{
                            cursor: 'pointer',
                            filter: isHovered ? 'brightness(1.12)' : undefined,
                            transition: 'opacity 150ms ease, filter 150ms ease',
                          }}
                          onMouseEnter={() => setHoveredReason(entry.name)}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartCard>
      </div>

      {/* 4. Grouped Bar Chart: How is each UK office doing? */}
      <div className="lg:col-span-6 min-w-0">
        <ChartCard
          title="How is each UK office doing?"
          subtitle="Average team mood & late tasks by location"
          isFiltered={filters.locations.length > 0}
          onClearFilter={() => clearFilterKey('locations')}
          onExportCsv={() => exportGenericCsv(locationData, 'hay_uk_offices.csv')}
          heightClass="h-72"
        >
          {() => (
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center justify-end gap-4 pb-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[#425466] dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#00A859]" />
                  Avg Team Mood (0 to 100)
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#425466] dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#E11D48]" />
                  Late Tasks
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={locationData}
                    margin={{ top: 4, right: 8, left: -14, bottom: 4 }}
                    onMouseLeave={() => setHoveredLoc(null)}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={false} content={<PlainTooltip />} />
                    <Bar
                      yAxisId="left"
                      dataKey="Avg Team Mood"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={22}
                      onClick={(data, _idx, e) => {
                        const ev = e as unknown as React.MouseEvent;
                        if (data?.name) toggleFilter('locations', String(data.name), ev?.ctrlKey || ev?.metaKey);
                      }}
                    >
                      {locationData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill="#00A859"
                          fillOpacity={getCellOpacity(entry.name, filters.locations, hoveredLoc)}
                          stroke={filters.locations.includes(entry.name) || hoveredLoc === entry.name ? INDIGO_STROKE : 'transparent'}
                          strokeWidth={1.5}
                          style={{ cursor: 'pointer', transition: 'opacity 150ms ease' }}
                          onMouseEnter={() => setHoveredLoc(entry.name)}
                        />
                      ))}
                    </Bar>
                    <Bar
                      yAxisId="right"
                      dataKey="Late Tasks"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={22}
                      onClick={(data, _idx, e) => {
                        const ev = e as unknown as React.MouseEvent;
                        if (data?.name) toggleFilter('locations', String(data.name), ev?.ctrlKey || ev?.metaKey);
                      }}
                    >
                      {locationData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill="#E11D48"
                          fillOpacity={getCellOpacity(entry.name, filters.locations, hoveredLoc)}
                          stroke={filters.locations.includes(entry.name) || hoveredLoc === entry.name ? INDIGO_STROKE : 'transparent'}
                          strokeWidth={1.5}
                          style={{ cursor: 'pointer', transition: 'opacity 150ms ease' }}
                          onMouseEnter={() => setHoveredLoc(entry.name)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
};
