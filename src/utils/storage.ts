import {
  ActionPlan,
  ActiveDatasetPayload,
  PlatformSettings,
  StatusDefinition,
} from '../types/workforce';
import { DEFAULT_THRESHOLDS } from './dataEngine';

const DB_NAME = 'hay_recruitment_workforce_db';
const DB_VERSION = 1;
const STORE_KV = 'kv_store';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  thresholds: { ...DEFAULT_THRESHOLDS },
  copilotTone: 'Executive HR Brief',
  ukEmploymentGuidance: true,
  themeMode: 'light',
  tableDensity: 'comfortable',
  defaultLandingPage: 'overview',
  startupView: 'workspace',
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const store = tx.objectStore(STORE_KV);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    const store = tx.objectStore(STORE_KV);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      const store = tx.objectStore(STORE_KV);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  DATASET: 'active_dataset',
  DEFINITIONS: 'status_definitions',
  SETTINGS: 'platform_settings',
  ACTION_PLANS: 'saved_action_plans',
} as const;

export async function loadPersistedDataset(): Promise<ActiveDatasetPayload | null> {
  return idbGet<ActiveDatasetPayload>(STORAGE_KEYS.DATASET);
}

export async function savePersistedDataset(dataset: ActiveDatasetPayload): Promise<void> {
  await idbSet(STORAGE_KEYS.DATASET, dataset);
}

export async function clearPersistedDataset(): Promise<void> {
  await idbDelete(STORAGE_KEYS.DATASET);
}

export async function loadStatusDefinitions(): Promise<StatusDefinition[] | null> {
  return idbGet<StatusDefinition[]>(STORAGE_KEYS.DEFINITIONS);
}

export async function saveStatusDefinitions(defs: StatusDefinition[]): Promise<void> {
  await idbSet(STORAGE_KEYS.DEFINITIONS, defs);
}

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  const saved = await idbGet<PlatformSettings>(STORAGE_KEYS.SETTINGS);
  if (!saved) return { ...DEFAULT_PLATFORM_SETTINGS };
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...saved,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...(saved.thresholds || {}),
    },
  };
}

export async function savePlatformSettings(settings: PlatformSettings): Promise<void> {
  await idbSet(STORAGE_KEYS.SETTINGS, settings);
  try {
    localStorage.setItem('hay_theme_mode', settings.themeMode);
    localStorage.setItem('hay_table_density', settings.tableDensity);
  } catch {
    // ignore
  }
}

export async function loadSavedActionPlans(): Promise<ActionPlan[]> {
  const plans = await idbGet<ActionPlan[]>(STORAGE_KEYS.ACTION_PLANS);
  return Array.isArray(plans) ? plans : [];
}

export async function saveActionPlansList(plans: ActionPlan[]): Promise<void> {
  await idbSet(STORAGE_KEYS.ACTION_PLANS, plans);
}

export async function getStorageDiagnostics(): Promise<{
  backend: string;
  approxBytes: number;
  keysPresent: string[];
}> {
  const keysPresent: string[] = [];
  let approxBytes = 0;
  for (const key of Object.values(STORAGE_KEYS)) {
    const val = await idbGet<unknown>(key);
    if (val !== null) {
      keysPresent.push(key);
      try {
        approxBytes += new Blob([JSON.stringify(val)]).size;
      } catch {
        approxBytes += 0;
      }
    }
  }
  return {
    backend: 'IndexedDB (hay_recruitment_workforce_db)',
    approxBytes,
    keysPresent,
  };
}
