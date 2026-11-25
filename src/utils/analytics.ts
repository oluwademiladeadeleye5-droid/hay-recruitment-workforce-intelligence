import * as XLSX from 'xlsx';
import {
  ActionPlan,
  BusinessInsight,
  CrossFilterState,
  EmployeeRecord,
  HRAlertThresholds,
  StatusDefinition,
} from '../types/workforce';

export const EMPTY_FILTERS: CrossFilterState = {
  departments: [],
  locations: [],
  workStatuses: [],
  workArrangements: [],
  jobLevels: [],
  workloadLevels: [],
  attentionStatuses: [],
  attentionReasons: [],
  quadrant: null,
  searchQuery: '',
};

export function hasActiveFilters(filters: CrossFilterState): boolean {
  return (
    filters.departments.length > 0 ||
    filters.locations.length > 0 ||
    filters.workStatuses.length > 0 ||
    filters.workArrangements.length > 0 ||
    filters.jobLevels.length > 0 ||
    filters.workloadLevels.length > 0 ||
    filters.attentionStatuses.length > 0 ||
    filters.attentionReasons.length > 0 ||
    Boolean(filters.quadrant) ||
    filters.searchQuery.trim().length > 0
  );
}

export type StressTier = 'Low' | 'Medium' | 'High';

export function getStressLevel(score: number): StressTier {
  if (score >= 65) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

export function isHealthyReason(reason?: string): boolean {
  if (!reason) return true;
  const r = reason.trim().toLowerCase();
  return !r || r === 'on track' || r === 'none / on track' || r === 'none';
}

export function getMatrixQuadrant(rec: EmployeeRecord, thresholds: HRAlertThresholds): string {
  const lowEng = rec.engagementScore < thresholds.lowEngagementCutoff;
  const highOverdue = rec.overdueTasks >= thresholds.overdueTaskCutoff;
  if (lowEng && highOverdue) return 'Needs Immediate Support';
  if (!lowEng && highOverdue) return 'Busy With Late Tasks';
  if (lowEng && !highOverdue) return 'Low Mood';
  return 'Doing Great';
}

export function applyCrossFilters(
  records: EmployeeRecord[],
  filters: CrossFilterState,
  thresholds: HRAlertThresholds
): EmployeeRecord[] {
  const q = filters.searchQuery.trim().toLowerCase();
  return records.filter((rec) => {
    if (filters.departments.length && !filters.departments.includes(rec.department)) return false;
    if (filters.locations.length && !filters.locations.includes(rec.location)) return false;
    if (filters.workStatuses.length && !filters.workStatuses.includes(rec.workStatus)) return false;
    if (filters.workArrangements.length && !filters.workArrangements.includes(rec.workArrangement)) return false;
    if (filters.jobLevels.length && !filters.jobLevels.includes(rec.jobLevel)) return false;
    if (filters.workloadLevels.length && !filters.workloadLevels.includes(rec.workloadLevel)) return false;
    if (filters.attentionStatuses.length && !filters.attentionStatuses.includes(rec.attentionStatus)) return false;
    if (filters.attentionReasons.length && !filters.attentionReasons.includes(rec.attentionReason)) return false;
    if (filters.quadrant && getMatrixQuadrant(rec, thresholds) !== filters.quadrant) return false;
    if (q) {
      const hay = `${rec.employeeId} ${rec.employeeName} ${rec.department} ${rec.location} ${rec.jobLevel} ${rec.attentionReason}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface KpiSummary {
  totalWorkforce: number;
  presentCount: number;
  remoteCount: number;
  leaveCount: number;
  absentCount: number;
  availableCount: number;
  availabilityRate: number;
  avgEngagement: number;
  engagementDeltaVsTarget: number;
  needsAttentionCount: number;
  needsAttentionRate: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  avgPendingPerEmployee: number;
  overdueTasks: number;
  overdueShareOfTotal: number;
  avgBurnoutRisk: number;
  burnoutTrapCount: number;
}

export function computeKpis(
  records: EmployeeRecord[],
  thresholds: HRAlertThresholds
): KpiSummary {
  const n = records.length;
  if (n === 0) {
    return {
      totalWorkforce: 0,
      presentCount: 0,
      remoteCount: 0,
      leaveCount: 0,
      absentCount: 0,
      availableCount: 0,
      availabilityRate: 0,
      avgEngagement: 0,
      engagementDeltaVsTarget: -thresholds.engagementTarget,
      needsAttentionCount: 0,
      needsAttentionRate: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      avgPendingPerEmployee: 0,
      overdueTasks: 0,
      overdueShareOfTotal: 0,
      avgBurnoutRisk: 0,
      burnoutTrapCount: 0,
    };
  }

  let presentCount = 0;
  let remoteCount = 0;
  let leaveCount = 0;
  let absentCount = 0;
  let engSum = 0;
  let needsAttentionCount = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  let pendingTasks = 0;
  let overdueTasks = 0;
  let riskSum = 0;
  let burnoutTrapCount = 0;

  for (const r of records) {
    if (r.workStatus === 'Present') presentCount += 1;
    else if (r.workStatus === 'Remote') remoteCount += 1;
    else if (r.workStatus === 'Leave') leaveCount += 1;
    else if (r.workStatus === 'Absent') absentCount += 1;

    engSum += r.engagementScore;
    if (r.attentionStatus === 'Needs Attention') needsAttentionCount += 1;
    totalTasks += r.totalTasks;
    completedTasks += r.completedTasks;
    pendingTasks += r.pendingTasks;
    overdueTasks += r.overdueTasks;
    riskSum += r.compositeBurnoutRiskScore;
    if (r.isBurnoutTrap) burnoutTrapCount += 1;
  }

  const availableCount = presentCount + remoteCount;
  const avgEngagement = Number((engSum / n).toFixed(1));
  return {
    totalWorkforce: n,
    presentCount,
    remoteCount,
    leaveCount,
    absentCount,
    availableCount,
    availabilityRate: Number(((availableCount / n) * 100).toFixed(1)),
    avgEngagement,
    engagementDeltaVsTarget: Number((avgEngagement - thresholds.engagementTarget).toFixed(1)),
    needsAttentionCount,
    needsAttentionRate: Number(((needsAttentionCount / n) * 100).toFixed(1)),
    totalTasks,
    completedTasks,
    pendingTasks,
    avgPendingPerEmployee: Number((pendingTasks / n).toFixed(1)),
    overdueTasks,
    overdueShareOfTotal: Number(((overdueTasks / Math.max(totalTasks, 1)) * 100).toFixed(1)),
    avgBurnoutRisk: Number((riskSum / n).toFixed(1)),
    burnoutTrapCount,
  };
}

export function computeBusinessInsights(
  records: EmployeeRecord[],
  thresholds: HRAlertThresholds
): BusinessInsight[] {
  if (records.length === 0) return [];
  const overall = computeKpis(records, thresholds);
  const insights: BusinessInsight[] = [];

  // 1. Which department needs the most help
  const deptMap = new Map<string, EmployeeRecord[]>();
  records.forEach((r) => {
    const arr = deptMap.get(r.department) || [];
    arr.push(r);
    deptMap.set(r.department, arr);
  });
  const deptStats = Array.from(deptMap.entries()).map(([name, list]) => {
    const k = computeKpis(list, thresholds);
    return { name, count: list.length, ...k };
  });
  deptStats.sort((a, b) => b.needsAttentionCount - a.needsAttentionCount);
  const worstDept = deptStats[0];
  const bestDept = [...deptStats].sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
  if (worstDept) {
    insights.push({
      id: 'insight-dept-risk',
      category: 'Department Risk',
      severity: worstDept.needsAttentionRate >= 30 ? 'critical' : 'warning',
      headline: `${worstDept.name} has the most people needing a check-in right now`,
      metricCallout: `${worstDept.needsAttentionCount} of ${worstDept.count} staff (${worstDept.needsAttentionRate}%)`,
      evidence: `Team Mood in ${worstDept.name} averages ${worstDept.avgEngagement}/100 (compared to ${bestDept?.avgEngagement ?? overall.avgEngagement}/100 in ${bestDept?.name ?? 'other teams'}), and the team has ${worstDept.overdueTasks} late tasks.`,
      recommendation: `Schedule short 1-on-1 check-ins in ${worstDept.name} this week and move urgent late tasks to teammates with lighter workloads.`,
      expectedImpact: 'Helps lower team stress quickly and clears overdue work.',
      filterPatch: { departments: [worstDept.name] },
    });
  }

  // 2. Which UK office has the most late tasks per person
  const locMap = new Map<string, EmployeeRecord[]>();
  records.forEach((r) => {
    const arr = locMap.get(r.location) || [];
    arr.push(r);
    locMap.set(r.location, arr);
  });
  const locStats = Array.from(locMap.entries()).map(([name, list]) => {
    const k = computeKpis(list, thresholds);
    return {
      name,
      count: list.length,
      overduePerPerson: Number((k.overdueTasks / Math.max(list.length, 1)).toFixed(1)),
      ...k,
    };
  });
  locStats.sort((a, b) => b.overduePerPerson - a.overduePerPerson);
  const busiestLoc = locStats[0];
  const happiestLoc = [...locStats].sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
  if (busiestLoc) {
    insights.push({
      id: 'insight-location-gap',
      category: 'Location Gap',
      severity: busiestLoc.overduePerPerson >= 2.5 ? 'warning' : 'positive',
      headline: `${busiestLoc.name} has the highest number of late tasks per person`,
      metricCallout: `${busiestLoc.overduePerPerson} late tasks per person (${busiestLoc.overdueTasks} total)`,
      evidence: `${busiestLoc.name} (${busiestLoc.count} staff) has an average Team Mood of ${busiestLoc.avgEngagement}/100, while ${happiestLoc?.name ?? 'other offices'} leads at ${happiestLoc?.avgEngagement ?? overall.avgEngagement}/100.`,
      recommendation: `Review task assignments in ${busiestLoc.name} this week and share best practices from ${happiestLoc?.name ?? 'our top-performing office'}.`,
      expectedImpact: `Clears bottlenecks across ${busiestLoc.count} local staff.`,
      filterPatch: { locations: [busiestLoc.name] },
    });
  }

  // 3. Heavy workload + unused leave
  const trapStaff = records.filter((r) => r.isBurnoutTrap);
  const trapPct = Number(((trapStaff.length / records.length) * 100).toFixed(1));
  insights.push({
    id: 'insight-burnout-trap',
    category: 'Burnout Correlation',
    severity: trapStaff.length >= 25 ? 'critical' : 'warning',
    headline: `${trapStaff.length} people have a heavy workload AND ${thresholds.unusedLeaveCutoff}+ unused holiday days`,
    metricCallout: `${trapPct}% of the team`,
    evidence: `Staff working at High or Critical pace without taking their annual leave are the most likely to burn out and currently hold ${trapStaff.reduce((s, r) => s + r.overdueTasks, 0)} late tasks.`,
    recommendation: `Ask managers to help these ${trapStaff.length} staff book at least a few days of rest soon and arrange cover while they are away.`,
    expectedImpact: 'Prevents burnout and keeps great people from leaving.',
    filterPatch: { workloadLevels: ['Critical', 'High'] },
  });

  // 4. Top reason people are flagged
  const flagged = records.filter((r) => r.attentionStatus === 'Needs Attention');
  const reasonCounts = new Map<string, number>();
  flagged.forEach((r) => {
    if (!isHealthyReason(r.attentionReason)) {
      reasonCounts.set(r.attentionReason, (reasonCounts.get(r.attentionReason) || 0) + 1);
    }
  });
  const sortedReasons = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (sortedReasons.length > 0) {
    const [topReason, topCount] = sortedReasons[0];
    const share = Number(((topCount / Math.max(flagged.length, 1)) * 100).toFixed(1));
    insights.push({
      id: 'insight-attention-reason',
      category: 'Attention Concentration',
      severity: 'critical',
      headline: `"${topReason}" is the #1 reason people need help`,
      metricCallout: `${topCount} people (${share}% of flagged staff)`,
      evidence: `Out of ${flagged.length} team members flagged for a check-in, ${topCount} are highlighted because of ${topReason}.`,
      recommendation: `Focus on fixing "${topReason}" first. Solving this single issue helps nearly ${Math.round(share)}% of everyone flagged.`,
      expectedImpact: 'Gives managers the biggest positive impact right away.',
      filterPatch: { attentionReasons: [topReason] },
    });
  }

  // 5. Work setup comparison (Hybrid vs Remote vs On-Site)
  const arrMap = new Map<string, EmployeeRecord[]>();
  records.forEach((r) => {
    const arr = arrMap.get(r.workArrangement) || [];
    arr.push(r);
    arrMap.set(r.workArrangement, arr);
  });
  const arrStats = Array.from(arrMap.entries()).map(([name, list]) => ({
    name,
    count: list.length,
    ...computeKpis(list, thresholds),
  }));
  arrStats.sort((a, b) => a.avgEngagement - b.avgEngagement);
  const lowArr = arrStats[0];
  const highArr = arrStats[arrStats.length - 1];
  if (lowArr && highArr && lowArr.name !== highArr.name) {
    insights.push({
      id: 'insight-hybrid-disparity',
      category: 'Hybrid Disparity',
      severity: lowArr.avgEngagement < thresholds.engagementTarget ? 'warning' : 'positive',
      headline: `${lowArr.name} workers have slightly lower mood than ${highArr.name} teammates`,
      metricCallout: `${lowArr.avgEngagement} vs ${highArr.avgEngagement} Team Mood`,
      evidence: `${lowArr.name} staff (${lowArr.count} people) have a ${lowArr.needsAttentionRate}% check-in rate compared to ${highArr.needsAttentionRate}% for ${highArr.name} staff.`,
      recommendation: `Encourage regular team catch-ups and casual coffee chats so ${lowArr.name} colleagues stay connected and supported.`,
      expectedImpact: 'Lifts team mood and helps people feel part of the wider group.',
      filterPatch: { workArrangements: [lowArr.name] },
    });
  }

  // 6. Critical workload vs late tasks
  const criticalLoad = records.filter((r) => r.workloadLevel === 'Critical');
  const critOverdue = criticalLoad.reduce((s, r) => s + r.overdueTasks, 0);
  const overdueShareFromCrit = Number(((critOverdue / Math.max(overall.overdueTasks, 1)) * 100).toFixed(1));
  insights.push({
    id: 'insight-overdue-velocity',
    category: 'Overdue Velocity',
    severity: overdueShareFromCrit >= 35 ? 'critical' : 'warning',
    headline: `A small group of ${criticalLoad.length} overloaded staff hold ${overdueShareFromCrit}% of all late tasks`,
    metricCallout: `${critOverdue} of ${overall.overdueTasks} late tasks`,
    evidence: `Just ${criticalLoad.length} people with a Critical workload are carrying ${critOverdue} overdue items right now.`,
    recommendation: `Pair overloaded teammates with colleagues who have Low or Moderate workloads in the same office to share the load.`,
    expectedImpact: 'Clears late tasks fast without hiring extra staff.',
    filterPatch: { workloadLevels: ['Critical'] },
  });

  return insights.slice(0, 6);
}

export function buildAiContextSummary(
  records: EmployeeRecord[],
  thresholds: HRAlertThresholds,
  snapshotDate: string
): string {
  const k = computeKpis(records, thresholds);
  const insights = computeBusinessInsights(records, thresholds);

  const deptMap = new Map<string, EmployeeRecord[]>();
  records.forEach((r) => {
    const arr = deptMap.get(r.department) || [];
    arr.push(r);
    deptMap.set(r.department, arr);
  });
  const deptLines = Array.from(deptMap.entries()).map(([dept, list]) => {
    const dk = computeKpis(list, thresholds);
    return `- ${dept}: ${dk.totalWorkforce} staff, Team Mood ${dk.avgEngagement}/100, Needs Check-In ${dk.needsAttentionCount} (${dk.needsAttentionRate}%), Late Tasks ${dk.overdueTasks}`;
  });

  const locMap = new Map<string, EmployeeRecord[]>();
  records.forEach((r) => {
    const arr = locMap.get(r.location) || [];
    arr.push(r);
    locMap.set(r.location, arr);
  });
  const locLines = Array.from(locMap.entries()).map(([loc, list]) => {
    const lk = computeKpis(list, thresholds);
    return `- ${loc}: ${lk.totalWorkforce} staff, Team Mood ${lk.avgEngagement}/100, Needs Check-In ${lk.needsAttentionCount} (${lk.needsAttentionRate}%), Late Tasks ${lk.overdueTasks}`;
  });

  const topRisk = [...records]
    .sort((a, b) => b.compositeBurnoutRiskScore - a.compositeBurnoutRiskScore)
    .slice(0, 12)
    .map(
      (r) =>
        `- ${r.employeeName} [${r.employeeId}]: ${r.department}, ${r.location}, ${r.jobLevel}, ${r.workArrangement} (${r.workStatus}), Team Mood ${r.engagementScore}/100, Late Tasks ${r.overdueTasks}/${r.totalTasks}, Workload ${r.workloadLevel}, Leave Left ${r.leaveDaysRemaining}d, Stress Level ${getStressLevel(r.compositeBurnoutRiskScore)}, Reason: ${r.attentionReason}`
    );

  return [
    `Date: ${snapshotDate}`,
    `Total Staff: ${k.totalWorkforce} | Present: ${k.presentCount}, Remote: ${k.remoteCount}, Leave: ${k.leaveCount}, Absent: ${k.absentCount}`,
    `Working Today: ${k.availableCount} (${k.availabilityRate}%) | Avg Team Mood: ${k.avgEngagement}/100 (Goal: ${thresholds.engagementTarget})`,
    `Needs Check-In: ${k.needsAttentionCount} (${k.needsAttentionRate}%) | Heavy Load + Unused Leave: ${k.burnoutTrapCount}`,
    `Open Tasks: ${k.pendingTasks} (Avg ${k.avgPendingPerEmployee}/person) | Late Tasks: ${k.overdueTasks}`,
    '',
    'DEPARTMENTS:',
    ...deptLines,
    '',
    'UK OFFICES:',
    ...locLines,
    '',
    'KEY TAKEAWAYS:',
    ...insights.map((ins) => `- ${ins.headline}: ${ins.metricCallout}`),
    '',
    'STAFF NEEDING MOST SUPPORT:',
    ...topRisk,
  ].join('\n');
}

export function buildFallbackEmployeeActionPlan(
  emp: EmployeeRecord,
  thresholds: HRAlertThresholds
): ActionPlan {
  const highOverdue = emp.overdueTasks >= thresholds.overdueTaskCutoff;
  const lowEng = emp.engagementScore < thresholds.lowEngagementCutoff;
  const stress = getStressLevel(emp.compositeBurnoutRiskScore);

  return {
    id: `plan-${emp.employeeId}-${Date.now()}`,
    targetType: 'employee',
    targetId: emp.employeeId,
    targetLabel: `${emp.employeeName} (${emp.employeeId})`,
    createdAt: new Date().toISOString(),
    source: 'template',
    title: `How to Help ${emp.employeeName}`,
    urgency: stress === 'High' ? 'Check in within 48 hours' : stress === 'Medium' ? 'Check in this week' : 'Routine 1-on-1',
    owner: `${emp.department} Manager (${emp.location})`,
    diagnosis: `${emp.employeeName} currently has a ${stress} stress level (${emp.workloadLevel} workload, ${emp.overdueTasks} late tasks, Team Mood ${emp.engagementScore}/100, and ${emp.leaveDaysRemaining} leave days left).`,
    day30Actions: [
      highOverdue
        ? `Move ${Math.max(1, Math.ceil(emp.overdueTasks * 0.5))} of their ${emp.overdueTasks} late tasks to a teammate with a lighter load.`
        : `Go through their ${emp.pendingTasks} open tasks together and agree what can wait until next week.`,
      emp.isBurnoutTrap
        ? `Help them book 3 to 5 days off soon from their ${emp.leaveDaysRemaining} unused holiday days, with clear cover while they rest.`
        : `Check that they are finishing on time and taking proper breaks during their ${emp.workArrangement.toLowerCase()} week.`,
      lowEng
        ? `Have a warm, open 1-on-1 chat to ask what feels frustrating right now and celebrate recent wins.`
        : `Hold a friendly 15-minute check-in to make sure they feel supported by the team.`,
    ],
    day60Actions: [
      `Check back in two weeks to confirm workload stays at Moderate and late tasks stay down.`,
    ],
    day90Actions: [
      `Review progress together in their regular monthly 1-on-1.`,
    ],
    successKpis: [
      `Bring late tasks down from ${emp.overdueTasks} to 2 or fewer`,
      `Lift Team Mood toward ${thresholds.engagementTarget}/100`,
    ],
    coachingOpener: `"Hi ${emp.employeeName.split(' ')[0]}, I saw you have ${emp.overdueTasks} late tasks and ${emp.leaveDaysRemaining} holiday days left. Let's look at what we can take off your plate this week so things feel manageable."`,
  };
}

export function buildFallbackDepartmentActionPlan(
  deptName: string,
  deptRecords: EmployeeRecord[],
  thresholds: HRAlertThresholds
): ActionPlan {
  const k = computeKpis(deptRecords, thresholds);
  return {
    id: `plan-dept-${deptName}-${Date.now()}`,
    targetType: 'department',
    targetId: deptName,
    targetLabel: deptName,
    createdAt: new Date().toISOString(),
    source: 'template',
    title: `Support Plan for ${deptName}`,
    urgency: k.needsAttentionRate >= 30 ? 'Priority This Week' : 'Monthly Team Review',
    owner: `${deptName} Team Lead`,
    diagnosis: `${deptName} (${k.totalWorkforce} staff) has ${k.needsAttentionCount} people needing a check-in, an average Team Mood of ${k.avgEngagement}/100, and ${k.overdueTasks} late tasks.`,
    day30Actions: [
      `Have a 1-on-1 check-in with the ${k.burnoutTrapCount} staff carrying heavy loads and unused holiday.`,
      `Share out ${k.overdueTasks} late tasks across teammates who have spare capacity.`,
      `Book a quick 15-minute Monday morning team huddle to set realistic weekly priorities.`,
    ],
    day60Actions: [
      `Encourage everyone with ${thresholds.unusedLeaveCutoff}+ unused holiday days to put time off in the calendar.`,
    ],
    day90Actions: [
      `Check that Team Mood stays above ${thresholds.engagementTarget}/100 across all offices.`,
    ],
    successKpis: [
      `Cut late tasks by at least half`,
      `Lift average Team Mood to ${thresholds.engagementTarget}+`,
    ],
    coachingOpener: `"Team, we can see everyone has been carrying a heavy load recently. This week we are rebalancing overdue tasks and making sure everyone gets proper time off."`,
  };
}

export function exportRecordsToCsv(records: EmployeeRecord[], filename: string) {
  const rows = records.map((r) => ({
    'Employee ID': r.employeeId,
    'Employee Name': r.employeeName,
    Department: r.department,
    'Job Level': r.jobLevel,
    Location: r.location,
    'Work Arrangement': r.workArrangement,
    'Work Status': r.workStatus,
    'Hire Date': r.hireDate,
    'Total Tasks': r.totalTasks,
    'Completed Tasks': r.completedTasks,
    'Pending Tasks': r.pendingTasks,
    'Overdue Tasks': r.overdueTasks,
    'Engagement Score': r.engagementScore,
    'Workload Level': r.workloadLevel,
    'Leave Days Remaining': r.leaveDaysRemaining,
    'Attention Status': r.attentionStatus,
    'Attention Reason': r.attentionReason,
    'Last Updated': r.lastUpdated,
    'Task Completion Rate (%)': r.taskCompletionRate,
    'Overdue Task Ratio (%)': r.overdueTaskRatio,
    'Tenure Band': r.tenureBand,
    'Composite Burnout Risk Score': r.compositeBurnoutRiskScore,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function exportRecordsToXlsx(
  records: EmployeeRecord[],
  definitions: StatusDefinition[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  const empRows = records.map((r) => ({
    'Employee ID': r.employeeId,
    'Employee Name': r.employeeName,
    Department: r.department,
    'Job Level': r.jobLevel,
    Location: r.location,
    'Work Arrangement': r.workArrangement,
    'Work Status': r.workStatus,
    'Hire Date': r.hireDate,
    'Total Tasks': r.totalTasks,
    'Completed Tasks': r.completedTasks,
    'Pending Tasks': r.pendingTasks,
    'Overdue Tasks': r.overdueTasks,
    'Engagement Score': r.engagementScore,
    'Workload Level': r.workloadLevel,
    'Leave Days Remaining': r.leaveDaysRemaining,
    'Attention Status': r.attentionStatus,
    'Attention Reason': r.attentionReason,
    'Last Updated': r.lastUpdated,
    'Task Completion Rate (%)': r.taskCompletionRate,
    'Overdue Task Ratio (%)': r.overdueTaskRatio,
    'Tenure Band': r.tenureBand,
    'Composite Burnout Risk Score': r.compositeBurnoutRiskScore,
  }));
  const ws1 = XLSX.utils.json_to_sheet(empRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Employee_Monitoring');

  if (definitions.length > 0) {
    const defRows = definitions.map((d) => ({ Field: d.field, Definition: d.definition }));
    const ws2 = XLSX.utils.json_to_sheet(defRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Status_Definitions');
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  );
}

export function exportGenericCsv(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
