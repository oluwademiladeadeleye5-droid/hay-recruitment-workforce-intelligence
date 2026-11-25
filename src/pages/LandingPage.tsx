import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Menu,
  X,
  Sun,
  Moon,
  FileSpreadsheet,
  HeartHandshake,
  MousePointerClick,
  UploadCloud,
  CheckCircle2,
  SlidersHorizontal,
  MessageSquareText,
  ShieldCheck,
  Users,
  BarChart3,
  Briefcase,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { HayLogo } from '../components/HayLogo';
import { CreatorCreditLinks } from '../components/CreatorCreditLinks';
import { computeKpis, getStressLevel, isHealthyReason } from '../utils/analytics';

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

function useCountUp(target: number, duration = 650) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVal(target);
      return;
    }
    let startTs: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const pct = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - pct, 3);
      setVal(Math.round(target * eased));
      if (pct < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

type RoleTabId = 'hr' | 'managers' | 'analysts';

export const LandingPage: React.FC = () => {
  const {
    allRecords,
    dataset,
    settings,
    updateSettings,
    enterWorkspace,
    uploadWorkforceFile,
    isUploading,
  } = useWorkforce();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [heroChip, setHeroChip] = useState<string>('All UK');
  const [activeBarLoc, setActiveBarLoc] = useState<string | null>(null);
  const [miniTasksMoved, setMiniTasksMoved] = useState<number>(2);
  const [roleTab, setRoleTab] = useState<RoleTabId>('hr');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bentoReveal = useScrollReveal<HTMLDivElement>();
  const stepsReveal = useScrollReveal<HTMLDivElement>();
  const rolesReveal = useScrollReveal<HTMLDivElement>();
  const ctaReveal = useScrollReveal<HTMLDivElement>();

  const isDarkActive =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    updateSettings({
      ...settings,
      themeMode: isDarkActive ? 'light' : 'dark',
    });
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadWorkforceFile(file);
      enterWorkspace('overview');
    } catch {
      // handled by toast
    } finally {
      e.target.value = '';
    }
  };

  const heroFilterOptions = useMemo(() => {
    const locations = Array.from(new Set(allRecords.map((r) => r.location))).slice(0, 4);
    return ['All UK', ...locations];
  }, [allRecords]);

  const heroPreviewRecords = useMemo(() => {
    if (heroChip === 'All UK') return allRecords;
    return allRecords.filter((r) => r.location === heroChip);
  }, [allRecords, heroChip]);

  const heroKpis = useMemo(
    () => computeKpis(heroPreviewRecords, settings.thresholds),
    [heroPreviewRecords, settings.thresholds]
  );

  const overallKpis = useMemo(
    () => computeKpis(allRecords, settings.thresholds),
    [allRecords, settings.thresholds]
  );

  const heroWorkloadBars = useMemo(() => {
    const order = ['Low', 'Moderate', 'High', 'Critical'];
    const maxCount = Math.max(
      1,
      ...order.map((lvl) => heroPreviewRecords.filter((r) => r.workloadLevel === lvl).length)
    );
    return order.map((lvl) => {
      const count = heroPreviewRecords.filter((r) => r.workloadLevel === lvl).length;
      return {
        label: lvl,
        count,
        pctHeight: Math.max(16, Math.round((count / maxCount) * 100)),
      };
    });
  }, [heroPreviewRecords]);

  // Bento Tile 1: Interactive 4-bar office preview
  const bentoOfficeBars = useMemo(() => {
    const locMap = new Map<string, { total: number; moodSum: number; flagged: number; late: number }>();
    allRecords.forEach((r) => {
      const cur = locMap.get(r.location) || { total: 0, moodSum: 0, flagged: 0, late: 0 };
      cur.total += 1;
      cur.moodSum += r.engagementScore;
      if (r.attentionStatus === 'Needs Attention') cur.flagged += 1;
      cur.late += r.overdueTasks;
      locMap.set(r.location, cur);
    });
    const list = Array.from(locMap.entries())
      .map(([name, v]) => ({
        name,
        total: v.total,
        avgMood: Math.round(v.moodSum / Math.max(v.total, 1)),
        flagged: v.flagged,
        late: v.late,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
    const maxTotal = Math.max(1, ...list.map((i) => i.total));
    return list.map((item) => ({
      ...item,
      heightPct: Math.max(24, Math.round((item.total / maxTotal) * 100)),
    }));
  }, [allRecords]);

  const selectedOfficeBar = useMemo(
    () => bentoOfficeBars.find((b) => b.name === activeBarLoc) || bentoOfficeBars[0] || null,
    [bentoOfficeBars, activeBarLoc]
  );

  // Bento Tile 2: Top 2 Check-in reasons
  const topReasons = useMemo(() => {
    const counts = new Map<string, number>();
    allRecords.forEach((r) => {
      if (r.attentionStatus === 'Needs Attention' && !isHealthyReason(r.attentionReason)) {
        counts.set(r.attentionReason, (counts.get(r.attentionReason) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
  }, [allRecords]);

  // Bento Tile 4: Top late-task office + interactive stress slider
  const topLateOffice = useMemo(() => {
    const locLate = new Map<string, number>();
    allRecords.forEach((r) => {
      locLate.set(r.location, (locLate.get(r.location) || 0) + r.overdueTasks);
    });
    const sorted = Array.from(locLate.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0] || ['London', 0];
  }, [allRecords]);

  const demoSimulatedScore = Math.max(24, 78 - miniTasksMoved * 7);
  const demoStressLevel = getStressLevel(demoSimulatedScore);

  const animatedHeadcount = useCountUp(allRecords.length);

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const roleContent: Record<
    RoleTabId,
    {
      label: string;
      icon: React.ReactNode;
      headline: string;
      benefits: string[];
      statTitle: string;
      statValue: string;
      statNote: string;
      ctaLabel: string;
      targetPage: 'overview' | 'watchlist' | 'data-hub';
    }
  > = {
    hr: {
      label: 'HR Leaders',
      icon: <HeartHandshake className="w-4 h-4" />,
      headline: 'Spot wellbeing risks early across every UK office.',
      benefits: [
        'See how many staff need a check-in today without digging through spreadsheets.',
        'Spot employees carrying heavy workloads alongside unused annual leave.',
        'Copy ready-made plain-English takeaways straight into leadership updates.',
      ],
      statTitle: 'Staff Flagged for Check-In',
      statValue: `${overallKpis.needsAttentionCount} of ${overallKpis.totalWorkforce}`,
      statNote: `Average team mood sits at ${overallKpis.avgEngagement}/100 across all hubs.`,
      ctaLabel: 'Open Team Overview',
      targetPage: 'overview',
    },
    managers: {
      label: 'Team Managers',
      icon: <Users className="w-4 h-4" />,
      headline: 'Know exactly who needs a 1-on-1 chat this week.',
      benefits: [
        'Open any person card to see mood, open vs. late tasks, and leave days left.',
        'Use the Test a Fix sliders to see how sharing late tasks lowers team stress.',
        'Get 3 short, practical tips for a warm and supportive 1-on-1 conversation.',
      ],
      statTitle: 'Open & Late Tasks Tracked',
      statValue: `${overallKpis.overdueTasks.toLocaleString()} late tasks`,
      statNote: `${overallKpis.availabilityRate}% of your team is working today (in office or remote).`,
      ctaLabel: 'See Who Needs Help',
      targetPage: 'watchlist',
    },
    analysts: {
      label: 'People Analysts',
      icon: <BarChart3 className="w-4 h-4" />,
      headline: 'Clean 18-column Excel imports in one click.',
      benefits: [
        'Automatically reads both Employee_Monitoring and Status_Definitions Excel tabs.',
        'Deduplicates Staff IDs and turns blank attention reasons safely into On Track.',
        'Keeps every record privately saved in browser IndexedDB with instant CSV/Excel export.',
      ],
      statTitle: 'Clean Staff Profiles Ready',
      statValue: `${dataset.qualityScorecard.cleanedRows.toLocaleString()} rows`,
      statNote: `${dataset.qualityScorecard.completenessScore}% schema match with zero server upload.`,
      ctaLabel: 'Open Upload & Settings',
      targetPage: 'data-hub',
    },
  };

  const activeRole = roleContent[roleTab];

  return (
    <div className="min-h-screen bg-[#F6F9FC] dark:bg-[#071321] text-[#0A2540] dark:text-[#F8FAFC] overflow-x-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        className="hidden"
        onChange={handleUploadChange}
      />

      {/* Clean 3-Zone Sticky Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-[#071321]/90 border-b border-[#E2E8F0] dark:border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <HayLogo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#425466] dark:text-slate-300">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-[#0A2540] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#0A2540] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-teams')}
              className="hover:text-[#0A2540] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              For Teams
            </button>
            <button
              type="button"
              onClick={() => enterWorkspace('watchlist')}
              className="hover:text-[#0A2540] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Who Needs Help
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Light or Dark mode"
              className="p-2 rounded-full border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#425466] dark:text-slate-300 hover:border-[#533AFD] transition-colors cursor-pointer"
            >
              {isDarkActive ? <Sun className="w-4 h-4 text-[#FBBF24]" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => enterWorkspace('overview')}
              className="group hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white transition-all cursor-pointer shadow-sm whitespace-nowrap shrink-0"
            >
              <span>Open Team Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle menu"
              className="md:hidden p-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0A2540] dark:text-white cursor-pointer"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-white/95 dark:bg-[#071321]/95 px-4 py-4 space-y-2">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="block w-full text-left px-3 py-2 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-[#0F2035] cursor-pointer"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left px-3 py-2 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-[#0F2035] cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-teams')}
              className="block w-full text-left px-3 py-2 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-[#0F2035] cursor-pointer"
            >
              For Teams
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                enterWorkspace('overview');
              }}
              className="w-full py-2.5 px-4 rounded-full text-xs font-semibold bg-[#00A859] text-white text-center cursor-pointer"
            >
              Open Team Dashboard
            </button>
          </div>
        )}
      </header>

      {/* SECTION 1: HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="animate-mesh-a absolute -top-28 -left-24 w-[480px] h-[480px] rounded-full bg-[#00A859]/14 dark:bg-[#10B981]/14 blur-3xl" />
          <div className="animate-mesh-b absolute top-10 right-0 w-[520px] h-[520px] rounded-full bg-[#533AFD]/14 dark:bg-[#7C6BFF]/16 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left: Plain-English Headline + Dual CTAs + Stats Strip */}
          <div className="lg:col-span-6 space-y-6">
            <p className="text-xs font-semibold text-[#533AFD] dark:text-[#7C6BFF]">
              Hay Recruitment UK · Team Wellbeing &amp; Workload
            </p>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0A2540] dark:text-white leading-[1.08] text-balance">
              See how your team is really doing at a glance.
            </h1>

            <p className="text-base sm:text-lg text-[#425466] dark:text-slate-300 leading-relaxed max-w-xl">
              Track who is working, spot heavy workloads early, and see who needs support before burnout happens.
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => enterWorkspace('overview')}
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold bg-[#00A859] hover:bg-[#008A48] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Open Team Dashboard</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold border border-[#533AFD]/35 dark:border-[#7C6BFF]/45 text-[#533AFD] dark:text-[#7C6BFF] bg-white/85 dark:bg-[#0F2035]/85 hover:bg-[#EEF2FF] dark:hover:bg-[#162B45] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isUploading ? 'Reading File...' : 'Upload Excel File'}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E3A5F] flex flex-wrap items-center gap-6 text-xs text-[#425466] dark:text-slate-400 tabular-nums">
              <span>
                <strong className="text-[#0A2540] dark:text-white font-bold">
                  {animatedHeadcount.toLocaleString()}
                </strong>{' '}
                staff loaded
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Updated{' '}
                <strong className="text-[#0A2540] dark:text-white font-semibold">
                  {dataset.qualityScorecard.snapshotDate}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>Stays private in your browser</span>
            </div>
          </div>

          {/* Right: Interactive Live Preview Card */}
          <div className="lg:col-span-6 relative">
            <div className="animate-float bg-white dark:bg-[#0F2035] rounded-3xl border border-[#E2E8F0] dark:border-[#1E3A5F] hay-card-shadow p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#0A2540] dark:text-white tabular-nums">
                    {heroChip} · {heroKpis.totalWorkforce} Staff
                  </p>
                  <p className="text-xs text-[#425466] dark:text-slate-400">
                    Try clicking an office below to see live team stats:
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {heroFilterOptions.map((opt) => {
                  const active = heroChip === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setHeroChip(opt)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#533AFD] dark:bg-[#7C6BFF] text-white shadow-sm'
                          : 'bg-[#F6F9FC] dark:bg-[#162B45] text-[#425466] dark:text-slate-300 hover:text-[#0A2540] dark:hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-3 tabular-nums">
                <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-[#10B981]/10 border border-[#00A859]/20">
                  <p className="text-[11px] font-medium text-[#008A48] dark:text-[#10B981]">
                    Working Today
                  </p>
                  <p className="text-xl sm:text-2xl font-extrabold text-[#0A2540] dark:text-white mt-0.5">
                    {heroKpis.availabilityRate}%
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#EEF2FF] dark:bg-[#7C6BFF]/10 border border-[#533AFD]/20">
                  <p className="text-[11px] font-medium text-[#533AFD] dark:text-[#7C6BFF]">
                    Team Mood
                  </p>
                  <p className="text-xl sm:text-2xl font-extrabold text-[#0A2540] dark:text-white mt-0.5">
                    {heroKpis.avgEngagement}
                    <span className="text-xs font-normal text-slate-400">/100</span>
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FFF1F2] dark:bg-[#FB7185]/10 border border-[#E11D48]/20">
                  <p className="text-[11px] font-medium text-[#E11D48] dark:text-[#FB7185]">
                    Needs Check-In
                  </p>
                  <p className="text-xl sm:text-2xl font-extrabold text-[#E11D48] dark:text-[#FB7185] mt-0.5">
                    {heroKpis.needsAttentionCount}
                  </p>
                </div>
              </div>

              <div className="pt-1 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#425466] dark:text-slate-400">
                  <span className="font-semibold text-[#0A2540] dark:text-slate-200">
                    How busy is the team?
                  </span>
                  <span className="tabular-nums">{heroKpis.overdueTasks} late tasks</span>
                </div>
                <div className="grid grid-cols-4 gap-3 items-end h-28 pt-3 px-2 rounded-2xl bg-[#F6F9FC] dark:bg-[#162B45]/70">
                  {heroWorkloadBars.map((bar) => {
                    const color =
                      bar.label === 'Low'
                        ? 'bg-[#00A859] dark:bg-[#10B981]'
                        : bar.label === 'Moderate'
                          ? 'bg-[#00B4D8] dark:bg-[#38BDF8]'
                          : bar.label === 'High'
                            ? 'bg-[#D97706] dark:bg-[#FBBF24]'
                            : 'bg-[#E11D48] dark:bg-[#FB7185]';
                    return (
                      <div key={bar.label} className="flex flex-col items-center gap-1.5 h-full justify-end pb-2">
                        <span className="text-[11px] font-bold text-[#0A2540] dark:text-white tabular-nums">
                          {bar.count}
                        </span>
                        <div className="w-full max-w-[38px] h-16 flex items-end justify-center">
                          <div
                            className={`w-full rounded-t-lg transition-all duration-300 ${color}`}
                            style={{ height: `${bar.pctHeight}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-[#425466] dark:text-slate-300">
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: INTERACTIVE 4-TILE BENTO FEATURE GRID */}
      <section id="features" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#533AFD] dark:text-[#7C6BFF]">
            Built for Everyday Clarity
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0A2540] dark:text-white text-balance">
            Everything you need to support your team
          </h2>
          <p className="text-sm sm:text-base text-[#425466] dark:text-slate-300">
            No complex setup or analytics training required. Click around below to try the tools live.
          </p>
        </div>

        <div
          ref={bentoReveal.ref}
          className={`grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-700 ${
            bentoReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Tile 1 (7 cols): Click Any Chart to Filter */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0F2035] rounded-3xl border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD]/50 hover:-translate-y-0.5 transition-all p-6 sm:p-7 hay-card-shadow flex flex-col justify-between gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#533AFD] dark:text-[#7C6BFF]">
                  <MousePointerClick className="w-4 h-4" />
                  <span>Click Any Chart to Filter</span>
                </div>
                <h3 className="text-xl font-bold text-[#0A2540] dark:text-white">
                  Zoom into any office or department in one click
                </h3>
                <p className="text-xs sm:text-sm text-[#425466] dark:text-slate-300 leading-relaxed">
                  Click or hover an office bar below to preview how instant filtering works across the dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => enterWorkspace('overview')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#533AFD] dark:text-[#7C6BFF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Try in Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F6F9FC] dark:bg-[#162B45]/70 border border-[#E2E8F0] dark:border-[#1E3A5F] p-4 space-y-4">
              {selectedOfficeBar && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#0A2540] dark:text-white">
                    {selectedOfficeBar.name} Office
                  </span>
                  <span className="tabular-nums text-[#425466] dark:text-slate-300">
                    {selectedOfficeBar.total} staff · Avg Mood {selectedOfficeBar.avgMood}/100 ·{' '}
                    <strong className="text-[#E11D48] dark:text-[#FB7185]">
                      {selectedOfficeBar.flagged} need check-in
                    </strong>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-4 gap-3 items-end h-28 pt-2">
                {bentoOfficeBars.map((bar) => {
                  const isHighlighted = selectedOfficeBar?.name === bar.name;
                  return (
                    <button
                      key={bar.name}
                      type="button"
                      onMouseEnter={() => setActiveBarLoc(bar.name)}
                      onClick={() => setActiveBarLoc(bar.name)}
                      className="flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                    >
                      <span className="text-[11px] font-bold tabular-nums text-[#0A2540] dark:text-white">
                        {bar.total}
                      </span>
                      <div className="w-full max-w-[52px] h-16 flex items-end justify-center">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-200 ${
                            isHighlighted
                              ? 'bg-[#533AFD] dark:bg-[#7C6BFF]'
                              : 'bg-[#00A859]/75 dark:bg-[#10B981]/75 group-hover:bg-[#533AFD]'
                          }`}
                          style={{ height: `${bar.heightPct}%` }}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-medium truncate max-w-full ${
                          isHighlighted
                            ? 'text-[#533AFD] dark:text-[#7C6BFF] font-bold'
                            : 'text-[#425466] dark:text-slate-300'
                        }`}
                      >
                        {bar.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tile 2 (5 cols): Spot Who Needs Help Fast */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0F2035] rounded-3xl border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#E11D48]/50 hover:-translate-y-0.5 transition-all p-6 sm:p-7 hay-card-shadow flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF1F2] dark:bg-[#FB7185]/15 text-[#E11D48] dark:text-[#FB7185] text-xs font-bold tabular-nums">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E11D48] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E11D48]" />
                  </span>
                  <span>{overallKpis.needsAttentionCount} Staff Flagged Now</span>
                </div>
                <button
                  type="button"
                  onClick={() => enterWorkspace('watchlist')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E11D48] dark:text-[#FB7185] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>See Watchlist</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <h3 className="text-xl font-bold text-[#0A2540] dark:text-white">
                Spot Who Needs Help Fast
              </h3>
              <p className="text-xs sm:text-sm text-[#425466] dark:text-slate-300 leading-relaxed">
                People showing low mood, late tasks, or heavy workloads rise straight to the top of your list.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#425466] dark:text-slate-400">
                Top 2 Reasons Right Now
              </p>
              {topReasons.map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#F6F9FC] dark:bg-[#162B45]/75 border border-[#E2E8F0] dark:border-[#1E3A5F] text-xs"
                >
                  <span className="font-semibold text-[#0A2540] dark:text-white truncate">
                    {reason}
                  </span>
                  <span className="font-mono font-bold text-[#E11D48] dark:text-[#FB7185] tabular-nums shrink-0">
                    {count} staff
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tile 3 (5 cols): Private 1-Click Excel Upload */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0F2035] rounded-3xl border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#00A859]/50 hover:-translate-y-0.5 transition-all p-6 sm:p-7 hay-card-shadow flex flex-col justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00A859] dark:text-[#10B981]">
                  <UploadCloud className="w-4 h-4" />
                  <span>Private 1-Click Excel Upload</span>
                </div>
                <button
                  type="button"
                  onClick={() => enterWorkspace('data-hub')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00A859] dark:text-[#10B981] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Upload File</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-[#0A2540] dark:text-white">
                Drop your workbook with zero server upload
              </h3>
              <p className="text-xs sm:text-sm text-[#425466] dark:text-slate-300 leading-relaxed">
                Your spreadsheet is cleaned and stored privately right inside your browser, ready across refreshes.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/10 border border-[#00A859]/25 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-[#00A859] dark:text-[#10B981] shrink-0" />
                  <span className="font-mono font-semibold text-[#0A2540] dark:text-white truncate">
                    Employee_Monitoring
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#008A48] dark:text-[#10B981] shrink-0">
                  {allRecords.length} rows
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#EEF2FF] dark:bg-[#7C6BFF]/10 border border-[#533AFD]/25 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-[#533AFD] dark:text-[#7C6BFF] shrink-0" />
                  <span className="font-mono font-semibold text-[#0A2540] dark:text-white truncate">
                    Status_Definitions
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#533AFD] dark:text-[#7C6BFF] shrink-0">
                  Auto-loaded
                </span>
              </div>
            </div>
          </div>

          {/* Tile 4 (7 cols): Plain-English AI Helper & Test-a-Fix Slider */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0F2035] rounded-3xl border border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#533AFD]/50 hover:-translate-y-0.5 transition-all p-6 sm:p-7 hay-card-shadow flex flex-col justify-between gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#533AFD] dark:text-[#7C6BFF]">
                  <MessageSquareText className="w-4 h-4" />
                  <span>Plain-English AI Helper &amp; Test-a-Fix Slider</span>
                </div>
                <h3 className="text-xl font-bold text-[#0A2540] dark:text-white">
                  Ask plain questions and test workload fixes live
                </h3>
              </div>
              <button
                type="button"
                onClick={() => enterWorkspace('insights')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#533AFD] dark:text-[#7C6BFF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Open AI Helper</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Friendly Chat Preview */}
              <div className="rounded-2xl bg-[#F6F9FC] dark:bg-[#162B45]/70 border border-[#E2E8F0] dark:border-[#1E3A5F] p-4 space-y-2.5 text-xs">
                <div className="px-3 py-2 rounded-xl bg-[#0A2540] text-white font-medium">
                  &quot;Which UK office has the most late tasks?&quot;
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#425466] dark:text-slate-200 leading-relaxed">
                  <strong className="text-[#0A2540] dark:text-white">{topLateOffice[0]}</strong> currently has{' '}
                  <strong className="text-[#E11D48] dark:text-[#FB7185]">{topLateOffice[1]} late tasks</strong>. Reassigning a few urgent tasks can lower team stress fast.
                </div>
              </div>

              {/* Interactive Mini Slider */}
              <div className="rounded-2xl bg-[#EEF2FF]/65 dark:bg-[#162B45]/90 border border-[#533AFD]/25 p-4 flex flex-col justify-between gap-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#0A2540] dark:text-white">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#533AFD]" />
                    <span>Test a Fix</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold ${
                      demoStressLevel === 'High'
                        ? 'bg-[#FFF1F2] text-[#E11D48] dark:bg-[#FB7185]/20 dark:text-[#FB7185]'
                        : demoStressLevel === 'Medium'
                          ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#FBBF24]/20 dark:text-[#FBBF24]'
                          : 'bg-[#ECFDF5] text-[#008A48] dark:bg-[#10B981]/20 dark:text-[#10B981]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        demoStressLevel === 'High'
                          ? 'bg-[#E11D48]'
                          : demoStressLevel === 'Medium'
                            ? 'bg-[#D97706]'
                            : 'bg-[#00A859]'
                      }`}
                    />
                    <span>Stress: {demoStressLevel}</span>
                  </span>
                </div>

                <div>
                  <div className="flex justify-between mb-1.5 text-[11px] text-[#425466] dark:text-slate-300">
                    <span>Share late tasks with teammates</span>
                    <span className="font-mono font-bold text-[#533AFD] dark:text-[#7C6BFF] tabular-nums">
                      {miniTasksMoved} moved
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={miniTasksMoved}
                    onChange={(e) => setMiniTasksMoved(Number(e.target.value))}
                    aria-label="Test moving late tasks"
                    className="w-full accent-[#533AFD] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: DARK CONTRAST 3-STEP BAND */}
      <section id="how-it-works" className="bg-[#0A2540] text-white py-16 sm:py-24">
        <div
          ref={stepsReveal.ref}
          className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${
            stepsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="max-w-2xl mb-12 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
              Simple Workflow
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              From spreadsheet to clear answers in 3 steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {[
              {
                num: '01. Upload Your File',
                desc: 'Drop your Excel or CSV file. The app checks all 18 columns automatically and keeps every staff member intact.',
                accent: 'text-[#10B981]',
                border: 'hover:border-[#10B981]/50',
              },
              {
                num: '02. Click to Explore',
                desc: 'Filter by office, department, or work status in one click to see who is overloaded or disengaged.',
                accent: 'text-[#7C6BFF]',
                border: 'hover:border-[#7C6BFF]/50',
              },
              {
                num: '03. Take Action',
                desc: 'Read ready-made takeaways, chat with the AI helper, and export clean reports for leadership.',
                accent: 'text-[#38BDF8]',
                border: 'hover:border-[#38BDF8]/50',
              },
            ].map((step, idx) => (
              <div
                key={step.num}
                className={`relative rounded-3xl bg-white/5 border border-white/10 ${step.border} transition-colors p-7 space-y-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-base font-bold ${step.accent}`}>{step.num}</p>
                  {idx < 2 && (
                    <ArrowRight className="hidden md:block w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: BUMPA-STYLE INTERACTIVE ROLE TABS */}
      <section id="for-teams" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={rolesReveal.ref}
          className={`space-y-8 transition-all duration-700 ${
            rolesReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-[#00A859] dark:text-[#10B981]">
                Tailored Views
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0A2540] dark:text-white text-balance">
                Built for every people leader
              </h2>
            </div>

            {/* Sliding Pill Role Switcher */}
            <div className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-full bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-sm self-start">
              {(Object.keys(roleContent) as RoleTabId[]).map((id) => {
                const active = roleTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRoleTab(id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#533AFD] dark:bg-[#7C6BFF] text-white shadow-sm'
                        : 'text-[#425466] dark:text-slate-300 hover:text-[#0A2540] dark:hover:text-white'
                    }`}
                  >
                    {roleContent[id].icon}
                    <span>{roleContent[id].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F2035] rounded-3xl border border-[#E2E8F0] dark:border-[#1E3A5F] hay-card-shadow p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#533AFD] dark:text-[#7C6BFF]">
                <Briefcase className="w-4 h-4" />
                <span>For {activeRole.label}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-[#0A2540] dark:text-white leading-snug">
                {activeRole.headline}
              </h3>

              <ul className="space-y-3">
                {activeRole.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#425466] dark:text-slate-300">
                    <CheckCircle2 className="w-5 h-5 text-[#00A859] dark:text-[#10B981] shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => enterWorkspace(activeRole.targetPage)}
                className="group inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs font-semibold bg-[#00A859] hover:bg-[#008A48] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white transition-all cursor-pointer whitespace-nowrap"
              >
                <span>{activeRole.ctaLabel}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-[#F6F9FC] dark:bg-[#162B45] border border-[#E2E8F0] dark:border-[#1E3A5F] p-6 sm:p-7 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#533AFD] dark:text-[#7C6BFF]">
                  Live Team Snapshot
                </p>
                <p className="text-sm font-medium text-[#425466] dark:text-slate-300">
                  {activeRole.statTitle}
                </p>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#0A2540] dark:text-white tabular-nums">
                  {activeRole.statValue}
                </p>
                <p className="text-xs text-[#425466] dark:text-slate-400 leading-relaxed pt-2 border-t border-[#E2E8F0] dark:border-[#1E3A5F]">
                  {activeRole.statNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: BOTTOM CTA BANNER & FULL 4-COLUMN CORPORATE FOOTER */}
      <section className="pb-16 pt-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={ctaReveal.ref}
          className={`rounded-3xl bg-[#0A2540] text-white p-8 sm:p-12 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all duration-700 ${
            ctaReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="space-y-2 max-w-xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Ready to check in on your team?
            </h2>
            <p className="text-sm text-slate-300">
              Jump straight into the live dashboard with {allRecords.length} staff profiles ready to explore, or drop in your own Excel file.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => enterWorkspace('overview')}
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold bg-[#00A859] hover:bg-[#008A48] text-white shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <span>Open Team Dashboard</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
              <span>{isUploading ? 'Reading File...' : 'Upload Excel'}</span>
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#050D18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs text-[#425466] dark:text-slate-400">
          {/* Col 1: Brand & Privacy Badges */}
          <div className="space-y-4">
            <HayLogo />
            <p className="leading-relaxed">
              Plain-English team wellbeing, workload tracking, and proactive check-ins for Hay Recruitment UK.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#008A48] dark:text-[#10B981] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Saved Locally in Browser</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EEF2FF] dark:bg-[#7C6BFF]/15 text-[#533AFD] dark:text-[#7C6BFF] font-semibold">
                <span>Zero Server Upload</span>
              </span>
            </div>
          </div>

          {/* Col 2: Workspace Links */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] dark:text-white">
              Workspace
            </h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => enterWorkspace('overview')}
                  className="hover:text-[#0A2540] dark:hover:text-white cursor-pointer"
                >
                  Team Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => enterWorkspace('watchlist')}
                  className="hover:text-[#0A2540] dark:hover:text-white cursor-pointer"
                >
                  Who Needs Help
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => enterWorkspace('directory')}
                  className="hover:text-[#0A2540] dark:hover:text-white cursor-pointer"
                >
                  All Staff
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => enterWorkspace('insights')}
                  className="hover:text-[#0A2540] dark:hover:text-white cursor-pointer"
                >
                  Insights &amp; AI Chat
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => enterWorkspace('data-hub')}
                  className="hover:text-[#0A2540] dark:hover:text-white cursor-pointer"
                >
                  Upload &amp; Settings
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: UK Hubs */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] dark:text-white">
              UK Offices
            </h3>
            <ul className="space-y-2">
              <li>London</li>
              <li>Manchester</li>
              <li>Birmingham</li>
              <li>Edinburgh</li>
              <li>Bristol</li>
            </ul>
          </div>

          {/* Col 4: Data & Copyright */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] dark:text-white">
              Data &amp; Privacy
            </h3>
            <p className="leading-relaxed">
              Supports multi-sheet Excel (.xlsx) and CSV files. All staff metrics stay stored in your browser IndexedDB until you reset or upload a new file.
            </p>
            <p className="pt-2 text-[11px] text-slate-400">
              &copy; {new Date().getFullYear()} Hay Recruitment UK. All rights reserved.
            </p>
          </div>
        </div>

        <div className="border-t border-[#E2E8F0] dark:border-[#1E3A5F]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <CreatorCreditLinks compact />
          </div>
        </div>
      </footer>
    </div>
  );
};
