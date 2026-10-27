import { addDays, formatDate, percent, todayISO } from './utils.js';

export const EMPTY_STATE_COLLECTIONS = [
  'users', 'credentials', 'batches', 'students', 'attendance', 'assessments',
  'assessmentResults', 'tasks', 'trainerTasks', 'groups', 'syllabi',
];

export function normalizeState(input) {
  const base = input && typeof input === 'object' ? input : {};
  const meta = {
    institute: {
      name: 'EduTrack Training Institute', email: '', phone: '', address: '', website: '', accreditation: '',
      ...(base.meta?.institute || {}),
    },
    preferences: {
      theme: 'light', pageSize: 8, dateFormat: 'DD MMM YYYY', defaultPassingMarks: 40,
      showDemoLabel: true, compactTables: false, ...(base.meta?.preferences || {}),
    },
    dashboard: {
      cards: ['totalAdmissions', 'activeBatches', 'totalStudents', 'todayAttendance', 'upcomingAssessments', 'pendingTasks'],
      order: [], ...(base.meta?.dashboard || {}),
    },
  };
  if (!Array.isArray(meta.dashboard.order) || !meta.dashboard.order.length) meta.dashboard.order = meta.dashboard.cards;
  const state = { schemaVersion: 1, demo: true, updatedAt: new Date().toISOString(), ...base, meta };
  EMPTY_STATE_COLLECTIONS.forEach((key) => { if (!Array.isArray(state[key])) state[key] = []; });
  return state;
}

export function byId(records = []) {
  return Object.fromEntries(records.map((record) => [record.id, record]));
}

export function batchLabel(state, batchId) {
  return state.batches.find((batch) => batch.id === batchId)?.name || batchId || '—';
}

export function studentLabel(state, studentId) {
  return state.students.find((student) => student.id === studentId)?.name || studentId || '—';
}

export function trainerLabel(state, user) {
  if (!user) return '—';
  if (typeof user === 'string' && !user.startsWith('USER-')) return user;
  const found = state.users.find((u) => u.id === user || u.name === user);
  return found?.name || (typeof user === 'string' ? user : '—');
}

export function syllabusCompletion(syllabus) {
  const topics = (syllabus?.modules || []).flatMap((module) => module.topics || []);
  const completed = topics.filter((topic) => topic.completed).length;
  return { completed, total: topics.length, percentage: percent(completed, topics.length), modules: (syllabus?.modules || []).length };
}

export function attendanceSummary(records = []) {
  const counts = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
  records.forEach((record) => { if (counts[record.status] !== undefined) counts[record.status] += 1; });
  const total = records.length;
  const attended = counts.Present + counts.Late;
  return { ...counts, total, attended, percentage: percent(attended, total) };
}

export function todayAttendanceRecords(state) {
  const today = todayISO();
  return state.attendance.filter((record) => record.date === today);
}

export function upcomingAssessments(state, days = 60) {
  const start = todayISO();
  const end = addDays(start, days);
  return state.assessments.filter((assessment) => assessment.date >= start && assessment.date <= end && assessment.status !== 'Completed');
}

export function pendingTasks(state) {
  return [...state.tasks, ...state.trainerTasks].filter((task) => task.status !== 'Completed');
}

export function overdueTasks(state) {
  const today = todayISO();
  return [...state.tasks, ...state.trainerTasks].filter((task) => task.status !== 'Completed' && (task.dueDate || task.deadline) && (task.dueDate || task.deadline) < today);
}

export function studentAttendancePercentage(state, studentId) {
  const records = state.attendance.filter((record) => record.studentId === studentId);
  return attendanceSummary(records).percentage;
}

export function getDashboardMetrics(state) {
  const todaySummary = attendanceSummary(todayAttendanceRecords(state));
  const activeStudents = state.students.filter((student) => student.status === 'Active').length;
  return [
    {
      id: 'totalAdmissions', label: 'Total Admissions', value: state.students.length,
      description: 'Admissions · Count', icon: 'UserPlus', trend: `${state.students.filter((s) => s.admissionDate >= addDays(todayISO(), -30)).length} in last 30 days`,
    },
    {
      id: 'activeBatches', label: 'Active Batches', value: state.batches.filter((batch) => batch.status === 'Active').length,
      description: 'Batches · Active', icon: 'Layers3', trend: `${state.batches.length} total batches`,
    },
    {
      id: 'totalStudents', label: 'Total Students', value: activeStudents,
      description: 'Students · Enrolled', icon: 'Users', trend: `${state.students.filter((s) => s.status === 'Completed').length} completed`,
    },
    {
      id: 'todayAttendance', label: "Today's Attendance", value: `${todaySummary.percentage}%`,
      description: `${todaySummary.attended} of ${todaySummary.total} · Present or late`, icon: 'CalendarCheck', trend: formatDate(todayISO()),
    },
    {
      id: 'upcomingAssessments', label: 'Upcoming Assessments', value: upcomingAssessments(state).length,
      description: 'Assessments · Next 60 days', icon: 'ClipboardList', trend: `${state.assessmentResults.length} results recorded`,
    },
    {
      id: 'pendingTasks', label: 'Pending Tasks', value: pendingTasks(state).length,
      description: 'Tasks · Not completed', icon: 'ListTodo', trend: `${overdueTasks(state).length} overdue`,
    },
    {
      id: 'totalGroups', label: 'Student Groups', value: state.groups.length,
      description: 'Groups · Active', icon: 'UsersRound', trend: `${state.groups.reduce((sum, g) => sum + (g.memberIds || []).length, 0)} memberships`,
    },
    {
      id: 'syllabusCompletion', label: 'Syllabus Completion', value: `${Math.round(state.syllabi.reduce((sum, s) => sum + syllabusCompletion(s).percentage, 0) / Math.max(1, state.syllabi.length))}%`,
      description: 'Curriculum · Average', icon: 'BookOpenCheck', trend: `${state.syllabi.length} course syllabi`,
    },
    {
      id: 'assessmentPassRate', label: 'Assessment Pass Rate', value: `${percent(state.assessmentResults.filter((r) => r.result === 'Pass').length, state.assessmentResults.length)}%`,
      description: 'Results · Passed', icon: 'Award', trend: `${state.assessmentResults.length} evaluated`,
    },
    {
      id: 'overdueTasks', label: 'Overdue Tasks', value: overdueTasks(state).length,
      description: 'Tasks · Past deadline', icon: 'AlarmClock', trend: 'Needs attention',
    },
    {
      id: 'totalTrainers', label: 'Trainers', value: state.users.filter((user) => user.role === 'Trainer').length,
      description: 'Users · Teaching staff', icon: 'GraduationCap', trend: `${state.users.length} total users`,
    },
    {
      id: 'paymentPending', label: 'Payments Pending', value: state.students.filter((student) => student.paymentStatus !== 'Paid').length,
      description: 'Students · Fees outstanding', icon: 'Wallet', trend: 'Partial or pending',
    },
  ];
}

export function getMetricMap(state) {
  return Object.fromEntries(getDashboardMetrics(state).map((metric) => [metric.id, metric]));
}

export function batchDistribution(state) {
  return state.batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    course: batch.course,
    count: state.students.filter((student) => student.batchId === batch.id).length,
    status: batch.status,
  }));
}

export function admissionsByMonth(state, months = 6) {
  const result = [];
  const now = new Date();
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({ key, label: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d), admissions: state.students.filter((student) => student.admissionDate?.startsWith(key)).length });
  }
  return result;
}

export function attendanceTrend(state, days = 7) {
  const today = todayISO();
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, -(days - 1 - index));
    const summary = attendanceSummary(state.attendance.filter((record) => record.date === date));
    return { date, label: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)), percentage: summary.percentage, present: summary.Present + summary.Late, total: summary.total };
  });
}
