import React, { useEffect, useRef, useState } from 'react';
import {
  Sliders,
  Bot,
  Palette,
  Database,
  RotateCcw,
  Download,
  Upload,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import {
  CopilotTone,
  NavPageId,
  PlatformSettings,
  StartupView,
  TableDensity,
  ThemeMode,
} from '../types/workforce';
import { getStorageDiagnostics } from '../utils/storage';
import { triggerDownload } from '../utils/analytics';

type SettingsTab = 'thresholds' | 'copilot' | 'appearance' | 'storage';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetSettings,
    dataset,
    definitions,
    savedPlans,
    resetToDemoDataset,
    restoreWorkspaceBackup,
    pushToast,
  } = useWorkforce();

  const [tab, setTab] = useState<SettingsTab>('thresholds');
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [diag, setDiag] = useState<{ backend: string; approxBytes: number; keysPresent: string[] } | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (tab === 'storage') {
      getStorageDiagnostics().then(setDiag).catch(() => {});
    }
  }, [tab, dataset, savedPlans]);

  const handleSave = async () => {
    await updateSettings(draft);
  };

  const exportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      dataset,
      definitions,
      settings,
      savedPlans,
    };
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `Hay_Workforce_Backup_${dataset.qualityScorecard.snapshotDate}.json`
    );
    pushToast({ type: 'success', title: 'Workspace backup exported (.json)' });
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await restoreWorkspaceBackup(text);
    } catch {
      pushToast({ type: 'error', title: 'Invalid backup file' });
    } finally {
      e.target.value = '';
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'thresholds', label: 'HR Alert Thresholds', icon: <Sliders className="w-4 h-4" /> },
    { id: 'copilot', label: 'AI Copilot Preferences', icon: <Bot className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance & Workspace', icon: <Palette className="w-4 h-4" /> },
    { id: 'storage', label: 'Storage & Data Governance', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
          Platform Settings
        </h1>
        <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
          Tailored for Hay Recruitment UK · Changes persist automatically to IndexedDB and recalculate live risk scores
        </p>
      </div>

      {/* 4 Live Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F]">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#533AFD] text-white'
                  : 'text-[#425466] dark:text-slate-300 hover:bg-[#F6F9FC] dark:hover:bg-[#162B45]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 hay-card-shadow space-y-6">
        {tab === 'thresholds' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
                HR Alert Thresholds & Risk Weights
              </h2>
              <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
                Updating these cutoffs live recalculates Watchlist queues and Composite Burnout Risk Scores across all employees.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">
                  Organizational Engagement Target (0–100)
                </span>
                <input
                  type="number"
                  min={40}
                  max={95}
                  value={draft.thresholds.engagementTarget}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      thresholds: { ...d.thresholds, engagementTarget: Number(e.target.value) },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] tabular-nums"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">
                  Low Engagement Alert Cutoff (Default &lt; 65)
                </span>
                <input
                  type="number"
                  min={20}
                  max={85}
                  value={draft.thresholds.lowEngagementCutoff}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      thresholds: { ...d.thresholds, lowEngagementCutoff: Number(e.target.value) },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] tabular-nums"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">
                  Overdue Task Warning Cutoff (Default &gt;= 5)
                </span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.thresholds.overdueTaskCutoff}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      thresholds: { ...d.thresholds, overdueTaskCutoff: Number(e.target.value) },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] tabular-nums"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">
                  Unused Leave Burnout Cutoff (Default &gt;= 15 days)
                </span>
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={draft.thresholds.unusedLeaveCutoff}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      thresholds: { ...d.thresholds, unusedLeaveCutoff: Number(e.target.value) },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] tabular-nums"
                />
              </label>
            </div>
          </div>
        )}

        {tab === 'copilot' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
                AI Copilot & Action Plan Preferences
              </h2>
              <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
                Customize how Gemini AI frames executive summaries and manager coaching scripts.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200 block">
                  Response Tone
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      'Executive HR Brief',
                      'People Partner Deep-Dive',
                      'Line Manager Coaching Script',
                    ] as CopilotTone[]
                  ).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, copilotTone: tone }))}
                      className={`p-3 rounded-xl border text-left font-medium cursor-pointer transition-colors ${
                        draft.copilotTone === tone
                          ? 'border-[#533AFD] bg-[#EEF2FF] dark:bg-[#7C6BFF]/15 text-[#533AFD] dark:text-[#7C6BFF]'
                          : 'border-[#E2E8F0] dark:border-[#1E3A5F] text-[#425466] dark:text-slate-300'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.ukEmploymentGuidance}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, ukEmploymentGuidance: e.target.checked }))
                  }
                  className="mt-0.5 accent-[#00A859]"
                />
                <div>
                  <span className="font-semibold text-[#0A2540] dark:text-white block">
                    Include UK Employment & ACAS Wellbeing Best Practices
                  </span>
                  <span className="text-[#425466] dark:text-slate-400">
                    Ground AI recommendations in UK statutory annual leave utilization, Working Time Regulations, and supportive People Partner check-ins.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {tab === 'appearance' && (
          <div className="space-y-5 text-xs">
            <div>
              <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
                Appearance & Workspace Defaults
              </h2>
              <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
                Configure startup view, Light/Midnight Slate theme, and table density persisted across reloads.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">
                  Startup Experience
                </span>
                <select
                  value={draft.startupView}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, startupView: e.target.value as StartupView }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] cursor-pointer"
                >
                  <option value="landing">Landing Page (Default)</option>
                  <option value="workspace">Executive Dashboard</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">Theme Mode</span>
                <select
                  value={draft.themeMode}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, themeMode: e.target.value as ThemeMode }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] cursor-pointer"
                >
                  <option value="light">Stripe Daylight (Light)</option>
                  <option value="dark">Midnight Slate (Dark)</option>
                  <option value="system">Match System</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">Table Density</span>
                <select
                  value={draft.tableDensity}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, tableDensity: e.target.value as TableDensity }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] cursor-pointer"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact (High Density)</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-semibold text-[#0A2540] dark:text-slate-200">
                  Default Workspace Tab
                </span>
                <select
                  value={draft.defaultLandingPage}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      defaultLandingPage: e.target.value as NavPageId,
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] cursor-pointer"
                >
                  <option value="overview">Executive Overview</option>
                  <option value="watchlist">Needs Attention Watchlist</option>
                  <option value="directory">Employee Directory</option>
                  <option value="insights">Capstone Insights Hub</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {tab === 'storage' && (
          <div className="space-y-5 text-xs">
            <div>
              <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
                IndexedDB Storage & Data Governance
              </h2>
              <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
                Inspect browser persistence, export full workspace backups, or reload the 512-employee Demo Dataset.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F]">
                <span className="text-[#425466] dark:text-slate-400 block">Active File</span>
                <span className="font-semibold text-[#0A2540] dark:text-white truncate block mt-0.5">
                  {dataset.filename}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F]">
                <span className="text-[#425466] dark:text-slate-400 block">Employee Records</span>
                <span className="font-bold text-base tabular-nums text-[#0A2540] dark:text-white block mt-0.5">
                  {dataset.records.length.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F]">
                <span className="text-[#425466] dark:text-slate-400 block">Last Updated</span>
                <span className="font-mono font-semibold text-[#0A2540] dark:text-white block mt-0.5">
                  {dataset.qualityScorecard.snapshotDate}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F]">
                <span className="text-[#425466] dark:text-slate-400 block">IndexedDB Footprint</span>
                <span className="font-mono font-semibold text-[#00A859] dark:text-[#10B981] block mt-0.5">
                  {diag ? `${(diag.approxBytes / 1024).toFixed(1)} KB` : 'Calculating...'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={exportBackup}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold bg-[#00A859] hover:bg-[#008A48] text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Workspace Backup (.json)</span>
              </button>

              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestoreFile}
              />
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-100 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Backup</span>
              </button>

              <button
                type="button"
                onClick={() => resetToDemoDataset()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold border border-[#E11D48]/40 text-[#E11D48] dark:text-[#FB7185] hover:bg-[#FFF1F2] dark:hover:bg-[#FB7185]/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear & Reload Demo Data</span>
              </button>
            </div>
          </div>
        )}

        {tab !== 'storage' && (
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E3A5F] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetSettings}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#425466] hover:text-[#0A2540] dark:hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Settings to Default</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] text-white transition-colors cursor-pointer"
            >
              Save & Apply Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
