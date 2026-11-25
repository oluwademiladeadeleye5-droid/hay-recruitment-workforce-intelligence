import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  ArrowUpRight,
  Send,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { buildAiContextSummary } from '../utils/analytics';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  retryPrompt?: string;
}

type AiBadgeStatus = 'missing_key' | 'ready' | 'live' | 'error';

const STARTER_PROMPTS = [
  'Who needs help most right now?',
  'Which office is doing best?',
  'Give me 5 executive takeaways',
  'How many people are on leave?',
];

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
  const clientViteKey = (import.meta.env?.VITE_GEMINI_API_KEY || '').trim();
  const hasApiKey =
    aiConfigured || Boolean(clientViteKey && clientViteKey !== 'MY_GEMINI_API_KEY');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! Ask me anything about your **${activeRecords.length} Hay Recruitment staff**, like who needs support today, how our UK offices compare, or quick executive takeaways.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [badgeStatus, setBadgeStatus] = useState<AiBadgeStatus>(
    hasApiKey ? 'ready' : 'missing_key'
  );
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBadgeStatus((prev) => {
      if (!hasApiKey) return 'missing_key';
      return prev === 'missing_key' ? 'ready' : prev;
    });
  }, [hasApiKey]);

  const contextSummary = useMemo(
    () =>
      buildAiContextSummary(
        activeRecords,
        settings.thresholds,
        dataset.qualityScorecard.snapshotDate
      ),
    [activeRecords, settings.thresholds, dataset.qualityScorecard.snapshotDate]
  );

  const copyAllInsights = async () => {
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
        title: 'All insights copied',
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

  const sendPrompt = async (promptText: string, options?: { replaceErrorId?: string }) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    const priorHistory = messages
      .filter((m) => m.id !== 'welcome' && !m.isError)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    if (options?.replaceErrorId) {
      setMessages((prev) => prev.filter((m) => m.id !== options.replaceErrorId));
    } else {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    }
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
          history: priorHistory,
        }),
      });

      let data: { reply?: string; error?: string; code?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (data?.code === 'MISSING_API_KEY' || res.status === 503) {
          setBadgeStatus('missing_key');
        } else {
          setBadgeStatus('error');
        }
        const apiError =
          data?.error ||
          (res.status === 429
            ? 'Quota or rate limit exceeded: please wait a moment and retry.'
            : res.status === 503
              ? 'API key not configured in server environment variables.'
              : `Request failed (HTTP ${res.status}). Please retry.`);
        throw new Error(apiError);
      }

      const replyText = typeof data?.reply === 'string' ? data.reply.trim() : '';
      if (!replyText) {
        setBadgeStatus('error');
        throw new Error('Gemini returned an empty response. Please retry.');
      }

      setBadgeStatus('live');
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: replyText.replace(/\s*—\s*/g, ', '),
        },
      ]);
    } catch (err: unknown) {
      setBadgeStatus((prev) => (prev === 'missing_key' ? 'missing_key' : 'error'));
      const rawErr = err instanceof Error ? err.message : '';
      const isNetworkFailure =
        err instanceof TypeError ||
        rawErr.toLowerCase().includes('failed to fetch') ||
        rawErr.toLowerCase().includes('networkerror');
      const errorText = isNetworkFailure
        ? 'Network connection error: unable to reach the server. Please check your connection and retry.'
        : (rawErr || 'Unable to reach Gemini AI right now. Please retry.').replace(/\s*—\s*/g, ', ');

      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: 'assistant',
          content: errorText,
          isError: true,
          retryPrompt: trimmed,
        },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  const badgeConfig =
    badgeStatus === 'live'
      ? {
          label: 'Gemini AI Live',
          pillClass:
            'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#008A48] dark:text-[#10B981] border-[#00A859]/25',
          dotClass: 'bg-[#00A859] dark:bg-[#10B981]',
        }
      : badgeStatus === 'ready'
        ? {
            label: 'Gemini AI Ready',
            pillClass:
              'bg-[#EEF2FF] dark:bg-[#7C6BFF]/15 text-[#533AFD] dark:text-[#7C6BFF] border-[#533AFD]/25',
            dotClass: 'bg-[#533AFD] dark:bg-[#7C6BFF]',
          }
        : badgeStatus === 'missing_key'
          ? {
              label: 'AI Offline (Missing API Key)',
              pillClass:
                'bg-[#FFF1F2] dark:bg-[#FB7185]/15 text-[#E11D48] dark:text-[#FB7185] border-[#E11D48]/25',
              dotClass: 'bg-[#E11D48] dark:bg-[#FB7185]',
            }
          : {
              label: 'AI Offline',
              pillClass:
                'bg-[#FFF1F2] dark:bg-[#FB7185]/15 text-[#E11D48] dark:text-[#FB7185] border-[#E11D48]/25',
              dotClass: 'bg-[#E11D48] dark:bg-[#FB7185]',
            };

  return (
    <div className="space-y-8">
      {/* TOP HALF: Friendly AI Helper */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
              Friendly AI Helper
            </h1>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
              Ask a question in everyday English, grounded in the {activeRecords.length} staff currently shown
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border self-start sm:self-auto whitespace-nowrap ${badgeConfig.pillClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${badgeConfig.dotClass}`} />
            <span>{badgeConfig.label}</span>
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
                      : m.isError
                        ? 'bg-[#FFF1F2] dark:bg-[#E11D48]/20 text-[#E11D48] dark:text-[#FB7185]'
                        : 'bg-[#EEF2FF] dark:bg-[#7C6BFF]/20 text-[#533AFD] dark:text-[#7C6BFF]'
                  }`}
                >
                  {m.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : m.isError ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#0A2540] text-white dark:bg-[#533AFD] whitespace-pre-wrap'
                      : m.isError
                        ? 'bg-[#FFF1F2] dark:bg-[#E11D48]/10 text-[#9F1239] dark:text-[#FECDD3] border border-[#E11D48]/30'
                        : 'bg-[#F6F9FC] dark:bg-[#162B45]/75 text-[#0A2540] dark:text-slate-100 border border-[#E2E8F0] dark:border-[#1E3A5F]'
                  }`}
                >
                  {m.isError ? (
                    <div className="space-y-2.5">
                      <p className="font-medium leading-relaxed">{m.content}</p>
                      {m.retryPrompt && (
                        <button
                          type="button"
                          onClick={() =>
                            sendPrompt(m.retryPrompt!, { replaceErrorId: m.id })
                          }
                          disabled={isSending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] text-[#E11D48] dark:text-[#FB7185] border border-[#E11D48]/30 hover:bg-[#E11D48] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  ) : m.role === 'assistant' ? (
                    <MarkdownRenderer content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-[#425466] dark:text-slate-400">
                <Sparkles className="w-4 h-4 text-[#533AFD] animate-spin" />
                <span>Thinking with live team data...</span>
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

      {/* BOTTOM HALF: Ready-Made Takeaways */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0A2540] dark:text-white">
              Your Ready-Made Takeaways
            </h2>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
              {insights.length} plain-English findings from your live team data ({kpis.totalWorkforce} staff)
            </p>
          </div>

          <button
            type="button"
            onClick={copyAllInsights}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] text-white cursor-pointer whitespace-nowrap shrink-0 self-start"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy All Insights</span>
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

                <h3 className="text-base font-bold text-[#0A2540] dark:text-white leading-snug">
                  {ins.headline}
                </h3>

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
    </div>
  );
};
