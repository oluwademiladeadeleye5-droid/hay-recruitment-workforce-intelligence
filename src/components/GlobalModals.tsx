import React, { useEffect, useMemo, useState } from 'react';
import { X, HelpCircle, Search, ArrowRight, Users, Sparkles } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { NavPageId } from '../types/workforce';
import { getStressLevel } from '../utils/analytics';

export const StatusDefinitionsModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { definitions, dataset } = useWorkforce();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#071321]/65 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Guide and Status Definitions"
    >
      <div className="bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-[#1E3A5F] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-[#533AFD] dark:text-[#7C6BFF]" />
            <div>
              <h2 className="text-base font-bold text-[#0A2540] dark:text-white">
                Quick Guide &amp; Status Definitions
              </h2>
              <p className="text-xs text-[#425466] dark:text-slate-400">
                {dataset.qualityScorecard.definitionsSheetFound
                  ? 'Loaded straight from your Excel Status_Definitions sheet'
                  : 'Plain-English guide to every label in the dashboard'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0A2540] dark:hover:text-white hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* 3-Step Quick Guide */}
          <div className="rounded-2xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] p-4 space-y-3">
            <p className="text-xs font-bold text-[#533AFD] dark:text-[#7C6BFF]">
              How to use this app in 3 simple steps
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white dark:bg-[#0F2035] rounded-xl p-3 border border-[#E2E8F0] dark:border-[#1E3A5F]">
                <p className="font-bold text-[#0A2540] dark:text-white">1. Click to filter</p>
                <p className="text-[#425466] dark:text-slate-300 mt-1">
                  Click any chart bar, pie slice, or top number card to zoom into that team or office.
                </p>
              </div>
              <div className="bg-white dark:bg-[#0F2035] rounded-xl p-3 border border-[#E2E8F0] dark:border-[#1E3A5F]">
                <p className="font-bold text-[#0A2540] dark:text-white">2. Click any person</p>
                <p className="text-[#425466] dark:text-slate-300 mt-1">
                  Click a name in Who Needs Help or All Staff to see why they are flagged and test fixes.
                </p>
              </div>
              <div className="bg-white dark:bg-[#0F2035] rounded-xl p-3 border border-[#E2E8F0] dark:border-[#1E3A5F]">
                <p className="font-bold text-[#0A2540] dark:text-white">3. Upload anytime</p>
                <p className="text-[#425466] dark:text-slate-300 mt-1">
                  Open Upload &amp; Settings to drop in a new Excel or CSV file. Everything stays saved in your browser.
                </p>
              </div>
            </div>
          </div>

          {/* Status Definitions Glossary */}
          <div>
            <h3 className="text-xs font-bold text-[#0A2540] dark:text-white mb-2">
              What every status means
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-[#1E3A5F]">
              {definitions.map((def, idx) => (
                <div key={idx} className="py-3 first:pt-1 last:pb-0">
                  <dt className="text-sm font-semibold text-[#533AFD] dark:text-[#7C6BFF]">
                    {def.field}
                  </dt>
                  <dd className="text-xs text-[#425466] dark:text-slate-300 mt-1 leading-relaxed">
                    {def.definition}
                  </dd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CommandPalette: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { allRecords, setActivePage, openEmployeeDrawer, setFilterPatch } = useWorkforce();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const navTargets: Array<{ id: NavPageId; label: string }> = [
    { id: 'overview', label: 'Team Overview' },
    { id: 'watchlist', label: 'Who Needs Help' },
    { id: 'directory', label: 'All Staff' },
    { id: 'insights', label: 'Insights & AI Chat' },
    { id: 'data-hub', label: 'Upload & Settings' },
  ];

  const q = query.trim().toLowerCase();
  const matchingPages = navTargets.filter((n) => !q || n.label.toLowerCase().includes(q));
  const matchingEmployees = useMemo(() => {
    if (!q) return allRecords.slice(0, 5);
    return allRecords
      .filter((r) =>
        `${r.employeeId} ${r.employeeName} ${r.department} ${r.location}`.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [allRecords, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#071321]/65 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-[#0F2035] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a page, staff name, Staff ID, or UK office..."
            className="w-full text-sm bg-transparent text-[#0A2540] dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-0.5 rounded bg-[#F6F9FC] dark:bg-[#162B45] text-slate-500 cursor-pointer"
          >
            Esc
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {matchingPages.length > 0 && (
            <div>
              <p className="px-2 text-[11px] font-semibold text-slate-400 mb-1.5">Pages</p>
              <div className="space-y-1">
                {matchingPages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePage(p.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] text-[#0A2540] dark:text-slate-100 cursor-pointer"
                  >
                    <span className="font-medium">{p.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingEmployees.length > 0 && (
            <div>
              <p className="px-2 text-[11px] font-semibold text-slate-400 mb-1.5">Staff</p>
              <div className="space-y-1">
                {matchingEmployees.map((emp) => (
                  <button
                    key={emp.employeeId}
                    type="button"
                    onClick={() => {
                      openEmployeeDrawer(emp.employeeId);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left hover:bg-[#F6F9FC] dark:hover:bg-[#162B45] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-3.5 h-3.5 text-[#533AFD] shrink-0" />
                      <span className="font-mono font-semibold text-[#533AFD] dark:text-[#7C6BFF] shrink-0">
                        {emp.employeeId}
                      </span>
                      <span className="font-medium text-[#0A2540] dark:text-white truncate">
                        {emp.employeeName}
                      </span>
                    </div>
                    <span className="text-slate-400 shrink-0 ml-2">
                      {emp.department} · Stress: {getStressLevel(emp.compositeBurnoutRiskScore)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-[#1E3A5F] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterPatch({ attentionStatuses: ['Needs Attention'] });
                setActivePage('watchlist');
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#FFF1F2] dark:bg-[#FB7185]/15 text-[#E11D48] dark:text-[#FB7185] hover:bg-[#E11D48]/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Show Who Needs Check-In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
