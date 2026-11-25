export type WorkArrangement = 'Hybrid' | 'Remote' | 'On-Site' | string;
export type WorkStatus = 'Present' | 'Remote' | 'Leave' | 'Absent' | string;
export type WorkloadLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | string;
export type AttentionStatus = 'Needs Attention' | 'On Track' | string;
export type TenureBand = '< 1 Yr' | '1–3 Yrs' | '3–5 Yrs' | '5+ Yrs';

export interface RawEmployeeRow {
  [key: string]: unknown;
}

export interface EmployeeRecord {
  employeeId: string; // Strict primary key
  employeeName: string;
  department: string;
  jobLevel: string;
  location: string;
  workArrangement: WorkArrangement;
  workStatus: WorkStatus;
  hireDate: string; // ISO YYYY-MM-DD
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  engagementScore: number; // Normalized 0–100
  workloadLevel: WorkloadLevel;
  leaveDaysRemaining: number;
  attentionStatus: AttentionStatus;
  attentionReason: string; // Blank preserved as "None / On Track"
  lastUpdated: string; // ISO YYYY-MM-DD

  // Engineered Workforce Metrics
  taskCompletionRate: number; // 0–100 %
  overdueTaskRatio: number; // 0–100 %
  pendingLoadRatio: number; // 0–100 %
  tenureMonths: number;
  tenureBand: TenureBand;
  compositeBurnoutRiskScore: number; // 0–100
  isBurnoutTrap: boolean; // High/Critical workload + high unused leave
  riskDrivers: {
    engagementRisk: number;
    overdueRisk: number;
    workloadRisk: number;
    pendingRisk: number;
    leaveTrapRisk: number;
  };
}

export interface StatusDefinition {
  field: string;
  definition: string;
}

export interface ColumnAuditItem {
  columnNumber: number;
  expectedColumn: string;
  matchedHeader: string | null;
  status: 'Matched' | 'Missing (Defaulted)' | 'Blanks Valid';
  nonEmptyCount: number;
  blankCount: number;
  notes: string;
}

export interface DataQualityScorecard {
  totalRawRows: number;
  cleanedRows: number;
  duplicateEmployeeIdsRemoved: number;
  blankAttentionReasonsPreserved: number;
  datesParsed: number;
  numericCoercions: number;
  engagementScaleDetected: string;
  detectedSheets: string[];
  primarySheetUsed: string;
  definitionsSheetFound: boolean;
  snapshotDate: string;
  completenessScore: number;
  columnAudit: ColumnAuditItem[];
}

export interface ActiveDatasetPayload {
  id: string;
  sourceType: 'demo' | 'uploaded';
  filename: string;
  uploadedAt: string;
  rawRows: RawEmployeeRow[];
  records: EmployeeRecord[];
  qualityScorecard: DataQualityScorecard;
}

export interface HRAlertThresholds {
  engagementTarget: number; // Default 75
  lowEngagementCutoff: number; // Default 65
  overdueTaskCutoff: number; // Default 5
  unusedLeaveCutoff: number; // Default 15
}

export type CopilotTone =
  | 'Executive HR Brief'
  | 'People Partner Deep-Dive'
  | 'Line Manager Coaching Script';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TableDensity = 'comfortable' | 'compact';

export type NavPageId =
  | 'overview'
  | 'watchlist'
  | 'directory'
  | 'matrix'
  | 'insights'
  | 'copilot'
  | 'data-hub'
  | 'reports'
  | 'settings';

export type StartupView = 'landing' | 'workspace';

export interface PlatformSettings {
  thresholds: HRAlertThresholds;
  copilotTone: CopilotTone;
  ukEmploymentGuidance: boolean;
  themeMode: ThemeMode;
  tableDensity: TableDensity;
  defaultLandingPage: NavPageId;
  startupView: StartupView;
}

export interface CrossFilterState {
  departments: string[];
  locations: string[];
  workStatuses: string[];
  workArrangements: string[];
  jobLevels: string[];
  workloadLevels: string[];
  attentionStatuses: string[];
  attentionReasons: string[];
  quadrant: string | null;
  searchQuery: string;
}

export interface ActionPlan {
  id: string;
  targetType: 'employee' | 'department';
  targetId: string; // Employee ID or Department Name
  targetLabel: string;
  createdAt: string;
  source: 'gemini' | 'template';
  title: string;
  urgency: string;
  owner: string;
  diagnosis: string;
  day30Actions: string[];
  day60Actions: string[];
  day90Actions: string[];
  successKpis: string[];
  coachingOpener: string;
}

export interface BusinessInsight {
  id: string;
  category:
    | 'Department Risk'
    | 'Location Gap'
    | 'Hybrid Disparity'
    | 'Burnout Correlation'
    | 'Attention Concentration'
    | 'Seniority Exposure'
    | 'Overdue Velocity';
  severity: 'critical' | 'warning' | 'positive';
  headline: string;
  metricCallout: string;
  evidence: string;
  recommendation: string;
  expectedImpact: string;
  filterPatch?: Partial<CrossFilterState>;
}
