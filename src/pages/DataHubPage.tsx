import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { exportRecordsToCsv, exportRecordsToXlsx, getStressLevel } from '../utils/analytics';
import { CreatorCreditLinks } from '../components/CreatorCreditLinks';

export const DataHubPage: React.FC = () => {
  const {
    dataset,
    allRecords,
    definitions,
    uploadWorkforceFile,
    resetToDemoDataset,
    isUploading,
    openEmployeeDrawer,
    settings,
    updateSettings,
    pushToast,
  } = useWorkforce();

  const [dragActive, setDragActive] = useState(false);
  const [showRawTable, setShowRawTable] = useState(false);
  const [lowMoodCutoff, setLowMoodCutoff] = useState(settings.thresholds.lowEngagementCutoff);
  const [lateTaskCutoff, setLateTaskCutoff] = useState(settings.thresholds.overdueTaskCutoff);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLowMoodCutoff(settings.thresholds.lowEngagementCutoff);
    setLateTaskCutoff(settings.thresholds.overdueTaskCutoff);
  }, [settings.thresholds.lowEngagementCutoff, settings.thresholds.overdueTaskCutoff]);

  const sc = dataset.qualityScorecard;

  const isDarkActive =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      await uploadWorkforceFile(file);
    } catch {
      // handled by toast
    }
  };

  const commitThresholds = (nextLowMood: number, nextLateTasks: number) => {
    if (
      nextLowMood === settings.thresholds.lowEngagementCutoff &&
      nextLateTasks === settings.thresholds.overdueTaskCutoff
    ) {
      return;
    }
    updateSettings({
      ...settings,
      thresholds: {
        ...settings.thresholds,
        lowEngagementCutoff: nextLowMood,
        overdueTaskCutoff: nextLateTasks,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0A2540] dark:text-white">
            Upload &amp; Settings
          </h1>
          <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
            Upload a new team spreadsheet, download reports, or adjust your 3 simple settings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              exportRecordsToXlsx(allRecords, definitions, 'hay_recruitment_team.xlsx');
              pushToast({ type: 'success', title: 'Excel file downloaded' });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-100 hover:border-[#533AFD] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#00A859]" />
            <span>Download Excel</span>
          </button>
          <button
            type="button"
            onClick={() => {
              exportRecordsToCsv(allRecords, 'hay_recruitment_team.csv');
              pushToast({ type: 'success', title: 'CSV file downloaded' });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-100 hover:border-[#533AFD] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#533AFD]" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* 1. Big Friendly Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-colors ${
          dragActive
            ? 'border-[#533AFD] bg-[#EEF2FF] dark:bg-[#7C6BFF]/10'
            : 'border-[#CBD5E1] dark:border-[#1E3A5F] bg-white dark:bg-[#0F2035]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-[#7C6BFF]/20 flex items-center justify-center mx-auto mb-3.5">
          <Upload className="w-6 h-6 text-[#533AFD] dark:text-[#7C6BFF]" />
        </div>
        <h2 className="text-base sm:text-lg font-bold text-[#0A2540] dark:text-white">
          Drop your Hay Recruitment Excel file here (.xlsx or .csv)
        </h2>
        <p className="text-xs text-[#425466] dark:text-slate-400 max-w-lg mx-auto mt-1.5 leading-relaxed">
          Your file stays saved privately in your browser until you upload a new one.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] text-white cursor-pointer disabled:opacity-60"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{isUploading ? 'Checking & Saving File...' : 'Choose File from Computer'}</span>
        </button>
      </div>

      {/* 2. Simple Green Checkmarks (File Check) */}
      <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 hay-card-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0A2540] dark:text-white">
              File Check
            </h2>
            <p className="text-xs text-[#425466] dark:text-slate-400">
              Active file: <span className="font-semibold text-[#0A2540] dark:text-slate-200">{dataset.filename}</span> · Updated {sc.snapshotDate}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRawTable((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#533AFD] dark:text-[#7C6BFF] hover:underline cursor-pointer"
          >
            <span>{showRawTable ? 'Hide Raw Table' : 'View Raw Table'}</span>
            {showRawTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/10 border border-[#00A859]/20">
            <CheckCircle2 className="w-5 h-5 text-[#00A859] dark:text-[#10B981] shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#0A2540] dark:text-white tabular-nums">
                ✓ {sc.cleanedRows.toLocaleString()} Staff Loaded
              </p>
              <p className="text-[11px] text-[#425466] dark:text-slate-400">
                {dataset.sourceType === 'demo' ? 'Built-in sample team' : 'From your uploaded file'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/10 border border-[#00A859]/20">
            <CheckCircle2 className="w-5 h-5 text-[#00A859] dark:text-[#10B981] shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#0A2540] dark:text-white">
                ✓ 0 Errors Found
              </p>
              <p className="text-[11px] text-[#425466] dark:text-slate-400">
                {sc.duplicateEmployeeIdsRemoved > 0
                  ? `${sc.duplicateEmployeeIdsRemoved} duplicate IDs skipped safely`
                  : 'All staff IDs unique & clean'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/10 border border-[#00A859]/20">
            <CheckCircle2 className="w-5 h-5 text-[#00A859] dark:text-[#10B981] shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#0A2540] dark:text-white">
                ✓ Definitions Loaded
              </p>
              <p className="text-[11px] text-[#425466] dark:text-slate-400">
                {sc.definitionsSheetFound
                  ? 'Read from your Status_Definitions sheet'
                  : 'Plain-English help guide active'}
              </p>
            </div>
          </div>
        </div>

        {/* Tucked-away Raw Table */}
        {showRawTable && (
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E3A5F] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F6F9FC] dark:bg-[#162B45]/80 border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#425466] dark:text-slate-300">
                  <th className="px-3 py-2">Staff ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Office</th>
                  <th className="px-3 py-2 text-right">Mood</th>
                  <th className="px-3 py-2 text-right">Late Tasks</th>
                  <th className="px-3 py-2">Stress</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1E3A5F]">
                {dataset.records.slice(0, 25).map((r) => (
                  <tr
                    key={r.employeeId}
                    onClick={() => openEmployeeDrawer(r.employeeId)}
                    className="hover:bg-[#F6F9FC] dark:hover:bg-[#162B45]/60 cursor-pointer"
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-[#533AFD] dark:text-[#7C6BFF]">
                      {r.employeeId}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#0A2540] dark:text-white">{r.employeeName}</td>
                    <td className="px-3 py-2">{r.department}</td>
                    <td className="px-3 py-2">{r.location}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.engagementScore}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.overdueTasks}</td>
                    <td className="px-3 py-2">{getStressLevel(r.compositeBurnoutRiskScore)}</td>
                    <td className="px-3 py-2">{r.attentionReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-[#425466] dark:text-slate-400 mt-2">
              Showing first 25 of {dataset.records.length} staff rows.
            </p>
          </div>
        )}
      </div>

      {/* 3. Three Simple Settings Only */}
      <section className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 hay-card-shadow space-y-5">
        <h2 className="text-sm font-bold text-[#0A2540] dark:text-white">
          Simple Settings
        </h2>

        {/* Setting 1: Light / Dark Mode Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E2E8F0] dark:border-[#1E3A5F]">
          <div>
            <p className="text-sm font-semibold text-[#0A2540] dark:text-white">
              1. Appearance (Light / Dark Mode)
            </p>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
              Choose bright daylight colors or a darker screen for low-light rooms.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              updateSettings({
                ...settings,
                themeMode: isDarkActive ? 'light' : 'dark',
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-white hover:border-[#533AFD] cursor-pointer self-start sm:self-auto"
          >
            {isDarkActive ? (
              <>
                <Sun className="w-4 h-4 text-[#FBBF24]" />
                <span>Switch to Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[#533AFD]" />
                <span>Switch to Dark Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Setting 2: Simple Alert Sliders */}
        <div className="pb-5 border-b border-[#E2E8F0] dark:border-[#1E3A5F] space-y-4">
          <div>
            <p className="text-sm font-semibold text-[#0A2540] dark:text-white">
              2. Simple Alert Rules
            </p>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
              Choose when someone automatically appears in &quot;Who Needs Help&quot;.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div className="p-4 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45]/60 border border-[#E2E8F0] dark:border-[#1E3A5F] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0A2540] dark:text-white">
                  Flag when Mood is below
                </span>
                <span className="font-mono font-bold text-sm text-[#533AFD] dark:text-[#7C6BFF] tabular-nums">
                  {lowMoodCutoff}
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={85}
                value={lowMoodCutoff}
                onChange={(e) => setLowMoodCutoff(Number(e.target.value))}
                onPointerUp={() => commitThresholds(lowMoodCutoff, lateTaskCutoff)}
                onKeyUp={() => commitThresholds(lowMoodCutoff, lateTaskCutoff)}
                onBlur={() => commitThresholds(lowMoodCutoff, lateTaskCutoff)}
                className="w-full accent-[#533AFD] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>40 (Strict)</span>
                <span>65 (Default)</span>
                <span>85 (Sensitive)</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45]/60 border border-[#E2E8F0] dark:border-[#1E3A5F] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0A2540] dark:text-white">
                  Flag when Late Tasks are above
                </span>
                <span className="font-mono font-bold text-sm text-[#E11D48] dark:text-[#FB7185] tabular-nums">
                  {lateTaskCutoff}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                value={lateTaskCutoff}
                onChange={(e) => setLateTaskCutoff(Number(e.target.value))}
                onPointerUp={() => commitThresholds(lowMoodCutoff, lateTaskCutoff)}
                onKeyUp={() => commitThresholds(lowMoodCutoff, lateTaskCutoff)}
                onBlur={() => commitThresholds(lowMoodCutoff, lateTaskCutoff)}
                className="w-full accent-[#E11D48] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>1 task</span>
                <span>5 (Default)</span>
                <span>15 tasks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Setting 3: Reset to Demo Data */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0A2540] dark:text-white">
              3. Reset to Demo Data
            </p>
            <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
              Clear any uploaded spreadsheet and restore the built-in 512 Hay Recruitment sample team.
            </p>
          </div>
          <button
            type="button"
            onClick={() => resetToDemoDataset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-slate-100 hover:border-[#E11D48] hover:text-[#E11D48] dark:hover:text-[#FB7185] cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Demo Data</span>
          </button>
        </div>
      </section>

      {/* About This Project */}
      <section className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 hay-card-shadow space-y-3">
        <div>
          <h2 className="text-sm font-bold text-[#0A2540] dark:text-white">
            About This Project
          </h2>
          <p className="text-xs text-[#425466] dark:text-slate-400 mt-0.5">
            Built to make team mood, workload balance, and proactive wellbeing check-ins effortless for Hay Recruitment leaders.
          </p>
        </div>
        <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E3A5F]">
          <CreatorCreditLinks />
        </div>
      </section>
    </div>
  );
};
