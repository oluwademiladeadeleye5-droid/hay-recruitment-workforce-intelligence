import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  ColumnAuditItem,
  DataQualityScorecard,
  EmployeeRecord,
  HRAlertThresholds,
  RawEmployeeRow,
  StatusDefinition,
  TenureBand,
} from '../types/workforce';

export const DEFAULT_THRESHOLDS: HRAlertThresholds = {
  engagementTarget: 75,
  lowEngagementCutoff: 65,
  overdueTaskCutoff: 5,
  unusedLeaveCutoff: 15,
};

export const EXPECTED_SCHEMA: Array<{ num: number; name: string; aliases: string[] }> = [
  { num: 1, name: 'Employee ID', aliases: ['employeeid', 'empid', 'id', 'staffid', 'workerid'] },
  { num: 2, name: 'Employee Name', aliases: ['employeename', 'fullname', 'name', 'staffname'] },
  { num: 3, name: 'Department', aliases: ['department', 'dept', 'team', 'businessunit', 'division'] },
  { num: 4, name: 'Job Level', aliases: ['joblevel', 'level', 'seniority', 'grade', 'rolelevel'] },
  { num: 5, name: 'Location', aliases: ['location', 'office', 'city', 'site', 'uklocation'] },
  { num: 6, name: 'Work Arrangement', aliases: ['workarrangement', 'arrangement', 'workmode', 'hybridmode', 'workingpattern'] },
  { num: 7, name: 'Work Status', aliases: ['workstatus', 'status', 'attendancestatus', 'dailystatus', 'presence'] },
  { num: 8, name: 'Hire Date', aliases: ['hiredate', 'startdate', 'joineddate', 'datejoined'] },
  { num: 9, name: 'Total Tasks', aliases: ['totaltasks', 'assignedtasks', 'tasksassigned', 'alltasks'] },
  { num: 10, name: 'Completed Tasks', aliases: ['completedtasks', 'taskcompleted', 'donetasks'] },
  { num: 11, name: 'Pending Tasks', aliases: ['pendingtasks', 'opentasks', 'inprogresstasks'] },
  { num: 12, name: 'Overdue Tasks', aliases: ['overduetasks', 'latetasks', 'pastduetasks'] },
  { num: 13, name: 'Engagement Score', aliases: ['engagementscore', 'engagement', 'engscore'] },
  { num: 14, name: 'Workload Level', aliases: ['workloadlevel', 'workload', 'loadlevel', 'capacity'] },
  { num: 15, name: 'Leave Days Remaining', aliases: ['leavedaysremaining', 'remainingleave', 'unusedleave', 'annualleave', 'leavedays'] },
  { num: 16, name: 'Attention Status', aliases: ['attentionstatus', 'needsattention', 'alertstatus', 'flagstatus'] },
  { num: 17, name: 'Attention Reason', aliases: ['attentionreason', 'reason', 'alertreason', 'flagreason'] },
  { num: 18, name: 'Last Updated', aliases: ['lastupdated', 'updatedat', 'snapshotdate', 'asofdate'] },
];

function normKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

function toInt(val: unknown, fallback = 0): { num: number; coerced: boolean } {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return { num: Math.max(0, Math.round(val)), coerced: false };
  }
  const s = cleanStr(val).replace(/,/g, '').replace(/%$/, '');
  if (!s) return { num: fallback, coerced: true };
  const parsed = Number(s);
  if (Number.isFinite(parsed)) {
    return { num: Math.max(0, Math.round(parsed)), coerced: typeof val === 'string' };
  }
  return { num: fallback, coerced: true };
}

function toFloat(val: unknown, fallback = 0): { num: number; coerced: boolean } {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return { num: val, coerced: false };
  }
  const s = cleanStr(val).replace(/,/g, '').replace(/%$/, '');
  if (!s) return { num: fallback, coerced: true };
  const parsed = Number(s);
  if (Number.isFinite(parsed)) {
    return { num: parsed, coerced: typeof val === 'string' };
  }
  return { num: fallback, coerced: true };
}

export function parseFlexibleDate(val: unknown, fallbackIso = '2026-11-20'): { iso: string; parsed: boolean } {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return { iso: val.toISOString().slice(0, 10), parsed: true };
  }
  if (typeof val === 'number' && Number.isFinite(val) && val > 20000 && val < 90000) {
    // Excel serial date (epoch 1899-12-30)
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return { iso: d.toISOString().slice(0, 10), parsed: true };
    }
  }
  const s = cleanStr(val);
  if (!s) return { iso: fallbackIso, parsed: false };

  // UK DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s.*)?$/);
  if (ukMatch) {
    const day = Number(ukMatch[1]);
    const month = Number(ukMatch[2]);
    let year = Number(ukMatch[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) {
        return { iso: d.toISOString().slice(0, 10), parsed: true };
      }
    }
  }

  // ISO YYYY-MM-DD or timestamp
  const isoMatch = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(d.getTime())) {
      return { iso: d.toISOString().slice(0, 10), parsed: true };
    }
  }

  const native = new Date(s);
  if (!Number.isNaN(native.getTime())) {
    return { iso: native.toISOString().slice(0, 10), parsed: true };
  }
  return { iso: fallbackIso, parsed: false };
}

function normalizeWorkArrangement(val: string): string {
  const k = normKey(val);
  if (!k) return 'Hybrid';
  if (k.includes('hybrid')) return 'Hybrid';
  if (k.includes('remote') || k.includes('wfh') || k.includes('home')) return 'Remote';
  if (k.includes('onsite') || k.includes('office') || k.includes('site')) return 'On-Site';
  return toTitleCase(val);
}

function normalizeWorkStatus(val: string): string {
  const k = normKey(val);
  if (!k) return 'Present';
  if (k.includes('present') || k.includes('office') || k.includes('active')) return 'Present';
  if (k.includes('remote') || k.includes('wfh') || k.includes('home')) return 'Remote';
  if (k.includes('leave') || k.includes('holiday') || k.includes('pto') || k.includes('annual')) return 'Leave';
  if (k.includes('absent') || k.includes('sick') || k.includes('unplanned')) return 'Absent';
  return toTitleCase(val);
}

function normalizeWorkload(val: string): string {
  const k = normKey(val);
  if (!k) return 'Moderate';
  if (k.includes('crit') || k.includes('overload') || k.includes('extreme') || k.includes('severe')) return 'Critical';
  if (k.includes('high') || k.includes('heavy')) return 'High';
  if (k.includes('mod') || k.includes('med') || k.includes('norm') || k.includes('bal')) return 'Moderate';
  if (k.includes('low') || k.includes('light')) return 'Low';
  return toTitleCase(val);
}

function normalizeAttentionStatus(val: string): string {
  const k = normKey(val);
  if (!k) return 'On Track';
  if (k.includes('need') || k.includes('attention') || k.includes('flag') || k.includes('yes') || k === '1' || k === 'true' || k.includes('risk')) {
    return 'Needs Attention';
  }
  return 'On Track';
}

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.toUpperCase() === 'HR' || word.toUpperCase() === 'UK' || word.toUpperCase() === 'IT') {
        return word.toUpperCase();
      }
      if (word === '&') return '&';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function computeBurnoutRisk(
  params: {
    engagementScore: number;
    overdueTasks: number;
    pendingTasks: number;
    totalTasks: number;
    workloadLevel: string;
    leaveDaysRemaining: number;
  },
  thresholds: HRAlertThresholds = DEFAULT_THRESHOLDS
): {
  score: number;
  isBurnoutTrap: boolean;
  drivers: EmployeeRecord['riskDrivers'];
} {
  // 1. Engagement risk (0–35 pts): below target starts accruing, sharp climb below lowEngagementCutoff
  let engagementRisk = 0;
  if (params.engagementScore < thresholds.engagementTarget) {
    const gap = thresholds.engagementTarget - params.engagementScore;
    engagementRisk = Math.min(35, Math.round((gap / Math.max(thresholds.engagementTarget, 1)) * 45));
    if (params.engagementScore < thresholds.lowEngagementCutoff) {
      engagementRisk = Math.min(35, engagementRisk + 6);
    }
  }

  // 2. Overdue task risk (0–28 pts)
  const overdueCutoff = Math.max(thresholds.overdueTaskCutoff, 1);
  const overdueRisk = Math.min(28, Math.round((params.overdueTasks / (overdueCutoff * 1.6)) * 28));

  // 3. Workload tier risk (0–22 pts)
  const wl = normalizeWorkload(params.workloadLevel);
  const workloadRisk = wl === 'Critical' ? 22 : wl === 'High' ? 15 : wl === 'Moderate' ? 7 : 2;

  // 4. Pending load ratio (0–7 pts)
  const pendingRatio = (params.pendingTasks / Math.max(params.totalTasks, 1)) * 100;
  const pendingRisk = Math.min(7, Math.round((pendingRatio / 75) * 7));

  // 5. Unused Leave Burnout Trap (0–8 pts)
  const highWorkload = wl === 'High' || wl === 'Critical';
  const isBurnoutTrap = highWorkload && params.leaveDaysRemaining >= thresholds.unusedLeaveCutoff;
  const leaveTrapRisk = isBurnoutTrap
    ? Math.min(8, 4 + Math.round(((params.leaveDaysRemaining - thresholds.unusedLeaveCutoff) / 10) * 4))
    : params.leaveDaysRemaining >= thresholds.unusedLeaveCutoff
      ? 2
      : 0;

  const score = Math.max(
    0,
    Math.min(100, engagementRisk + overdueRisk + workloadRisk + pendingRisk + leaveTrapRisk)
  );

  return {
    score,
    isBurnoutTrap,
    drivers: {
      engagementRisk,
      overdueRisk,
      workloadRisk,
      pendingRisk,
      leaveTrapRisk,
    },
  };
}

export function recalculateRiskScores(
  records: EmployeeRecord[],
  thresholds: HRAlertThresholds
): EmployeeRecord[] {
  return records.map((rec) => {
    const { score, isBurnoutTrap, drivers } = computeBurnoutRisk(
      {
        engagementScore: rec.engagementScore,
        overdueTasks: rec.overdueTasks,
        pendingTasks: rec.pendingTasks,
        totalTasks: rec.totalTasks,
        workloadLevel: rec.workloadLevel,
        leaveDaysRemaining: rec.leaveDaysRemaining,
      },
      thresholds
    );
    return {
      ...rec,
      compositeBurnoutRiskScore: score,
      isBurnoutTrap,
      riskDrivers: drivers,
    };
  });
}

function getTenure(hireIso: string, snapshotIso: string): { months: number; band: TenureBand } {
  const h = new Date(hireIso);
  const s = new Date(snapshotIso);
  if (Number.isNaN(h.getTime()) || Number.isNaN(s.getTime())) {
    return { months: 18, band: '1–3 Yrs' };
  }
  const diffMonths = Math.max(
    0,
    (s.getUTCFullYear() - h.getUTCFullYear()) * 12 + (s.getUTCMonth() - h.getUTCMonth())
  );
  let band: TenureBand = '5+ Yrs';
  if (diffMonths < 12) band = '< 1 Yr';
  else if (diffMonths < 36) band = '1–3 Yrs';
  else if (diffMonths < 60) band = '3–5 Yrs';
  return { months: diffMonths, band };
}

export function cleanAndEngineerRows(
  rawRows: RawEmployeeRow[],
  options: {
    thresholds?: HRAlertThresholds;
    detectedSheets?: string[];
    primarySheetUsed?: string;
    definitionsSheetFound?: boolean;
  } = {}
): {
  records: EmployeeRecord[];
  scorecard: DataQualityScorecard;
} {
  const thresholds = options.thresholds || DEFAULT_THRESHOLDS;
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const headerByNorm = new Map<string, string>();
  headers.forEach((h) => headerByNorm.set(normKey(h), h));

  // Map schema columns
  const columnMap = new Map<string, string | null>();
  EXPECTED_SCHEMA.forEach((col) => {
    const exactNorm = normKey(col.name);
    let matched: string | null = headerByNorm.get(exactNorm) || null;
    if (!matched) {
      for (const alias of col.aliases) {
        if (headerByNorm.has(alias)) {
          matched = headerByNorm.get(alias)!;
          break;
        }
      }
    }
    if (!matched) {
      // Partial contains fallback
      for (const [nk, orig] of headerByNorm.entries()) {
        if (col.aliases.some((a) => nk.includes(a) || a.includes(nk))) {
          matched = orig;
          break;
        }
      }
    }
    columnMap.set(col.name, matched);
  });

  // Detect engagement scale across dataset
  const engHeader = columnMap.get('Engagement Score');
  let maxEng = 0;
  if (engHeader) {
    rawRows.forEach((r) => {
      const { num } = toFloat(r[engHeader], 0);
      if (num > maxEng) maxEng = num;
    });
  }
  let engMultiplier = 1;
  let engagementScaleDetected = '0–100 Scale';
  if (maxEng > 0 && maxEng <= 1.05) {
    engMultiplier = 100;
    engagementScaleDetected = '0–1 Decimal (auto-scaled ×100)';
  } else if (maxEng > 1.05 && maxEng <= 5.5) {
    engMultiplier = 20;
    engagementScaleDetected = '1–5 Rating (auto-scaled ×20)';
  } else if (maxEng > 5.5 && maxEng <= 10.5) {
    engMultiplier = 10;
    engagementScaleDetected = '1–10 Scale (auto-scaled ×10)';
  }

  const seenEmployeeIds = new Set<string>();
  let duplicateEmployeeIdsRemoved = 0;
  let blankAttentionReasonsPreserved = 0;
  let datesParsed = 0;
  let numericCoercions = 0;

  const columnCounts = new Map<string, { nonEmpty: number; blank: number }>();
  EXPECTED_SCHEMA.forEach((c) => columnCounts.set(c.name, { nonEmpty: 0, blank: 0 }));

  const records: EmployeeRecord[] = [];
  const defaultSnapshot = new Date().toISOString().slice(0, 10);
  let latestSnapshot = '';

  const getVal = (row: RawEmployeeRow, colName: string): unknown => {
    const h = columnMap.get(colName);
    if (!h) return undefined;
    return row[h];
  };

  rawRows.forEach((row, index) => {
    // Track completeness across raw rows
    EXPECTED_SCHEMA.forEach((c) => {
      const val = getVal(row, c.name);
      const counts = columnCounts.get(c.name)!;
      if (cleanStr(val) !== '') counts.nonEmpty += 1;
      else counts.blank += 1;
    });

    let employeeId = cleanStr(getVal(row, 'Employee ID'));
    if (!employeeId) {
      employeeId = `HAY-ROW-${String(index + 1).padStart(4, '0')}`;
    }

    // Strict primary key deduplication ONLY by Employee ID
    const idKey = employeeId.toUpperCase();
    if (seenEmployeeIds.has(idKey)) {
      duplicateEmployeeIdsRemoved += 1;
      return;
    }
    seenEmployeeIds.add(idKey);

    const employeeName = cleanStr(getVal(row, 'Employee Name')) || `Employee ${employeeId}`;
    const department = toTitleCase(cleanStr(getVal(row, 'Department')) || 'Operations');
    const jobLevel = toTitleCase(cleanStr(getVal(row, 'Job Level')) || 'Consultant');
    const location = toTitleCase(cleanStr(getVal(row, 'Location')) || 'London');
    const workArrangement = normalizeWorkArrangement(cleanStr(getVal(row, 'Work Arrangement')));
    const workStatus = normalizeWorkStatus(cleanStr(getVal(row, 'Work Status')));

    const lastUpdatedRes = parseFlexibleDate(getVal(row, 'Last Updated'), defaultSnapshot);
    if (lastUpdatedRes.parsed) datesParsed += 1;
    const lastUpdated = lastUpdatedRes.iso;
    if (!latestSnapshot || lastUpdated > latestSnapshot) {
      latestSnapshot = lastUpdated;
    }

    const hireDateRes = parseFlexibleDate(getVal(row, 'Hire Date'), '2023-06-01');
    if (hireDateRes.parsed) datesParsed += 1;
    const hireDate = hireDateRes.iso;

    const totalRes = toInt(getVal(row, 'Total Tasks'), 0);
    const compRes = toInt(getVal(row, 'Completed Tasks'), 0);
    const pendRes = toInt(getVal(row, 'Pending Tasks'), 0);
    const overRes = toInt(getVal(row, 'Overdue Tasks'), 0);
    const leaveRes = toInt(getVal(row, 'Leave Days Remaining'), 0);
    const engRawRes = toFloat(getVal(row, 'Engagement Score'), 70);

    numericCoercions +=
      Number(totalRes.coerced) +
      Number(compRes.coerced) +
      Number(pendRes.coerced) +
      Number(overRes.coerced) +
      Number(leaveRes.coerced) +
      Number(engRawRes.coerced);

    const totalTasks = Math.max(totalRes.num, compRes.num + pendRes.num);
    const completedTasks = compRes.num;
    const pendingTasks = pendRes.num;
    const overdueTasks = Math.min(overRes.num, Math.max(pendingTasks, overRes.num));
    const engagementScore = Math.max(0, Math.min(100, Math.round(engRawRes.num * engMultiplier)));
    const workloadLevel = normalizeWorkload(cleanStr(getVal(row, 'Workload Level')));
    const leaveDaysRemaining = leaveRes.num;
    const attentionStatus = normalizeAttentionStatus(cleanStr(getVal(row, 'Attention Status')));

    // Blanks in Attention Reason are expected & valid
    const rawReason = cleanStr(getVal(row, 'Attention Reason'));
    let attentionReason = rawReason;
    if (
      !rawReason ||
      rawReason.toLowerCase() === 'none' ||
      rawReason.toLowerCase() === 'none / on track' ||
      rawReason === '-' ||
      rawReason.toLowerCase() === 'n/a'
    ) {
      blankAttentionReasonsPreserved += 1;
      attentionReason = 'On Track';
    }

    const taskCompletionRate = Number(((completedTasks / Math.max(totalTasks, 1)) * 100).toFixed(1));
    const overdueTaskRatio = Number(((overdueTasks / Math.max(totalTasks, 1)) * 100).toFixed(1));
    const pendingLoadRatio = Number(((pendingTasks / Math.max(totalTasks, 1)) * 100).toFixed(1));
    const { months: tenureMonths, band: tenureBand } = getTenure(hireDate, lastUpdated);

    const { score, isBurnoutTrap, drivers } = computeBurnoutRisk(
      {
        engagementScore,
        overdueTasks,
        pendingTasks,
        totalTasks,
        workloadLevel,
        leaveDaysRemaining,
      },
      thresholds
    );

    records.push({
      employeeId,
      employeeName,
      department,
      jobLevel,
      location,
      workArrangement,
      workStatus,
      hireDate,
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      engagementScore,
      workloadLevel,
      leaveDaysRemaining,
      attentionStatus,
      attentionReason,
      lastUpdated,
      taskCompletionRate,
      overdueTaskRatio,
      pendingLoadRatio,
      tenureMonths,
      tenureBand,
      compositeBurnoutRiskScore: score,
      isBurnoutTrap,
      riskDrivers: drivers,
    });
  });

  const columnAudit: ColumnAuditItem[] = EXPECTED_SCHEMA.map((col) => {
    const matchedHeader = columnMap.get(col.name) || null;
    const counts = columnCounts.get(col.name) || { nonEmpty: 0, blank: 0 };
    const isReason = col.name === 'Attention Reason';
    return {
      columnNumber: col.num,
      expectedColumn: col.name,
      matchedHeader,
      status: !matchedHeader
        ? 'Missing (Defaulted)'
        : isReason
          ? 'Blanks Valid'
          : 'Matched',
      nonEmptyCount: counts.nonEmpty,
      blankCount: counts.blank,
      notes: !matchedHeader
        ? 'Not detected in file; safe default applied'
        : isReason
          ? 'Blank cells shown as "On Track"'
          : col.name === 'Employee ID'
            ? 'Unique Staff ID preserved'
            : col.name === 'Engagement Score'
              ? engagementScaleDetected
              : 'Checked & ready',
    };
  });

  const matchedCount = columnAudit.filter((c) => c.status !== 'Missing (Defaulted)').length;
  const completenessScore = Math.round((matchedCount / EXPECTED_SCHEMA.length) * 100);

  return {
    records,
    scorecard: {
      totalRawRows: rawRows.length,
      cleanedRows: records.length,
      duplicateEmployeeIdsRemoved,
      blankAttentionReasonsPreserved,
      datesParsed,
      numericCoercions,
      engagementScaleDetected,
      detectedSheets: options.detectedSheets || ['Employee_Monitoring'],
      primarySheetUsed: options.primarySheetUsed || 'Employee_Monitoring',
      definitionsSheetFound: Boolean(options.definitionsSheetFound),
      snapshotDate: latestSnapshot || defaultSnapshot,
      completenessScore,
      columnAudit,
    },
  };
}

export async function parseUploadedFile(
  file: File,
  thresholds: HRAlertThresholds
): Promise<{
  rawRows: RawEmployeeRow[];
  records: EmployeeRecord[];
  scorecard: DataQualityScorecard;
  definitions: StatusDefinition[] | null;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const sheetNames = workbook.SheetNames;

    // 1. Detect primary Employee_Monitoring sheet (or sheet containing Employee ID)
    let primarySheetName =
      sheetNames.find((name) => normKey(name) === 'employeemonitoring') ||
      sheetNames.find((name) => normKey(name).includes('employee')) ||
      '';

    if (!primarySheetName) {
      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        const preview = XLSX.utils.sheet_to_json<RawEmployeeRow>(sheet, { defval: '' });
        if (preview.length > 0) {
          const keys = Object.keys(preview[0]).map(normKey);
          if (keys.some((k) => k === 'employeeid' || k === 'empid')) {
            primarySheetName = name;
            break;
          }
        }
      }
    }
    if (!primarySheetName) {
      primarySheetName = sheetNames[0];
    }

    const primarySheet = workbook.Sheets[primarySheetName];
    const rawRows = XLSX.utils.sheet_to_json<RawEmployeeRow>(primarySheet, { defval: '' });

    // 2. Detect optional Status_Definitions sheet
    const defSheetName =
      sheetNames.find((name) => normKey(name) === 'statusdefinitions') ||
      sheetNames.find((name) => normKey(name).includes('definition') || normKey(name).includes('glossary'));

    let definitions: StatusDefinition[] | null = null;
    if (defSheetName) {
      const defSheet = workbook.Sheets[defSheetName];
      const defRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(defSheet, { defval: '' });
      const parsedDefs: StatusDefinition[] = [];
      defRows.forEach((r) => {
        const keys = Object.keys(r);
        const fieldKey = keys.find((k) => normKey(k).includes('field') || normKey(k).includes('term') || normKey(k).includes('metric')) || keys[0];
        const defKey = keys.find((k) => normKey(k).includes('def') || normKey(k).includes('desc') || normKey(k).includes('meaning')) || keys[1];
        const field = cleanStr(r[fieldKey]);
        const definition = cleanStr(r[defKey]);
        if (field && definition) {
          parsedDefs.push({ field, definition });
        }
      });
      if (parsedDefs.length > 0) {
        definitions = parsedDefs;
      }
    }

    const { records, scorecard } = cleanAndEngineerRows(rawRows, {
      thresholds,
      detectedSheets: sheetNames,
      primarySheetUsed: primarySheetName,
      definitionsSheetFound: Boolean(definitions && definitions.length > 0),
    });

    return { rawRows, records, scorecard, definitions };
  }

  if (ext === 'csv') {
    const text = await file.text();
    const parsed = Papa.parse<RawEmployeeRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const rawRows = parsed.data || [];
    const { records, scorecard } = cleanAndEngineerRows(rawRows, {
      thresholds,
      detectedSheets: ['CSV Import'],
      primarySheetUsed: 'CSV Import',
      definitionsSheetFound: false,
    });
    return { rawRows, records, scorecard, definitions: null };
  }

  if (ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawRows: RawEmployeeRow[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.employees)
        ? parsed.employees
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];
    const { records, scorecard } = cleanAndEngineerRows(rawRows, {
      thresholds,
      detectedSheets: ['JSON Import'],
      primarySheetUsed: 'JSON Import',
      definitionsSheetFound: false,
    });
    return { rawRows, records, scorecard, definitions: null };
  }

  throw new Error('Unsupported file format. Please upload .xlsx, .xls, .csv, or .json.');
}
