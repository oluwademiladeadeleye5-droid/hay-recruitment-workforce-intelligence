import React, { useState } from 'react';
import { FileSpreadsheet, FileText, BookOpen, Printer, Sparkles } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import {
  buildAiContextSummary,
  exportGenericCsv,
  exportRecordsToCsv,
  exportRecordsToXlsx,
  triggerDownload,
} from '../utils/analytics';

export const ReportsExportPage: React.FC = () => {
  const {
    filteredRecords,
    allRecords,
    definitions,
    dataset,
    kpis,
    insights,
    settings,
    pushToast,
  } = useWorkforce();

  const activeList = filteredRecords.length > 0 ? filteredRecords : allRecords;
  const [aiBrief, setAiBrief] = useState<string>('');
  const [loadingBrief, setLoadingBrief] = useState(false);

  const handleGenerateBrief = async () => {
    setLoadingBrief(true);
    try {
      const metricsSummary = buildAiContextSummary(
        activeList,
        settings.thresholds,
        dataset.qualityScorecard.snapshotDate
      );
      const res = await fetch('/api/ai/executive-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricsSummary,
          tone: settings.copilotTone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'AI service unavailable.');
      setAiBrief(data.brief || '');
      pushToast({ type: 'success', title: 'Executive Brief generated' });
    } catch {
      const fallbackBrief = [
        `Hay Recruitment UK Workforce Executive Brief (Snapshot ${dataset.qualityScorecard.snapshotDate})`,
        `Across ${kpis.totalWorkforce} monitored staff, workforce availability stands at ${kpis.availabilityRate}% (${kpis.availableCount} Present or Remote). Average engagement is ${kpis.avgEngagement}/100 against a target of ${settings.thresholds.engagementTarget}, while ${kpis.needsAttentionCount} employees (${kpis.needsAttentionRate}%) trigger Needs Attention flags.`,
        `Task velocity shows ${kpis.pendingTasks.toLocaleString()} pending items and ${kpis.overdueTasks.toLocaleString()} overdue tasks (${kpis.overdueShareOfTotal}% of total workload), with ${kpis.burnoutTrapCount} employees exhibiting unused-leave burnout trap signals.`,
      ].join('\n\n');
      setAiBrief(fallbackBrief);
      pushToast({
        type: 'warning',
        title: 'Generated Deterministic Boardroom Brief',
        detail: 'Gemini API is not configured; compiled live telemetry summary.',
      });
    } finally {
      setLoadingBrief(false);
    }
  };

  const downloadHtmlBrief = () => {
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Hay Recruitment — Executive Workforce Brief (${dataset.qualityScorecard.snapshotDate})</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0A2540; max-width: 900px; margin: 40px auto; padding: 0 24px; line-height: 1.55; }
  h1 { color: #0A2540; border-bottom: 3px solid #00A859; padding-bottom: 10px; }
  .meta { color: #425466; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 20px 0 28px; }
  .card { border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; }
  .label { font-size: 12px; color: #425466; }
  .val { font-size: 22px; font-weight: 700; margin-top: 4px; }
  .insight { border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .insight h3 { margin: 0 0 6px; font-size: 15px; color: #533AFD; }
  .brief { background: #F6F9FC; padding: 18px; border-radius: 12px; white-space: pre-wrap; margin-bottom: 24px; }
</style>
</head>
<body>
  <h1>Hay Recruitment UK — Executive Workforce Intelligence Brief</h1>
  <div class="meta">Source: ${dataset.filename} · Snapshot: ${dataset.qualityScorecard.snapshotDate} · Cohort: ${activeList.length} Employees</div>
  <div class="grid">
    <div class="card"><div class="label">Workforce Availability</div><div class="val">${kpis.availabilityRate}% (${kpis.availableCount})</div></div>
    <div class="card"><div class="label">Avg Engagement Score</div><div class="val">${kpis.avgEngagement} / 100</div></div>
    <div class="card"><div class="label">Needs Attention</div><div class="val">${kpis.needsAttentionCount} (${kpis.needsAttentionRate}%)</div></div>
    <div class="card"><div class="label">Pending Tasks</div><div class="val">${kpis.pendingTasks.toLocaleString()}</div></div>
    <div class="card"><div class="label">Overdue Tasks</div><div class="val">${kpis.overdueTasks.toLocaleString()}</div></div>
    <div class="card"><div class="label">Burnout Trap Staff</div><div class="val">${kpis.burnoutTrapCount}</div></div>
  </div>
  ${aiBrief ? `<h2>Executive Narrative</h2><div class="brief">${aiBrief.replace(/</g, '&lt;')}</div>` : ''}
  <h2>Quantified Insights & Action Plan</h2>
  ${insights
    .map(
      (i) =>
        `<div class="insight"><h3>${i.category}: ${i.headline} (${i.metricCallout})</h3><p>${i.evidence}</p><p><strong>Action:</strong> ${i.recommendation} — <em>${i.expectedImpact}</em></p></div>`
    )
    .join('')}
</body>
</html>`;

    triggerDownload(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      `Hay_Executive_Brief_${dataset.qualityScorecard.snapshotDate}.html`
    );
    pushToast({ type: 'success', title: 'Boardroom Brief HTML downloaded' });
  };

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
          Reports & Export Center
        </h1>
        <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
          One-click boardroom exports grounded in your active filtered cohort ({activeList.length} employees)
        </p>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 hay-card-shadow flex flex-col justify-between gap-4">
          <div>
            <FileSpreadsheet className="w-6 h-6 text-[#00A859] dark:text-[#10B981] mb-3" />
            <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
              Filtered Employee Risk Register
            </h2>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-1 leading-relaxed">
              Full 18-column cleaned dataset plus engineered completion rates, tenure bands, and Composite Burnout Risk Scores.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                exportRecordsToXlsx(
                  activeList,
                  definitions,
                  `Hay_Risk_Register_${dataset.qualityScorecard.snapshotDate}.xlsx`
                );
                pushToast({ type: 'success', title: 'Multi-sheet Excel workbook exported' });
              }}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] text-white cursor-pointer"
            >
              Download .xlsx
            </button>
            <button
              type="button"
              onClick={() => {
                exportRecordsToCsv(
                  activeList,
                  `Hay_Risk_Register_${dataset.qualityScorecard.snapshotDate}.csv`
                );
                pushToast({ type: 'success', title: 'Risk Register CSV exported' });
              }}
              className="px-4 py-2 rounded-full text-xs font-semibold border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-100 cursor-pointer"
            >
              Download .csv
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 hay-card-shadow flex flex-col justify-between gap-4">
          <div>
            <FileText className="w-6 h-6 text-[#533AFD] dark:text-[#7C6BFF] mb-3" />
            <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
              Executive Insights Brief
            </h2>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-1 leading-relaxed">
              Boardroom-ready KPI summary, AI/deterministic executive narrative, and top quantified HR recommendations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadHtmlBrief}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-[#533AFD] hover:bg-[#4434D4] text-white cursor-pointer"
            >
              Download HTML Brief
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-100 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 hay-card-shadow flex flex-col justify-between gap-4">
          <div>
            <BookOpen className="w-6 h-6 text-[#00B4D8] dark:text-[#38BDF8] mb-3" />
            <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
              Status Definitions Reference
            </h2>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-1 leading-relaxed">
              Export the active glossary ({definitions.length} definitions) for HR partner onboarding and audit packs.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                exportGenericCsv(
                  definitions.map((d) => ({ Field: d.field, Definition: d.definition })),
                  'Hay_Status_Definitions.csv'
                );
                pushToast({ type: 'success', title: 'Status Definitions CSV downloaded' });
              }}
              className="px-4 py-2 rounded-full text-xs font-semibold border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-100 hover:border-[#533AFD] cursor-pointer"
            >
              Download Glossary CSV
            </button>
          </div>
        </div>
      </div>

      {/* Printable Executive Brief Preview */}
      <section className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0A2540] dark:text-white">
              Printable Executive Brief Preview
            </h2>
            <p className="text-xs text-[#425466] dark:text-slate-400">
              Snapshot {dataset.qualityScorecard.snapshotDate} · Cohort {activeList.length} employees
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateBrief}
            disabled={loadingBrief}
            className="no-print inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#533AFD] hover:bg-[#4434D4] text-white cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loadingBrief ? 'Composing Brief...' : 'Generate AI Executive Narrative'}</span>
          </button>
        </div>

        {aiBrief && (
          <div className="p-4 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45]/60 border border-[#E2E8F0] dark:border-[#1E3A5F] text-xs sm:text-sm text-[#0A2540] dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
            {aiBrief}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {insights.slice(0, 6).map((ins) => (
            <div
              key={ins.id}
              className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F]"
            >
              <p className="font-bold text-[#0A2540] dark:text-white">
                {ins.category}: {ins.headline}
              </p>
              <p className="text-[#533AFD] dark:text-[#7C6BFF] font-mono mt-0.5">{ins.metricCallout}</p>
              <p className="text-[#425466] dark:text-slate-300 mt-1">{ins.recommendation}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
