import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Lightbulb,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  HelpCircle,
  Sun,
  Moon,
  MonitorPlay,
  Minimize2,
  ArrowLeft,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { NavPageId } from '../types/workforce';
import { CommandPalette, StatusDefinitionsModal } from './GlobalModals';
import { HayLogo } from './HayLogo';

interface NavItem {
  id: NavPageId;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Team Overview',
    shortLabel: 'Overview',
    description: 'See how everyone is doing today and click any chart to filter.',
    icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'watchlist',
    label: 'Who Needs Help',
    shortLabel: 'Help',
    description: 'Staff showing signs of low mood, late tasks, or heavy workload.',
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'directory',
    label: 'All Staff',
    shortLabel: 'Staff',
    description: 'Search and sort every person on the team.',
    icon: <Users className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'insights',
    label: 'Insights & AI Chat',
    shortLabel: 'AI Chat',
    description: 'Friendly AI Q&A helper plus ready-made workforce takeaways.',
    icon: <Lightbulb className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'data-hub',
    label: 'Upload & Settings',
    shortLabel: 'Upload',
    description: 'Upload your Excel file, export reports, and adjust simple alerts.',
    icon: <SlidersHorizontal className="w-4 h-4 shrink-0" />,
  },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activePage,
    setActivePage,
    goToLanding,
    dataset,
    overallKpis,
    settings,
    updateSettings,
    presentationMode,
    setPresentationMode,
    isBooting,
  } = useWorkforce();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [defsOpen, setDefsOpen] = useState(false);

  // Normalize active nav highlight if an older subpage route is active
  const normalizedNavId: NavPageId =
    activePage === 'copilot'
      ? 'insights'
      : activePage === 'settings' || activePage === 'reports'
        ? 'data-hub'
        : activePage === 'matrix'
          ? 'overview'
          : activePage;

  const currentMeta =
    NAV_ITEMS.find((i) => i.id === normalizedNavId) || NAV_ITEMS[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isDarkActive =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleDarkMode = () => {
    updateSettings({
      ...settings,
      themeMode: isDarkActive ? 'light' : 'dark',
    });
  };

  const renderSidebarNav = (mobile = false) => (
    <div className="w-full flex flex-col h-full bg-[#0A2540] dark:bg-[#050D18] text-slate-200 select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        {(!sidebarCollapsed || mobile) && (
          <HayLogo
            inverted
            onClick={() => {
              goToLanding();
              if (mobile) setMobileMenuOpen(false);
            }}
          />
        )}
        {!mobile ? (
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer mx-auto lg:mx-0"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Clear Back to Home Page Link */}
      <div className="px-2.5 pt-3">
        <button
          type="button"
          onClick={() => {
            goToLanding();
            if (mobile) setMobileMenuOpen(false);
          }}
          title="Back to Home Page"
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer whitespace-nowrap ${
            sidebarCollapsed && !mobile ? 'justify-center px-0' : ''
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
          {(!sidebarCollapsed || mobile) && <span>← Back to Home Page</span>}
        </button>
      </div>

      {/* 5 Clean Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-1.5" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = normalizedNavId === item.id;
          const isAiItem = item.id === 'insights';
          return (
            <button
              key={item.id}
              type="button"
              title={sidebarCollapsed && !mobile ? item.label : undefined}
              onClick={() => {
                setActivePage(item.id);
                if (mobile) setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? isAiItem
                    ? 'bg-[#533AFD] text-white font-semibold shadow-sm'
                    : 'bg-[#00A859] text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              } ${sidebarCollapsed && !mobile ? 'justify-center px-0' : ''}`}
            >
              {item.icon}
              {(!sidebarCollapsed || mobile) && (
                <span className="truncate">{item.label}</span>
              )}
              {item.id === 'watchlist' && (!sidebarCollapsed || mobile) && (
                <span
                  className={`ml-auto px-1.5 py-0.5 rounded-full font-mono text-[11px] font-bold tabular-nums ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-[#E11D48] text-white'
                  }`}
                >
                  {overallKpis.needsAttentionCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden print:h-auto print:overflow-visible bg-[#F6F9FC] dark:bg-[#071321] text-[#0A2540] dark:text-[#F8FAFC]">
      {/* Middle Row: Desktop Sidebar + Main Content Column */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden print:overflow-visible">
        {/* Desktop Left Sidebar (>= 1024px) */}
        {!presentationMode && (
          <aside
            className={`hidden lg:flex shrink-0 h-full transition-all duration-150 border-r border-white/10 no-print ${
              sidebarCollapsed ? 'w-16' : 'w-64'
            }`}
          >
            {renderSidebarNav(false)}
          </aside>
        )}

        {/* Mobile Drawer */}
        {mobileMenuOpen && !presentationMode && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-[#071321]/65 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative z-10 w-72 h-full shadow-2xl">{renderSidebarNav(true)}</aside>
          </div>
        )}

        {/* Main Content Column */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden print:overflow-visible">
          {/* Top Utility Header */}
          {!presentationMode && (
            <header className="shrink-0 z-20 min-h-16 py-2 bg-white/95 dark:bg-[#0F2035]/95 backdrop-blur border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
              {/* Left: Mobile Menu + Page Name & 1-line Plain Description */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                  className="lg:hidden p-2 rounded-lg text-[#425466] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162B45] cursor-pointer shrink-0"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[#0A2540] dark:text-white truncate">
                    {currentMeta.label}
                  </h2>
                  <p className="hidden sm:block text-xs text-[#425466] dark:text-slate-400 truncate">
                    {currentMeta.description}
                  </p>
                </div>
              </div>

              {/* Right: Active File Pill + Help + Light/Dark + Full Screen */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#008A48] dark:text-[#10B981] border border-[#00A859]/20 tabular-nums whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-[#00A859] dark:bg-[#10B981]" />
                  <span>
                    {dataset.records.length} Staff · Last Updated {dataset.qualityScorecard.snapshotDate}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setDefsOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] text-xs font-semibold text-[#0A2540] dark:text-slate-200 hover:border-[#533AFD] cursor-pointer whitespace-nowrap"
                >
                  <HelpCircle className="w-4 h-4 text-[#533AFD] dark:text-[#7C6BFF]" />
                  <span>? Help</span>
                </button>

                <button
                  type="button"
                  onClick={toggleDarkMode}
                  title={isDarkActive ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle Light/Dark theme"
                  className="p-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#425466] dark:text-slate-300 hover:border-[#533AFD] cursor-pointer"
                >
                  {isDarkActive ? <Sun className="w-4 h-4 text-[#FBBF24]" /> : <Moon className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPresentationMode(true)}
                  title="Expand workspace to full screen"
                  aria-label="Full-Screen View"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] text-xs font-semibold text-[#0A2540] dark:text-slate-200 hover:border-[#533AFD] cursor-pointer whitespace-nowrap"
                >
                  <MonitorPlay className="w-4 h-4 text-[#533AFD] dark:text-[#7C6BFF]" />
                  <span className="hidden md:inline">Full Screen</span>
                </button>
              </div>
            </header>
          )}

          {/* Full-Screen Floating Exit Button */}
          {presentationMode && (
            <button
              type="button"
              onClick={() => setPresentationMode(false)}
              className="fixed top-4 right-4 z-40 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#0A2540]/90 text-white border border-[#533AFD]/60 shadow-lg hover:bg-[#0A2540] cursor-pointer no-print"
            >
              <Minimize2 className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Exit Full Screen (Esc)</span>
            </button>
          )}

          {/* Scrollable Page Body */}
          <main className="flex-1 min-h-0 overflow-y-auto print:overflow-visible p-4 sm:p-6 pb-8">
            <div className="max-w-[1600px] w-full mx-auto">
              {isBooting ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-24 rounded-2xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F]" />
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-28 rounded-2xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F]"
                      />
                    ))}
                  </div>
                  <div className="h-80 rounded-2xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F]" />
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>

      {/* In-Flow Mobile & Tablet Bottom Navigation Bar (< 1024px) */}
      {!presentationMode && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden shrink-0 w-full border-t z-30 bg-white/95 dark:bg-[#0F2035]/95 backdrop-blur border-[#E2E8F0] dark:border-[#1E3A5F] px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(10,37,64,0.06)] no-print"
        >
          <div className="grid grid-cols-5 gap-1 max-w-2xl mx-auto">
            {NAV_ITEMS.map((item) => {
              const active = normalizedNavId === item.id;
              const isAiItem = item.id === 'insights';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer min-h-[48px] ${
                    active
                      ? isAiItem
                        ? 'bg-[#EEF2FF] dark:bg-[#533AFD]/25 text-[#533AFD] dark:text-[#9F92FF]'
                        : 'bg-[#ECFDF5] dark:bg-[#00A859]/20 text-[#008A48] dark:text-[#10B981]'
                      : 'text-[#425466] dark:text-slate-400 hover:text-[#0A2540] dark:hover:text-white'
                  }`}
                >
                  <span className="relative inline-flex items-center justify-center">
                    {item.icon}
                    {item.id === 'watchlist' && (
                      <span className="absolute -top-2 -right-3.5 px-1 min-w-[18px] h-4 rounded-full bg-[#E11D48] text-white font-mono text-[10px] font-bold flex items-center justify-center leading-none tabular-nums shadow-xs">
                        {overallKpis.needsAttentionCount}
                      </span>
                    )}
                  </span>
                  <span className="truncate max-w-full leading-none">{item.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Global Help & Quick Search Modals */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <StatusDefinitionsModal open={defsOpen} onClose={() => setDefsOpen(false)} />
    </div>
  );
};
