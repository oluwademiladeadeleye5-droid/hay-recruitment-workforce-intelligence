import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  ArrowUpRight,
  Send,
  Sparkles,
  Bot,
  User,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import {
  buildAiContextSummary,
  computeKpis,
  getStressLevel,
} from '../utils/analytics';
import { EmployeeRecord } from '../types/workforce';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_PROMPTS = [
  'Who needs help most right now?',
  'Which office is doing best?',
  'Give me 5 takeaways for my presentation',
  'How many people are on leave?',
];

function buildSmartLocalReply(
  question: string,
  records: EmployeeRecord[],
  engagementTarget: number
): string {
  const q = question.toLowerCase();
  const k = computeKpis(records, {
    engagementTarget,
    lowEngagementCutoff: 65,
    overdueTaskCutoff: 5,
    unusedLeaveCutoff: 15,
  });

  if (q.includes('leave') || q.includes('holiday') || q.includes('absent')) {
    const leaveStaff = records.filter((r) => r.workStatus === 'Leave');
    const absentStaff = records.filter((r) => r.workStatus === 'Absent');
    const unusedLeaveCount = records.filter((r) => r.isBurnoutTrap).length;
    return [
      `Right now, ${leaveStaff.length} staff are on planned leave and ${absentStaff.length} are marked absent out of ${records.length} people.`,
      `• Working today (in office or remote): ${k.availableCount} staff (${k.availabilityRate}%).`,
      `• Heads-up: ${unusedLeaveCount} staff with heavy workloads still have 15+ unused holiday days and may need encouragement to book time off.`,
    ].join('\n');
  }

  if (q.includes('office') || q.includes('best') || q.includes('location')) {
    const locMap = new Map<string, EmployeeRecord[]>();
    records.forEach((r) => {
      const arr = locMap.get(r.location) || [];
      arr.push(r);
      locMap.set(r.location, arr);
    });
    const ranked = Array.from(locMap.entries())
      .map(([loc, list]) => {
        const lk = computeKpis(list, {
          engagementTarget,
          lowEngagementCutoff: 65,
          overdueTaskCutoff: 5,
          unusedLeaveCutoff: 15,
        });
        return { loc, count: list.length, ...lk };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    const best = ranked[0];
    const toughest = ranked[ranked.length - 1];
    if (!best) return 'No office data is currently loaded.';

    return [
      `${best.loc} is doing best right now with an average Team Mood of ${best.avgEngagement}/100 across ${best.count} staff.`,
      ...ranked.map(
        (r) =>
          `• ${r.loc}: Mood ${r.avgEngagement}/100 · ${r.needsAttentionCount} need a check-in · ${r.overdueTasks} late tasks`
      ),
      toughest && toughest.loc !== best.loc
        ? `Tip: Share what is working well in ${best.loc} with team leads in ${toughest.loc}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (q.includes('takeaway') || q.includes('presentation') || q.includes('5') || q.includes('summary')) {
    const deptMap = new Map<string, EmployeeRecord[]>();
    records.forEach((r) => {
      const arr = deptMap.get(r.department) || [];
      arr.push(r);
      deptMap.set(r.department, arr);
    });
    const worstDept = Array.from(deptMap.entries())
      .map(([dept, list]) => ({
        dept,
        flagged: list.filter((r) => r.attentionStatus === 'Needs Attention').length,
        total: list.length,
      }))
      .sort((a, b) => b.flagged - a.flagged)[0];

    return [
      `Here are 5 quick takeaways for your presentation (${records.length} staff):`,
      `1. Team availability is ${k.availabilityRate}% today (${k.presentCount} in office, ${k.remoteCount} remote).`,
      `2. Average Team Mood is ${k.avgEngagement}/100 (our goal is ${engagementTarget}/100).`,
      `3. ${k.needsAttentionCount} people (${k.needsAttentionRate}%) need a friendly check-in.`,
      `4. There are ${k.overdueTasks.toLocaleString()} late tasks across the business (${k.burnoutTrapCount} staff have heavy workloads and unused holiday).`,
      worstDept
        ? `5. ${worstDept.dept} has the highest number of check-ins needed (${worstDept.flagged} of ${worstDept.total} staff), making it a great place to focus first.`
        : `5. Focusing 1-on-1 check-ins on late tasks will give the fastest boost to team mood.`,
    ].join('\n');
  }

  // Default & "Who needs help most right now?"
  const topStaff = [...records]
    .sort((a, b) => b.compositeBurnoutRiskScore - a.compositeBurnoutRiskScore)
    .slice(0, 5);

  return [
    `Here are the ${topStaff.length} team members carrying the highest stress right now:`,
    ...topStaff.map(
      (r) =>
        `• ${r.employeeName} [${r.employeeId}] (${r.department}, ${r.location}): ${getStressLevel(r.compositeBurnoutRiskScore)} stress, Team Mood ${r.engagementScore}/100, ${r.overdueTasks} late tasks, ${r.leaveDaysRemaining}d leave left (${r.attentionReason}).`
    ),
    `Click any of their names in "Who Needs Help" to test moving late tasks or adding leave days.`,
  ].join('\n');
}

export const InsightsActionHubPage: React.FC = () => {
  const {
    allRecords,
    filteredRecords,
    dataset,
    insights,
    settings,
    kpis,
    aiConfigured,
    setFilterPatch,
    setActivePage,
    pushToast,
  } = useWorkforce();

  const activeRecords = filteredRecords.length > 0 ? filteredRecords : allRecords;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! Ask me anything about your ${activeRecords.length} Hay Recruitment staff, like who needs support today, how our UK offices compare, or quick points for a meeting.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const contextSummary = useMemo(
    () =>
      buildAiContextSummary(
        activeRecords,
        settings.thresholds,
        dataset.qualityScorecard.snapshotDate
      ),
    [activeRecords, settings.thresholds, dataset.qualityScorecard.snapshotDate]
  );

  const copyForSlideDeck = async () => {
    const text = insights
      .map(
        (ins, idx) =>
          `${idx + 1}. ${ins.headline} (${ins.metricCallout})\n   What we found: ${ins.evidence}\n   What to do: ${ins.recommendation}`
      )
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      pushToast({
        type: 'success',
        title: 'All insights copied for your slides',
        detail: `${insights.length} plain-English takeaways ready to paste.`,
      });
    } catch {
      pushToast({
        type: 'error',
        title: 'Could not copy automatically',
        detail: 'Please highlight and copy the text directly.',
      });
    }
  };

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          tone: settings.copilotTone,
          ukGuidance: settings.ukEmploymentGuidance,
          contextSummary,
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Offline');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'No reply received.',
        },
      ]);
    } catch {
      const smartAnswer = buildSmartLocalReply(
        trimmed,
        activeRecords,
        settings.thresholds.engagementTarget
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a-local-${Date.now()}`,
          role: 'assistant',
          content: smartAnswer,
        },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  return (
    <div className="space-y-8">
      {/* TOP HALF: 6 Plain-English Takeaways */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
              Your Ready-Made Takeaways
            </h1>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
              {insights.length} plain-English findings from your live team data ({kpis.totalWorkforce} staff)
            </p>
          </div>

          <button
            type="button"
            onClick={copyForSlideDeck}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] text-white cursor-pointer whitespace-nowrap shrink-0 self-start"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy All Insights for Slides</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.map((ins, idx) => (
            <article
              key={ins.id}
              className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 hay-card-shadow flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-2 font-bold text-[#533AFD] dark:text-[#7C6BFF]">
                    <span className="w-5 h-5 rounded-full bg-[#EEF2FF] dark:bg-[#7C6BFF]/20 flex items-center justify-center text-[11px]">
                      {idx + 1}
                    </span>
                    <span>Takeaway #{idx + 1}</span>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#425466] dark:text-slate-300 tabular-nums">
                    {ins.metricCallout}
                  </span>
                </div>

                <h2 className="text-base font-bold text-[#0A2540] dark:text-white leading-snug">
                  {ins.headline}
                </h2>

                <div className="text-xs text-[#425466] dark:text-slate-300 leading-relaxed space-y-2">
                  <p>
                    <span className="font-semibold text-[#0A2540] dark:text-white">
                      What we found:{' '}
                    </span>
                    {ins.evidence}
                  </p>
                  <p>
                    <span className="font-semibold text-[#008A48] dark:text-[#10B981]">
                      What to do:{' '}
                    </span>
                    {ins.recommendation}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#1E3A5F] flex items-center justify-between gap-3 text-xs">
                <span className="text-[11px] text-[#425466] dark:text-slate-400">
                  {ins.expectedImpact}
                </span>
                {ins.filterPatch && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterPatch(ins.filterPatch!);
                      setActivePage('overview');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#533AFD] dark:text-[#7C6BFF] hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>See these staff</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* BOTTOM HALF: Friendly AI Helper */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#0A2540] dark:text-white">
              Friendly AI Helper
            </h2>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
              Ask a question in everyday English, grounded in the {activeRecords.length} staff currently shown
            </p>
          </div>
          <span className="text-xs font-medium text-[#533AFD] dark:text-[#7C6BFF]">
            {aiConfigured ? 'Live AI Ready' : 'Instant Smart Answers Ready'}
          </span>
        </div>

        {/* Exact 4 Starter Buttons */}
        <div className="flex flex-wrap gap-2">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => sendPrompt(p)}
              disabled={isSending}
              className="text-left px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD] text-[#0A2540] dark:text-slate-200 transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat Box */}
        <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] hay-card-shadow flex flex-col h-[420px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-3 ${
                  m.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    m.role === 'user'
                      ? 'bg-[#00A859] text-white'
                      : 'bg-[#EEF2FF] dark:bg-[#7C6BFF]/20 text-[#533AFD] dark:text-[#7C6BFF]'
                  }`}
                >
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#0A2540] text-white dark:bg-[#533AFD]'
                      : 'bg-[#F6F9FC] dark:bg-[#162B45]/75 text-[#0A2540] dark:text-slate-100 border border-[#E2E8F0] dark:border-[#1E3A5F]'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-[#425466] dark:text-slate-400">
                <Sparkles className="w-4 h-4 text-[#533AFD] animate-spin" />
                <span>Looking through your team data...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendPrompt(input);
            }}
            className="p-3.5 border-t border-[#E2E8F0] dark:border-[#1E3A5F] flex items-center gap-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your team, offices, mood, or leave..."
              className="flex-1 h-10 px-3.5 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] text-sm text-[#0A2540] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#533AFD]"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-xs font-semibold bg-[#533AFD] hover:bg-[#4434D4] text-white transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Ask</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
