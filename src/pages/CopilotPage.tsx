import React, { useMemo, useRef, useState } from 'react';
import { Send, Sparkles, Bot, User, AlertCircle } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { buildAiContextSummary } from '../utils/analytics';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_PROMPTS = [
  'Which UK office and department carry the highest burnout risk right now?',
  'Summarize the top 5 employees needing immediate manager intervention and why.',
  'Compare Hybrid vs Remote vs On-Site engagement and overdue tasks.',
  'Draft a People Partner briefing on our unused annual leave burnout trap.',
];

export const CopilotPage: React.FC = () => {
  const {
    filteredRecords,
    allRecords,
    dataset,
    settings,
    aiConfigured,
    kpis,
    insights,
  } = useWorkforce();

  const activeRecords = filteredRecords.length > 0 ? filteredRecords : allRecords;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am the Hay Recruitment HR Analytics Copilot, grounded in your active dataset (${activeRecords.length} employees, snapshot ${dataset.qualityScorecard.snapshotDate}). Ask me about regional engagement gaps, overdue backlogs, or specific interventions.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
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

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    setErrorBanner(null);
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
        throw new Error(data?.error || 'AI service returned an error.');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'No response received.',
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Gemini AI service.';
      setErrorBanner(msg);
      const topRisk = [...activeRecords]
        .sort((a, b) => b.compositeBurnoutRiskScore - a.compositeBurnoutRiskScore)
        .slice(0, 3)
        .map(
          (r) =>
            `- ${r.employeeName} [${r.employeeId}] (${r.department}, ${r.location}): Risk ${r.compositeBurnoutRiskScore}/100, Engagement ${r.engagementScore}, Overdue ${r.overdueTasks}`
        )
        .join('\n');

      setMessages((prev) => [
        ...prev,
        {
          id: `a-offline-${Date.now()}`,
          role: 'assistant',
          content: `Live Gemini AI is offline (${msg}).\n\nHere is a live deterministic snapshot from the active ${activeRecords.length} records:\n- Availability: ${kpis.availabilityRate}% | Avg Engagement: ${kpis.avgEngagement}/100 | Needs Attention: ${kpis.needsAttentionCount} (${kpis.needsAttentionRate}%)\n- Key Finding: ${insights[0]?.headline || 'N/A'} (${insights[0]?.metricCallout || ''})\n- Top Risk Staff:\n${topRisk}`,
        },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
            Hay HR AI Copilot
          </h1>
          <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
            Grounded in {activeRecords.length} active records · Tone: {settings.copilotTone}
            {settings.ukEmploymentGuidance ? ' · UK ACAS Wellbeing Mode' : ''}
          </p>
        </div>

        <span className="text-xs font-medium text-[#533AFD] dark:text-[#7C6BFF]">
          {aiConfigured ? 'Gemini API Ready' : 'Offline Telemetry Mode (Configure GEMINI_API_KEY in Secrets for live LLM)'}
        </span>
      </div>

      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-[#FFFBEB] dark:bg-[#FBBF24]/10 border border-[#D97706]/40 text-xs text-[#0A2540] dark:text-[#FBBF24] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Starter Prompt Chips */}
      <div className="flex flex-wrap gap-2">
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => sendPrompt(p)}
            disabled={isSending}
            className="text-left px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD] text-[#0A2540] dark:text-slate-200 transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] hay-card-shadow flex flex-col h-[520px]">
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
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
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
              <span>Analyzing live Hay Recruitment workforce telemetry...</span>
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
            placeholder="Ask about department burnout, overdue tasks, UK hubs, or manager coaching..."
            className="flex-1 h-10 px-3.5 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] text-sm text-[#0A2540] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#533AFD]"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-xs font-semibold bg-[#533AFD] hover:bg-[#4434D4] text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Ask Copilot</span>
          </button>
        </form>
      </div>
    </div>
  );
};
