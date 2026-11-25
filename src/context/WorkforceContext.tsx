import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActionPlan,
  ActiveDatasetPayload,
  BusinessInsight,
  CrossFilterState,
  EmployeeRecord,
  NavPageId,
  PlatformSettings,
  StartupView,
  StatusDefinition,
} from '../types/workforce';
import { buildDemoDataset, DEFAULT_STATUS_DEFINITIONS } from '../data/demoDataset';
import { parseUploadedFile, recalculateRiskScores } from '../utils/dataEngine';
import {
  applyCrossFilters,
  computeBusinessInsights,
  computeKpis,
  EMPTY_FILTERS,
  hasActiveFilters,
  KpiSummary,
} from '../utils/analytics';
import {
  clearPersistedDataset,
  DEFAULT_PLATFORM_SETTINGS,
  loadPersistedDataset,
  loadPlatformSettings,
  loadSavedActionPlans,
  loadStatusDefinitions,
  saveActionPlansList,
  savePersistedDataset,
  savePlatformSettings,
  saveStatusDefinitions,
} from '../utils/storage';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  detail?: string;
}

type FilterArrayKey = Exclude<keyof CrossFilterState, 'quadrant' | 'searchQuery'>;

interface WorkforceContextValue {
  isBooting: boolean;
  dataset: ActiveDatasetPayload;
  allRecords: EmployeeRecord[];
  filteredRecords: EmployeeRecord[];
  kpis: KpiSummary;
  overallKpis: KpiSummary;
  insights: BusinessInsight[];
  definitions: StatusDefinition[];
  settings: PlatformSettings;
  savedPlans: ActionPlan[];
  filters: CrossFilterState;
  isFiltered: boolean;

  activeView: StartupView;
  setActiveView: (view: StartupView) => void;
  enterWorkspace: (page?: NavPageId) => void;
  goToLanding: () => void;
  activePage: NavPageId;
  setActivePage: (page: NavPageId) => void;
  selectedEmployeeId: string | null;
  openEmployeeDrawer: (employeeId: string) => void;
  closeEmployeeDrawer: () => void;

  presentationMode: boolean;
  setPresentationMode: (val: boolean) => void;
  isUploading: boolean;

  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;

  toggleFilter: (key: FilterArrayKey, value: string, multiSelect?: boolean) => void;
  setFilterPatch: (patch: Partial<CrossFilterState>) => void;
  clearFilterKey: (key: keyof CrossFilterState) => void;
  resetAllFilters: () => void;

  uploadWorkforceFile: (file: File) => Promise<void>;
  resetToDemoDataset: () => Promise<void>;
  updateSettings: (next: PlatformSettings) => Promise<void>;
  resetSettings: () => Promise<void>;
  saveActionPlan: (plan: ActionPlan) => Promise<void>;
  deleteActionPlan: (id: string) => Promise<void>;
  restoreWorkspaceBackup: (jsonText: string) => Promise<void>;

  aiConfigured: boolean;
}

const WorkforceContext = createContext<WorkforceContextValue | null>(null);

export const WorkforceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBooting, setIsBooting] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [dataset, setDataset] = useState<ActiveDatasetPayload>(() => buildDemoDataset());
  const [definitions, setDefinitions] = useState<StatusDefinition[]>(DEFAULT_STATUS_DEFINITIONS);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [savedPlans, setSavedPlans] = useState<ActionPlan[]>([]);
  const [filters, setFilters] = useState<CrossFilterState>(EMPTY_FILTERS);
  const [activeView, setActiveView] = useState<StartupView>('landing');
  const [activePage, setActivePage] = useState<NavPageId>('overview');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [aiConfigured, setAiConfigured] = useState(false);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Apply Light/Dark/System class on <html>
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const prefersDark =
        typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark =
        settings.themeMode === 'dark' || (settings.themeMode === 'system' && prefersDark);
      root.classList.toggle('dark', shouldBeDark);
      try {
        localStorage.setItem('hay_theme_mode', settings.themeMode);
      } catch {
        // ignore
      }
    };
    applyTheme();

    if (settings.themeMode === 'system' && typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings.themeMode]);

  // Boot from IndexedDB + check server /api/health
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [loadedSettings, loadedDataset, loadedDefs, loadedPlans] = await Promise.all([
          loadPlatformSettings(),
          loadPersistedDataset(),
          loadStatusDefinitions(),
          loadSavedActionPlans(),
        ]);

        if (!active) return;
        setSettings(loadedSettings);
        setActiveView(loadedSettings.startupView || 'landing');
        setActivePage(loadedSettings.defaultLandingPage || 'overview');
        setSavedPlans(loadedPlans);

        if (loadedDefs && loadedDefs.length > 0) {
          setDefinitions(loadedDefs);
        }

        if (loadedDataset && loadedDataset.records?.length > 0) {
          const normalizedReasons = loadedDataset.records.map((r) => ({
            ...r,
            attentionReason:
              r.attentionReason === 'None / On Track' ? 'On Track' : r.attentionReason,
          }));
          const recalculated = recalculateRiskScores(normalizedReasons, loadedSettings.thresholds);
          setDataset({ ...loadedDataset, records: recalculated });
        } else {
          const demo = buildDemoDataset();
          const recalculated = recalculateRiskScores(demo.records, loadedSettings.thresholds);
          setDataset({ ...demo, records: recalculated });
        }

        try {
          const res = await fetch('/api/health');
          if (res.ok) {
            const data = await res.json();
            if (active) setAiConfigured(Boolean(data?.aiConfigured));
          }
        } catch {
          // ignore
        }
      } finally {
        if (active) setIsBooting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Global Esc shortcut for Presentation Mode & Employee Drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (presentationMode) setPresentationMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presentationMode]);

  const allRecords = dataset.records;

  const filteredRecords = useMemo(
    () => applyCrossFilters(allRecords, filters, settings.thresholds),
    [allRecords, filters, settings.thresholds]
  );

  const kpis = useMemo(
    () => computeKpis(filteredRecords, settings.thresholds),
    [filteredRecords, settings.thresholds]
  );

  const overallKpis = useMemo(
    () => computeKpis(allRecords, settings.thresholds),
    [allRecords, settings.thresholds]
  );

  const insights = useMemo(
    () => computeBusinessInsights(filteredRecords.length > 0 ? filteredRecords : allRecords, settings.thresholds),
    [filteredRecords, allRecords, settings.thresholds]
  );

  const isFiltered = useMemo(() => hasActiveFilters(filters), [filters]);

  const toggleFilter = useCallback(
    (key: FilterArrayKey, value: string, multiSelect = false) => {
      setFilters((prev) => {
        const current = prev[key];
        const exists = current.includes(value);
        let nextValues: string[];
        if (multiSelect) {
          nextValues = exists ? current.filter((v) => v !== value) : [...current, value];
        } else {
          nextValues = exists && current.length === 1 ? [] : [value];
        }
        return { ...prev, [key]: nextValues };
      });
    },
    []
  );

  const setFilterPatch = useCallback((patch: Partial<CrossFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilterKey = useCallback((key: keyof CrossFilterState) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'quadrant' ? null : key === 'searchQuery' ? '' : [],
    }));
  }, []);

  const resetAllFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    pushToast({
      type: 'info',
      title: 'Showing everyone',
      detail: 'All filters cleared.',
    });
  }, [pushToast]);

  const uploadWorkforceFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const { rawRows, records, scorecard, definitions: parsedDefs } = await parseUploadedFile(
          file,
          settings.thresholds
        );
        if (records.length === 0) {
          throw new Error('No staff rows were found in the uploaded file.');
        }

        const nextPayload: ActiveDatasetPayload = {
          id: `upload-${Date.now()}`,
          sourceType: 'uploaded',
          filename: file.name,
          uploadedAt: new Date().toISOString(),
          rawRows,
          records,
          qualityScorecard: scorecard,
        };

        await savePersistedDataset(nextPayload);
        setDataset(nextPayload);

        if (parsedDefs && parsedDefs.length > 0) {
          await saveStatusDefinitions(parsedDefs);
          setDefinitions(parsedDefs);
        }

        setFilters(EMPTY_FILTERS);
        pushToast({
          type: 'success',
          title: `Loaded ${records.length} staff from ${file.name}`,
          detail: scorecard.definitionsSheetFound
            ? 'Your data and status definitions are saved privately in your browser.'
            : 'Your file is checked and saved privately in your browser.',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to read this file.';
        pushToast({
          type: 'error',
          title: 'Upload failed',
          detail: msg,
        });
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [pushToast, settings.thresholds]
  );

  const resetToDemoDataset = useCallback(async () => {
    await clearPersistedDataset();
    await saveStatusDefinitions(DEFAULT_STATUS_DEFINITIONS);
    const demo = buildDemoDataset();
    const recalculated = recalculateRiskScores(demo.records, settings.thresholds);
    setDataset({ ...demo, records: recalculated });
    setDefinitions(DEFAULT_STATUS_DEFINITIONS);
    setFilters(EMPTY_FILTERS);
    pushToast({
      type: 'info',
      title: 'Demo data restored',
      detail: '512 sample Hay Recruitment staff loaded.',
    });
  }, [pushToast, settings.thresholds]);

  const updateSettings = useCallback(
    async (next: PlatformSettings) => {
      setSettings(next);
      await savePlatformSettings(next);
      setDataset((prev) => ({
        ...prev,
        records: recalculateRiskScores(prev.records, next.thresholds),
      }));
      pushToast({
        type: 'success',
        title: 'Settings saved',
        detail: 'Stress levels and check-in alerts updated.',
      });
    },
    [pushToast]
  );

  const resetSettings = useCallback(async () => {
    const def = { ...DEFAULT_PLATFORM_SETTINGS };
    setSettings(def);
    await savePlatformSettings(def);
    setDataset((prev) => ({
      ...prev,
      records: recalculateRiskScores(prev.records, def.thresholds),
    }));
    pushToast({
      type: 'info',
      title: 'Settings restored to defaults',
    });
  }, [pushToast]);

  const saveActionPlan = useCallback(
    async (plan: ActionPlan) => {
      setSavedPlans((prev) => {
        const next = [plan, ...prev.filter((p) => p.id !== plan.id)].slice(0, 50);
        saveActionPlansList(next).catch(() => {});
        return next;
      });
      pushToast({
        type: 'success',
        title: 'Action Plan saved',
        detail: `${plan.targetLabel} saved to Action Hub & IndexedDB.`,
      });
    },
    [pushToast]
  );

  const deleteActionPlan = useCallback(async (id: string) => {
    setSavedPlans((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveActionPlansList(next).catch(() => {});
      return next;
    });
  }, []);

  const restoreWorkspaceBackup = useCallback(
    async (jsonText: string) => {
      const parsed = JSON.parse(jsonText);
      if (parsed?.dataset?.records && Array.isArray(parsed.dataset.records)) {
        await savePersistedDataset(parsed.dataset);
        setDataset(parsed.dataset);
      }
      if (Array.isArray(parsed?.definitions)) {
        await saveStatusDefinitions(parsed.definitions);
        setDefinitions(parsed.definitions);
      }
      if (parsed?.settings) {
        const merged = { ...DEFAULT_PLATFORM_SETTINGS, ...parsed.settings };
        await savePlatformSettings(merged);
        setSettings(merged);
      }
      if (Array.isArray(parsed?.savedPlans)) {
        await saveActionPlansList(parsed.savedPlans);
        setSavedPlans(parsed.savedPlans);
      }
      pushToast({
        type: 'success',
        title: 'Workspace backup restored',
        detail: 'Dataset, definitions, settings, and action plans restored.',
      });
    },
    [pushToast]
  );

  const openEmployeeDrawer = useCallback((employeeId: string) => {
    setSelectedEmployeeId(employeeId);
  }, []);

  const closeEmployeeDrawer = useCallback(() => {
    setSelectedEmployeeId(null);
  }, []);

  const enterWorkspace = useCallback(
    (page?: NavPageId) => {
      if (page) setActivePage(page);
      setActiveView('workspace');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const goToLanding = useCallback(() => {
    setPresentationMode(false);
    setActiveView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <WorkforceContext.Provider
      value={{
        isBooting,
        dataset,
        allRecords,
        filteredRecords,
        kpis,
        overallKpis,
        insights,
        definitions,
        settings,
        savedPlans,
        filters,
        isFiltered,
        activeView,
        setActiveView,
        enterWorkspace,
        goToLanding,
        activePage,
        setActivePage,
        selectedEmployeeId,
        openEmployeeDrawer,
        closeEmployeeDrawer,
        presentationMode,
        setPresentationMode,
        isUploading,
        toasts,
        pushToast,
        dismissToast,
        toggleFilter,
        setFilterPatch,
        clearFilterKey,
        resetAllFilters,
        uploadWorkforceFile,
        resetToDemoDataset,
        updateSettings,
        resetSettings,
        saveActionPlan,
        deleteActionPlan,
        restoreWorkspaceBackup,
        aiConfigured,
      }}
    >
      {children}
    </WorkforceContext.Provider>
  );
};

export function useWorkforce() {
  const ctx = useContext(WorkforceContext);
  if (!ctx) throw new Error('useWorkforce must be used inside WorkforceProvider');
  return ctx;
}
