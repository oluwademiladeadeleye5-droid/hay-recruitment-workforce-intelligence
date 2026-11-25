import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  SlidersHorizontal,
  MapPin,
  Briefcase,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  BookmarkCheck,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { computeBurnoutRisk } from '../utils/dataEngine';
import {
  buildFallbackEmployeeActionPlan,
  getStressLevel,
  isHealthyReason,
} from '../utils/analytics';
import { ActionPlan } from '../types/workforce';

export const Employee360Drawer: React.FC = () => {
  const {
    allRecords,
    selectedEmployeeId,
    closeEmployeeDrawer,
    settings,
    savedPlans,
    saveActionPlan,
    pushToast,
  } = useWorkforce();

  const employee = useMemo(
    () => allRecords.find((r) => r.employeeId === selectedEmployeeId) || null,
    [allRecords, selectedEmployeeId]
  );

  // Simple "Test a Fix" Slider State
  const [moveLateTasks, setMoveLateTasks] = useState(0);
  const [grantLeaveDays, setGrantLeaveDays] = useState(0);

  // Helpful 3-bullet action tip state
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<ActionPlan | null>(null);

  useEffect(() => {
    if (!employee) return;
    setMoveLateTasks(0);
    setGrantLeaveDays(0);
    const existing = savedPlans.find(
      (p) => p.targetType === 'employee' && p.targetId === employee.employeeId
    );
    setActivePlan(existing || null);
  }, [employee, savedPlans]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEmployeeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEmployeeId, closeEmployeeDrawer]);

  const simulated = useMemo(() => {
    if (!employee) return null;
    const nextOverdue = Math.max(0, employee.overdueTasks - moveLateTasks);
    const nextPending = Math.max(0, employee.pendingTasks - moveLateTasks);
    const nextLeave = Math.max(0, employee.leaveDaysRemaining - grantLeaveDays);
    const moodBoost = Math.min(22, Math.round(moveLateTasks * 2.2 + grantLeaveDays * 1.1));
    const nextEngagement = Math.min(100, employee.engagementScore + moodBoost);

    // Automatically ease workload tier as tasks are moved or rest is approved
    let nextWorkload = employee.workloadLevel;
    if (
      (moveLateTasks >= Math.max(2, Math.ceil(employee.overdueTasks * 0.5)) || grantLeaveDays >= 5) &&
      (employee.workloadLevel === 'Critical' || employee.workloadLevel === 'High')
    ) {
      nextWorkload = employee.workloadLevel === 'Critical' ? 'High' : 'Moderate';
    }
    if (moveLateTasks >= Math.max(3, Math.ceil(employee.overdueTasks * 0.75)) && grantLeaveDays >= 5) {
      nextWorkload = 'Moderate';
    }

    return {
      nextOverdue,
      nextPending,
      nextLeave,
      nextEngagement,
      nextWorkload,
      ...computeBurnoutRisk(
        {
          engagementScore: nextEngagement,
          overdueTasks: nextOverdue,
          pendingTasks: nextPending,
          totalTasks: employee.totalTasks,
          workloadLevel: nextWorkload,
          leaveDaysRemaining: nextLeave,
        },
        settings.thresholds
      ),
    };
  }, [employee, moveLateTasks, grantLeaveDays, settings.thresholds]);

  if (!employee || !simulated) return null;

  const currentStress = getStressLevel(employee.compositeBurnoutRiskScore);
  const simulatedStress = getStressLevel(simulated.score);
  const needsCheckIn = employee.attentionStatus === 'Needs Attention';

  const totalT = Math.max(employee.totalTasks, 1);
  const completedPct = Math.round((employee.completedTasks / totalT) * 100);
  const overduePct = Math.round((employee.overdueTasks / totalT) * 100);
  const openOnTime = Math.max(0, employee.pendingTasks - employee.overdueTasks);
  const openSafePct = Math.max(0, 100 - completedPct - overduePct);
  const leaveBarPct = Math.min(100, Math.round((employee.leaveDaysRemaining / 28) * 100));

  const stressBadgeStyle = (level: 'Low' | 'Medium' | 'High') => {
    if (level === 'High') {
      return {
        dot: 'bg-[#E11D48] dark:bg-[#FB7185]',
        text: 'text-[#E11D48] dark:text-[#FB7185]',
        bg: 'bg-[#FFF1F2] dark:bg-[#FB7185]/15',
      };
    }
    if (level === 'Medium') {
      return {
        dot: 'bg-[#D97706] dark:bg-[#FBBF24]',
        text: 'text-[#D97706] dark:text-[#FBBF24]',
        bg: 'bg-[#FFFBEB] dark:bg-[#FBBF24]/15',
      };
    }
    return {
      dot: 'bg-[#00A859] dark:bg-[#10B981]',
      text: 'text-[#008A48] dark:text-[#10B981]',
      bg: 'bg-[#ECFDF5] dark:bg-[#10B981]/15',
    };
  };

  const currentBadge = stressBadgeStyle(currentStress);
  const simBadge = stressBadgeStyle(simulatedStress);

  const handleSuggestHelp = async () => {
    setIsGenerating(true);

    const summary = [
      `Name: ${employee.employeeName} [${employee.employeeId}]`,
      `Department: ${employee.department} | Role: ${employee.jobLevel} | Office: ${employee.location}`,
      `Work Setup: ${employee.workArrangement} | Today's Status: ${employee.workStatus}`,
      `Tasks: ${employee.completedTasks} Done, ${employee.pendingTasks} Open, ${employee.overdueTasks} Late (out of ${employee.totalTasks})`,
      `Team Mood: ${employee.engagementScore}/100 (Goal: ${settings.thresholds.engagementTarget})`,
      `Workload: ${employee.workloadLevel} | Leave Left: ${employee.leaveDaysRemaining} days`,
      `Check-In Status: ${needsCheckIn ? 'Needs Check-In' : 'On Track'} | Reason: ${employee.attentionReason}`,
      `Stress Level: ${currentStress}`,
    ].join('\n');

    try {
      const res = await fetch('/api/ai/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'employee',
          targetSummary: summary,
          tone: settings.copilotTone,
          ukGuidance: settings.ukEmploymentGuidance,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'AI offline');
      }
      const p = data.plan;
      const newPlan: ActionPlan = {
        id: `plan-${employee.employeeId}-${Date.now()}`,
        targetType: 'employee',
        targetId: employee.employeeId,
        targetLabel: `${employee.employeeName} (${employee.employeeId})`,
        createdAt: new Date().toISOString(),
        source: 'gemini',
        title: p.title || `How to Help ${employee.employeeName}`,
        urgency: p.urgency || 'Check in this week',
        owner: p.owner || `${employee.department} Manager`,
        diagnosis: p.diagnosis || '',
        day30Actions: Array.isArray(p.day30Actions) ? p.day30Actions.slice(0, 3) : [],
        day60Actions: Array.isArray(p.day60Actions) ? p.day60Actions : [],
        day90Actions: Array.isArray(p.day90Actions) ? p.day90Actions : [],
        successKpis: Array.isArray(p.successKpis) ? p.successKpis : [],
        coachingOpener: p.coachingOpener || '',
      };
      setActivePlan(newPlan);
      await saveActionPlan(newPlan);
    } catch {
      const fallback = buildFallbackEmployeeActionPlan(employee, settings.thresholds);
      setActivePlan(fallback);
      await saveActionPlan(fallback);
      pushToast({
        type: 'info',
        title: `Helpful tips ready for ${employee.employeeName}`,
        detail: 'Saved privately in your browser.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const quickTips = activePlan
    ? [...activePlan.day30Actions, ...activePlan.day60Actions].slice(0, 3)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#071321]/65 backdrop-blur-[2px]">
      <div
        className="fixed inset-0"
        onClick={closeEmployeeDrawer}
        aria-hidden="true"
      />
      <aside
        className="relative z-10 w-full max-w-xl bg-white dark:bg-[#0F2035] h-full overflow-y-auto border-l border-[#E2E8F0] dark:border-[#1E3A5F] shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Staff details for ${employee.employeeName}`}
      >
        {/* Warm Clean Header */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#0F2035]/95 backdrop-blur border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#425466] dark:text-slate-400">
              <span className="font-mono font-semibold text-[#533AFD] dark:text-[#7C6BFF]">
                {employee.employeeId}
              </span>
              <span aria-hidden="true">·</span>
              <span>{employee.department}</span>
            </div>
            <h2 className="text-xl font-bold text-[#0A2540] dark:text-white mt-0.5 truncate">
              {employee.employeeName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-[#425466] dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {employee.jobLevel}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {employee.location} ({employee.workArrangement})
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Joined {employee.hireDate}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  needsCheckIn
                    ? 'bg-[#FFF1F2] dark:bg-[#FB7185]/15 text-[#E11D48] dark:text-[#FB7185]'
                    : 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#008A48] dark:text-[#10B981]'
                }`}
              >
                {needsCheckIn ? 'Needs Check-In' : 'On Track'}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${currentBadge.bg} ${currentBadge.text}`}
              >
                <span className={`w-2 h-2 rounded-full ${currentBadge.dot}`} />
                <span>Stress Level: {currentStress}</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F6F9FC] dark:bg-[#162B45] text-[#425466] dark:text-slate-300">
                Today: {employee.workStatus}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeEmployeeDrawer}
            aria-label="Close staff details"
            className="p-2 rounded-lg text-slate-500 hover:text-[#0A2540] dark:hover:text-white hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Why they're highlighted */}
          <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F6F9FC] dark:bg-[#162B45]/60 flex items-start gap-3">
            {needsCheckIn ? (
              <AlertTriangle className="w-5 h-5 text-[#E11D48] dark:text-[#FB7185] shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-[#00A859] dark:text-[#10B981] shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#425466] dark:text-slate-400">
                {needsCheckIn ? "Why they're highlighted" : 'Current Status'}
              </p>
              <p className="font-bold text-[#0A2540] dark:text-white mt-0.5">
                {!isHealthyReason(employee.attentionReason)
                  ? employee.attentionReason
                  : needsCheckIn
                    ? 'Needs a friendly check-in soon'
                    : 'On Track: doing well right now'}
              </p>
              <p className="text-xs text-[#425466] dark:text-slate-300 mt-1">
                Workload: <span className="font-semibold">{employee.workloadLevel}</span>
                {employee.isBurnoutTrap &&
                  ' · Carrying a heavy workload with lots of unused holiday days'}
              </p>
            </div>
          </div>

          {/* 3 Simple Visual Bars */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#425466] dark:text-slate-400">
              At a Glance
            </h3>

            {/* Bar 1: Team Mood */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0F2035] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0A2540] dark:text-white">
                  1. Team Mood
                </span>
                <span className="font-bold tabular-nums text-[#0A2540] dark:text-white">
                  {employee.engagementScore} / 100
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-[#162B45] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${employee.engagementScore}%`,
                    backgroundColor:
                      employee.engagementScore < settings.thresholds.lowEngagementCutoff
                        ? '#E11D48'
                        : '#00A859',
                  }}
                />
              </div>
              <p className="text-[11px] text-[#425466] dark:text-slate-400">
                {employee.engagementScore < settings.thresholds.lowEngagementCutoff
                  ? `Below our ${settings.thresholds.lowEngagementCutoff} mood check-in level`
                  : `Healthy mood (team goal is ${settings.thresholds.engagementTarget})`}
              </p>
            </div>

            {/* Bar 2: Tasks Completed vs. Late */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0F2035] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0A2540] dark:text-white">
                  2. Tasks Completed vs. Late ({employee.totalTasks} total)
                </span>
                <span className="font-bold tabular-nums text-[#0A2540] dark:text-white">
                  {employee.taskCompletionRate}% done
                </span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-[#162B45] flex">
                <div
                  style={{ width: `${completedPct}%` }}
                  className="bg-[#00A859] dark:bg-[#10B981] h-full"
                />
                <div
                  style={{ width: `${openSafePct}%` }}
                  className="bg-[#D97706] dark:bg-[#FBBF24] h-full"
                />
                <div
                  style={{ width: `${overduePct}%` }}
                  className="bg-[#E11D48] dark:bg-[#FB7185] h-full"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#425466] dark:text-slate-300 tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#00A859] dark:bg-[#10B981]" />
                  Completed: {employee.completedTasks}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706] dark:bg-[#FBBF24]" />
                  Open (on time): {openOnTime}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#E11D48] dark:text-[#FB7185]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#E11D48] dark:bg-[#FB7185]" />
                  Late: {employee.overdueTasks}
                </span>
              </div>
            </div>

            {/* Bar 3: Leave Days Left */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0F2035] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0A2540] dark:text-white">
                  3. Leave Days Left
                </span>
                <span className="font-bold tabular-nums text-[#0A2540] dark:text-white">
                  {employee.leaveDaysRemaining} days left
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-[#162B45] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#533AFD] dark:bg-[#7C6BFF] transition-all duration-300"
                  style={{ width: `${leaveBarPct}%` }}
                />
              </div>
              <p className="text-[11px] text-[#425466] dark:text-slate-400">
                {employee.leaveDaysRemaining >= settings.thresholds.unusedLeaveCutoff
                  ? 'Has plenty of holiday days available to book a break'
                  : 'Taking regular time off'}
              </p>
            </div>
          </div>

          {/* Simple "Test a Fix" Slider */}
          <div className="p-4 rounded-2xl border border-[#533AFD]/30 bg-[#EEF2FF]/65 dark:bg-[#162B45]/75 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#533AFD] dark:text-[#7C6BFF]" />
                <div>
                  <h3 className="text-sm font-bold text-[#0A2540] dark:text-white">
                    Test a Fix
                  </h3>
                  <p className="text-[11px] text-[#425466] dark:text-slate-400">
                    Slide to see how helping with tasks or leave lowers stress
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#425466] dark:text-slate-400">New Stress:</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${simBadge.bg} ${simBadge.text}`}
                >
                  <span className={`w-2 h-2 rounded-full ${simBadge.dot}`} />
                  <span>{simulatedStress}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between mb-1.5 gap-2">
                  <span className="text-[#0A2540] dark:text-slate-200 font-medium">
                    Move late tasks to another teammate
                  </span>
                  <span className="font-mono font-bold tabular-nums text-[#533AFD] dark:text-[#7C6BFF] shrink-0">
                    {moveLateTasks}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(employee.overdueTasks, 1)}
                  value={moveLateTasks}
                  onChange={(e) => setMoveLateTasks(Number(e.target.value))}
                  disabled={employee.overdueTasks === 0}
                  className="w-full accent-[#533AFD] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1.5 gap-2">
                  <span className="text-[#0A2540] dark:text-slate-200 font-medium">
                    Approve extra leave days
                  </span>
                  <span className="font-mono font-bold tabular-nums text-[#00A859] dark:text-[#10B981] shrink-0">
                    {grantLeaveDays}d
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(employee.leaveDaysRemaining, 1)}
                  value={grantLeaveDays}
                  onChange={(e) => setGrantLeaveDays(Number(e.target.value))}
                  disabled={employee.leaveDaysRemaining === 0}
                  className="w-full accent-[#00A859] cursor-pointer"
                />
              </div>
            </div>

            {(moveLateTasks > 0 || grantLeaveDays > 0) && (
              <p className="text-xs font-medium text-[#008A48] dark:text-[#10B981]">
                {simulatedStress !== currentStress
                  ? `Stress drops from ${currentStress} to ${simulatedStress}, and late tasks fall from ${employee.overdueTasks} to ${simulated.nextOverdue}.`
                  : `Late tasks drop to ${simulated.nextOverdue} and estimated mood lifts toward ${simulated.nextEngagement}/100.`}
              </p>
            )}
          </div>

          {/* 1-Click "Suggest How to Help" Button */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0A2540] dark:text-white">
                  Practical Ways to Help
                </h3>
                <p className="text-xs text-[#425466] dark:text-slate-400">
                  Get 3 short, friendly tips for a 1-on-1 check-in
                </p>
              </div>
              <button
                type="button"
                onClick={handleSuggestHelp}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#533AFD] hover:bg-[#4434D4] dark:bg-[#7C6BFF] dark:hover:bg-[#533AFD] text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isGenerating
                    ? 'Thinking...'
                    : activePlan
                      ? 'Refresh Help Tips'
                      : 'Suggest How to Help'}
                </span>
              </button>
            </div>

            {activePlan && (
              <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F6F9FC] dark:bg-[#162B45]/70 p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#0A2540] dark:text-white">
                      {activePlan.title}
                    </h4>
                    <p className="text-[#425466] dark:text-slate-400 mt-0.5">
                      When to act: <span className="font-semibold text-[#533AFD] dark:text-[#7C6BFF]">{activePlan.urgency}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#00A859] dark:text-[#10B981] shrink-0">
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    Saved
                  </span>
                </div>

                {quickTips.length > 0 && (
                  <ul className="space-y-2 text-[#0A2540] dark:text-slate-200 list-disc pl-4 leading-relaxed">
                    {quickTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                )}

                {activePlan.coachingOpener && (
                  <div className="p-3 rounded-xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-200">
                    <span className="font-semibold block text-[11px] text-[#533AFD] dark:text-[#7C6BFF] mb-1">
                      What to say in your 1-on-1
                    </span>
                    <p className="italic leading-relaxed">{activePlan.coachingOpener}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
