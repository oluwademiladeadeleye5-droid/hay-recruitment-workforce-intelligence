import { ActiveDatasetPayload, RawEmployeeRow, StatusDefinition } from '../types/workforce';
import { cleanAndEngineerRows, DEFAULT_THRESHOLDS } from '../utils/dataEngine';

export const DEFAULT_STATUS_DEFINITIONS: StatusDefinition[] = [
  {
    field: "Today's Status: Present",
    definition: 'Team member is working in one of our UK offices today.',
  },
  {
    field: "Today's Status: Remote",
    definition: 'Team member is actively working from home today.',
  },
  {
    field: "Today's Status: Leave",
    definition: 'Team member is on approved annual leave, parental leave, or scheduled time off.',
  },
  {
    field: "Today's Status: Absent",
    definition: 'Unplanned or sick absence recorded today, worth a quick manager check-in.',
  },
  {
    field: 'Work Setup: Hybrid, Remote, or On-Site',
    definition: 'Regular working pattern: Hybrid (mix of office and home), Remote (from home), or On-Site (office-based).',
  },
  {
    field: 'Workload: Low, Moderate, High, or Critical',
    definition: 'How busy someone is right now based on their open tasks and workload.',
  },
  {
    field: 'Check-In Status: Needs Check-In vs On Track',
    definition: 'Highlights team members showing early signs of low mood, late tasks, or heavy workload so managers can help early.',
  },
  {
    field: 'Attention Reason',
    definition: 'The main reason someone needs a check-in. Blank rows mean everything looks good and are shown as "On Track".',
  },
  {
    field: 'Leave Days Left',
    definition: 'Unused annual leave days remaining. Having 15+ unused days alongside a High or Critical workload triggers a burnout warning.',
  },
  {
    field: 'Stress Level: Low, Medium, or High',
    definition: 'Simple indicator combining Team Mood, Late Tasks, Workload, and unused leave so managers can spot pressure fast.',
  },
];

// Deterministic PRNG for consistent, realistic 512-employee Hay Recruitment UK dataset
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const FIRST_NAMES = [
  'Oliver', 'Amelia', 'George', 'Isla', 'Harry', 'Ava', 'Noah', 'Mia', 'Jack', 'Sophia',
  'Charlie', 'Grace', 'Leo', 'Freya', 'Arthur', 'Lily', 'Oscar', 'Emily', 'Muhammad', 'Evie',
  'Henry', 'Poppy', 'Theo', 'Ella', 'Jacob', 'Charlotte', 'Freddie', 'Willow', 'Alfie', 'Daisy',
  'Lucas', 'Phoebe', 'Edward', 'Sienna', 'Thomas', 'Ruby', 'Sebastian', 'Alice', 'William', 'Maya',
  'Hannah', 'Callum', 'Chloe', 'Alistair', 'Imogen', 'Rory', 'Eleanor', 'Kieran', 'Niamh', 'Priya',
  'Zara', 'Tariq', 'Declan', 'Ciara', 'Ben', 'Sophie', 'Daniel', 'Rebecca', 'Sam', 'Laura',
];

const LAST_NAMES = [
  'Bennett', 'Clarke', 'Taylor', 'Williams', 'Davies', 'Evans', 'Wilson', 'Wright', 'Walker', 'Robinson',
  'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Martin', 'Jackson',
  'Patel', 'Khan', 'Campbell', 'Stewart', 'Murray', 'Robertson', 'Byrne', 'OConnor', 'Bhatia', 'Kaur',
  'Shaw', 'Fletcher', 'Mason', 'Carter', 'Turner', 'Parker', 'Collins', 'Morris', 'Cook', 'Morgan',
  'Cooper', 'Ward', 'Bell', 'Bailey', 'Richardson', 'Cox', 'Howard', 'Brooks', 'Watson', 'Gray',
];

const DEPARTMENTS = [
  { name: 'Technology & Digital', weight: 0.17, engBias: -6, loadBias: 0.18 },
  { name: 'Finance & Accounting', weight: 0.14, engBias: 2, loadBias: 0.05 },
  { name: 'Executive Search', weight: 0.11, engBias: 5, loadBias: -0.05 },
  { name: 'Legal & Compliance', weight: 0.10, engBias: 1, loadBias: 0.04 },
  { name: 'Healthcare Staffing', weight: 0.14, engBias: -8, loadBias: 0.22 },
  { name: 'Engineering & Construction', weight: 0.13, engBias: -2, loadBias: 0.10 },
  { name: 'Client Delivery', weight: 0.12, engBias: -4, loadBias: 0.14 },
  { name: 'People & HR Ops', weight: 0.09, engBias: 7, loadBias: -0.10 },
];

const JOB_LEVELS = [
  'Associate Consultant',
  'Senior Consultant',
  'Principal Consultant',
  'Team Manager',
  'Director',
];

const LOCATIONS = [
  { name: 'London', weight: 0.36, engBias: -3 },
  { name: 'Manchester', weight: 0.21, engBias: 2 },
  { name: 'Birmingham', weight: 0.16, engBias: -4 },
  { name: 'Edinburgh', weight: 0.14, engBias: 4 },
  { name: 'Bristol', weight: 0.13, engBias: 3 },
];

const ATTENTION_REASONS = [
  'Overdue Task Backlog',
  'Sustained Low Engagement',
  'Burnout Risk: Unused Leave',
  'Critical Workload Overload',
  'Attendance & Absence Dip',
];

function pickWeighted<T extends { weight: number }>(items: T[], r: number): T {
  let acc = 0;
  for (const item of items) {
    acc += item.weight;
    if (r <= acc) return item;
  }
  return items[items.length - 1];
}

export function buildDemoDataset(): ActiveDatasetPayload {
  const rng = createRng(20261125);
  const rawRows: RawEmployeeRow[] = [];
  const snapshotDate = '2026-11-20';

  for (let i = 0; i < 512; i++) {
    const empId = `HAY-${String(1001 + i).padStart(4, '0')}`;

    // Intentionally share a few names across different Employee IDs to test strict ID keying
    let first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    let last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    if (i === 14 || i === 188) {
      first = 'Oliver';
      last = 'Bennett';
    } else if (i === 42 || i === 319) {
      first = 'Amelia';
      last = 'Clarke';
    }
    const employeeName = `${first} ${last}`;

    const deptObj = pickWeighted(DEPARTMENTS, rng());
    const locObj = pickWeighted(LOCATIONS, rng());

    const jlRoll = rng();
    const jobLevel =
      jlRoll < 0.30
        ? JOB_LEVELS[0]
        : jlRoll < 0.60
          ? JOB_LEVELS[1]
          : jlRoll < 0.80
            ? JOB_LEVELS[2]
            : jlRoll < 0.93
              ? JOB_LEVELS[3]
              : JOB_LEVELS[4];

    const arrRoll = rng();
    const workArrangement = arrRoll < 0.56 ? 'Hybrid' : arrRoll < 0.82 ? 'Remote' : 'On-Site';

    const statusRoll = rng();
    let workStatus = 'Present';
    if (workArrangement === 'Remote') {
      workStatus = statusRoll < 0.82 ? 'Remote' : statusRoll < 0.93 ? 'Leave' : 'Absent';
    } else if (workArrangement === 'On-Site') {
      workStatus = statusRoll < 0.80 ? 'Present' : statusRoll < 0.92 ? 'Leave' : 'Absent';
    } else {
      workStatus = statusRoll < 0.48 ? 'Present' : statusRoll < 0.84 ? 'Remote' : statusRoll < 0.94 ? 'Leave' : 'Absent';
    }

    // Hire date between 2018 and mid-2026
    const hireYear = 2018 + Math.floor(rng() * 9);
    const hireMonth = 1 + Math.floor(rng() * (hireYear === 2026 ? 9 : 12));
    const hireDay = 1 + Math.floor(rng() * 28);
    const hireDate = `${hireYear}-${String(hireMonth).padStart(2, '0')}-${String(hireDay).padStart(2, '0')}`;

    const wlRoll = rng() + deptObj.loadBias;
    const workloadLevel =
      wlRoll < 0.18
        ? 'Low'
        : wlRoll < 0.58
          ? 'Moderate'
          : wlRoll < 0.86
            ? 'High'
            : 'Critical';

    const baseTasks =
      workloadLevel === 'Low'
        ? 14 + Math.floor(rng() * 10)
        : workloadLevel === 'Moderate'
          ? 24 + Math.floor(rng() * 14)
          : workloadLevel === 'High'
            ? 36 + Math.floor(rng() * 16)
            : 48 + Math.floor(rng() * 18);

    const completionFactor =
      workloadLevel === 'Critical'
        ? 0.42 + rng() * 0.24
        : workloadLevel === 'High'
          ? 0.54 + rng() * 0.24
          : 0.68 + rng() * 0.24;

    const completedTasks = Math.round(baseTasks * completionFactor);
    const pendingTasks = Math.max(1, baseTasks - completedTasks);

    const overdueRate =
      workloadLevel === 'Critical'
        ? 0.35 + rng() * 0.40
        : workloadLevel === 'High'
          ? 0.18 + rng() * 0.32
          : workloadLevel === 'Moderate'
            ? 0.04 + rng() * 0.16
            : rng() * 0.08;
    const overdueTasks = Math.min(pendingTasks, Math.round(pendingTasks * overdueRate));

    const arrangementBias = workArrangement === 'Remote' ? -4 : workArrangement === 'Hybrid' ? 3 : -1;
    const workloadEngBias =
      workloadLevel === 'Critical'
        ? -20
        : workloadLevel === 'High'
          ? -10
          : workloadLevel === 'Moderate'
            ? 4
            : 8;

    const rawEngagement = Math.round(
      75 + deptObj.engBias + locObj.engBias + arrangementBias + workloadEngBias + (rng() - 0.5) * 26
    );
    const engagementScore = Math.max(28, Math.min(98, rawEngagement));

    // Unused annual leave (higher when overloaded -> burnout trap!)
    const leaveDaysRemaining =
      workloadLevel === 'Critical'
        ? Math.round(13 + rng() * 14)
        : workloadLevel === 'High'
          ? Math.round(9 + rng() * 16)
          : Math.round(3 + rng() * 15);

    const needsAttention =
      engagementScore < 65 ||
      overdueTasks >= 5 ||
      (workloadLevel === 'Critical' && leaveDaysRemaining >= 15) ||
      (workStatus === 'Absent' && engagementScore < 72);

    let attentionReason = '';
    if (needsAttention) {
      if (workloadLevel === 'Critical' && leaveDaysRemaining >= 15) {
        attentionReason = ATTENTION_REASONS[2];
      } else if (overdueTasks >= 6) {
        attentionReason = ATTENTION_REASONS[0];
      } else if (engagementScore < 60) {
        attentionReason = ATTENTION_REASONS[1];
      } else if (workStatus === 'Absent') {
        attentionReason = ATTENTION_REASONS[4];
      } else if (workloadLevel === 'Critical' || workloadLevel === 'High') {
        attentionReason = ATTENTION_REASONS[3];
      } else {
        attentionReason = ATTENTION_REASONS[Math.floor(rng() * 3)];
      }
    }

    rawRows.push({
      'Employee ID': empId,
      'Employee Name': employeeName,
      Department: deptObj.name,
      'Job Level': jobLevel,
      Location: locObj.name,
      'Work Arrangement': workArrangement,
      'Work Status': workStatus,
      'Hire Date': hireDate,
      'Total Tasks': baseTasks,
      'Completed Tasks': completedTasks,
      'Pending Tasks': pendingTasks,
      'Overdue Tasks': overdueTasks,
      'Engagement Score': engagementScore,
      'Workload Level': workloadLevel,
      'Leave Days Remaining': leaveDaysRemaining,
      'Attention Status': needsAttention ? 'Needs Attention' : 'On Track',
      'Attention Reason': attentionReason, // Intentionally blank for On Track employees
      'Last Updated': snapshotDate,
    });
  }

  const { records, scorecard } = cleanAndEngineerRows(rawRows, {
    thresholds: DEFAULT_THRESHOLDS,
    detectedSheets: ['Employee_Monitoring', 'Status_Definitions'],
    primarySheetUsed: 'Employee_Monitoring',
    definitionsSheetFound: true,
  });

  return {
    id: 'demo-hay-uk-512',
    sourceType: 'demo',
    filename: 'Hay_Recruitment_UK_Workforce_512.xlsx',
    uploadedAt: '2026-11-20T09:00:00.000Z',
    rawRows,
    records,
    qualityScorecard: scorecard,
  };
}
