import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ZAxis,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useWorkforce } from '../context/WorkforceContext';
import { FilterBar } from '../components/FilterBar';
import { ChartCard } from '../components/ChartCard';
import { exportGenericCsv, getMatrixQuadrant } from '../utils/analytics';
import { EmployeeRecord } from '../types/workforce';

const WORKLOAD_COLOR: Record<string, string> = {
  Low: '#00A859',
  Moderate: '#00B4D8',
  High: '#D97706',
  Critical: '#E11D48',
};

const ATTENTION_COLOR: Record<string, string> = {
  'On Track': '#00A859',
  'Needs Attention': '#E11D48',
};

export const MatrixPage: React.FC = () => {
  const { allRecords, filteredRecords, filters, settings, setFilterPatch, openEmployeeDrawer } =
    useWorkforce();
  const [yMetric, setYMetric] = useState<'overdueTasks' | 'pendingTasks'>('overdueTasks');
  const [colorBy, setColorBy] = useState<'workloadLevel' | 'attentionStatus'>('workloadLevel');

  const quadrantCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'Critical Intervention': 0,
      'Overloaded Performers': 0,
      'Disengaged / Silent Risk': 0,
      'Thriving & Balanced': 0,
    };
    const base = filters.quadrant
      ? allRecords.filter((r) => {
          if (filters.departments.length && !filters.departments.includes(r.department)) return false;
          if (filters.locations.length && !filters.locations.includes(r.location)) return false;
          return true;
        })
      : filteredRecords;

    base.forEach((r) => {
      const q = getMatrixQuadrant(r, settings.thresholds);
      counts[q] = (counts[q] || 0) + 1;
    });
    return counts;
  }, [allRecords, filteredRecords, filters, settings.thresholds]);

  const scatterData = useMemo(
    () =>
      filteredRecords.map((r) => ({
        ...r,
        x: r.engagementScore,
        y: r[yMetric],
        z: r.compositeBurnoutRiskScore,
      })),
    [filteredRecords, yMetric]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
            Workload & Engagement Matrix
          </h1>
          <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
            Click any quadrant card to cross-filter · Click any employee dot to open their 360° intervention drawer
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-lg bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-xs">
            <button
              type="button"
              onClick={() => setYMetric('overdueTasks')}
              className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                yMetric === 'overdueTasks'
                  ? 'bg-[#533AFD] text-white'
                  : 'text-[#425466] dark:text-slate-300'
              }`}
            >
              Overdue Tasks
            </button>
            <button
              type="button"
              onClick={() => setYMetric('pendingTasks')}
              className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                yMetric === 'pendingTasks'
                  ? 'bg-[#533AFD] text-white'
                  : 'text-[#425466] dark:text-slate-300'
              }`}
            >
              Pending Tasks
            </button>
          </div>

          <select
            aria-label="Color scatter dots by"
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as 'workloadLevel' | 'attentionStatus')}
            className="h-8 px-2.5 rounded-lg bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-xs font-medium text-[#0A2540] dark:text-white cursor-pointer"
          >
            <option value="workloadLevel">Color by Workload Level</option>
            <option value="attentionStatus">Color by Attention Status</option>
          </select>
        </div>
      </div>

      <FilterBar />

      {/* 4 Quadrant Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            name: 'Critical Intervention',
            desc: `Engagement < ${settings.thresholds.lowEngagementCutoff} & Overdue >= ${settings.thresholds.overdueTaskCutoff}`,
            tone: 'text-[#E11D48] dark:text-[#FB7185]',
          },
          {
            name: 'Overloaded Performers',
            desc: `High Engagement but Overdue >= ${settings.thresholds.overdueTaskCutoff}`,
            tone: 'text-[#D97706] dark:text-[#FBBF24]',
          },
          {
            name: 'Disengaged / Silent Risk',
            desc: `Engagement < ${settings.thresholds.lowEngagementCutoff}, Low Overdue`,
            tone: 'text-[#533AFD] dark:text-[#7C6BFF]',
          },
          {
            name: 'Thriving & Balanced',
            desc: 'Healthy Engagement & Controlled Overdue Load',
            tone: 'text-[#00A859] dark:text-[#10B981]',
          },
        ].map((q) => {
          const active = filters.quadrant === q.name;
          return (
            <button
              key={q.name}
              type="button"
              onClick={() => setFilterPatch({ quadrant: active ? null : q.name })}
              className={`text-left p-4 rounded-2xl border bg-white dark:bg-[#0F2035] transition-all cursor-pointer ${
                active
                  ? 'border-[#533AFD] ring-1 ring-[#533AFD]/50'
                  : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD]/60'
              }`}
            >
              <p className={`text-xs font-bold ${q.tone}`}>{q.name}</p>
              <p className="text-2xl font-bold text-[#0A2540] dark:text-white tabular-nums mt-1">
                {quadrantCounts[q.name] || 0}
              </p>
              <p className="text-[11px] text-[#425466] dark:text-slate-400 mt-1">{q.desc}</p>
            </button>
          );
        })}
      </div>

      <ChartCard
        title={`Engagement Score vs. ${yMetric === 'overdueTasks' ? 'Overdue Tasks' : 'Pending Tasks'}`}
        subtitle="Dot size reflects Composite Burnout Risk · Click any employee dot to open 360° drawer"
        isFiltered={Boolean(filters.quadrant)}
        onClearFilter={() => setFilterPatch({ quadrant: null })}
        onExportCsv={() =>
          exportGenericCsv(
            scatterData.map((r) => ({
              'Employee ID': r.employeeId,
              'Employee Name': r.employeeName,
              Department: r.department,
              'Engagement Score': r.engagementScore,
              [yMetric]: r[yMetric],
              'Workload Level': r.workloadLevel,
              'Burnout Risk': r.compositeBurnoutRiskScore,
            })),
            'hay_engagement_workload_matrix.csv'
          )
        }
        heightClass="h-[440px]"
      >
        {() => (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 16, right: 24, bottom: 20, left: 0 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Engagement"
                domain={[20, 100]}
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Engagement Score (0–100)', position: 'insideBottom', offset: -10, fill: '#94A3B8', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yMetric === 'overdueTasks' ? 'Overdue Tasks' : 'Pending Tasks'}
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis type="number" dataKey="z" range={[35, 220]} />
              <ReferenceLine
                x={settings.thresholds.lowEngagementCutoff}
                stroke="#533AFD"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
              />
              {yMetric === 'overdueTasks' && (
                <ReferenceLine
                  y={settings.thresholds.overdueTaskCutoff}
                  stroke="#E11D48"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
              )}
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const emp = payload[0]?.payload as EmployeeRecord | undefined;
                  if (!emp) return null;
                  return (
                    <div
                      className="rounded-xl p-3 text-xs text-white border border-[#533AFD]/55 shadow-xl"
                      style={{ backgroundColor: 'rgba(10, 37, 64, 0.96)' }}
                    >
                      <p className="font-mono text-[#7C6BFF] font-semibold">{emp.employeeId}</p>
                      <p className="font-bold text-sm">{emp.employeeName}</p>
                      <p className="text-slate-300 mt-0.5">
                        {emp.department} · {emp.location}
                      </p>
                      <div className="mt-2 space-y-0.5 tabular-nums">
                        <p>Engagement: {emp.engagementScore}/100</p>
                        <p>Overdue: {emp.overdueTasks} · Pending: {emp.pendingTasks}</p>
                        <p>Burnout Risk: {emp.compositeBurnoutRiskScore}/100 ({emp.workloadLevel})</p>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1.5 pt-1 border-t border-white/10">
                        Click dot to open 360° profile
                      </p>
                    </div>
                  );
                }}
              />
              <Scatter
                data={scatterData}
                onClick={(node) => {
                  const rec = node?.payload as EmployeeRecord | undefined;
                  if (rec?.employeeId) openEmployeeDrawer(rec.employeeId);
                }}
              >
                {scatterData.map((entry) => {
                  const fill =
                    colorBy === 'workloadLevel'
                      ? WORKLOAD_COLOR[entry.workloadLevel] || '#533AFD'
                      : ATTENTION_COLOR[entry.attentionStatus] || '#00A859';
                  return (
                    <Cell
                      key={entry.employeeId}
                      fill={fill}
                      fillOpacity={0.82}
                      stroke="#FFFFFF"
                      strokeOpacity={0.35}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
};
