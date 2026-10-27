import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, BookOpenCheck, CalendarRange, CheckCircle2, ClipboardCheck, Download,
  GraduationCap, LineChart as LineChartIcon, ListChecks, TrendingUp, UserPlus, Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Card, CardHeader } from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import { MiniStat, ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { attendanceSummary, syllabusCompletion } from '../lib/metrics';
import { addDays, downloadFile, formatDate, monthStart, paginate, percent, toCSV, todayISO } from '../lib/utils';

const REPORTS = [
  { value: 'admissions', label: 'Admissions', icon: UserPlus, description: 'Admission volume by month and detailed new student records.' },
  { value: 'enrollment', label: 'Enrollment', icon: Users, description: 'Enrollment mix by course, batch and current status.' },
  { value: 'batches', label: 'Batch performance', icon: GraduationCap, description: 'Attendance, assessment, curriculum and task health by batch.' },
  { value: 'attendance', label: 'Attendance', icon: CalendarRange, description: 'Daily and monthly attendance derived from saved registers.' },
  { value: 'assessments', label: 'Assessments', icon: ClipboardCheck, description: 'Average score and pass rate for each assessment.' },
  { value: 'tasks', label: 'Task completion', icon: ListChecks, description: 'Operational and trainer work across the selected period.' },
  { value: 'syllabus', label: 'Syllabus', icon: BookOpenCheck, description: 'Lesson and topic completion by course.' },
];

function monthKey(date) {
  return date?.slice(0, 7);
}

function monthLabel(key) {
  if (!key) return '—';
  return formatDate(`${key}-01`, { month: 'short', year: '2-digit' });
}

function inRange(date, from, to) {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : 0;
}

function groupBy(records, keyFn) {
  const map = new Map();
  records.forEach((record) => {
    const key = keyFn(record);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
  });
  return map;
}

function buildMonthKeys(from, to, fallbackCount = 6) {
  if (!from) return Array.from({ length: fallbackCount }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (fallbackCount - 1 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const keys = [];
  const current = new Date(`${from.slice(0, 7)}-01T12:00:00`);
  const end = new Date(`${(to || todayISO()).slice(0, 7)}-01T12:00:00`);
  while (current <= end && keys.length < 24) {
    keys.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
    current.setMonth(current.getMonth() + 1);
  }
  return keys;
}

function ReportChart({ config }) {
  if (!config || !config.data?.length) return <EmptyState icon={BarChart3} title="No chart data" description="No application records fall within the selected date range." compact />;
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
      <XAxis dataKey={config.xKey} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={0} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
    </>
  );
  return (
    <ResponsiveContainer width="100%" height={260}>
      {config.type === 'line' ? (
        <LineChart data={config.data} margin={{ top: 8, right: 10, left: -18, bottom: 4 }}>
          {common}
          {(config.lines || [{ key: 'value', color: '#F43F5E', name: 'Value' }]).map((line) => (
            <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color || '#F43F5E'} strokeWidth={2.4} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      ) : (
        <BarChart data={config.data} margin={{ top: 8, right: 10, left: -18, bottom: 4 }}>
          {common}
          {(config.bars || [{ key: 'value', color: '#F43F5E', name: 'Value' }]).map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.color || '#F43F5E'} radius={[6, 6, 0, 0]} maxBarSize={42} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

export default function Reports() {
  const { state, notify } = useApp();
  const [reportKey, setReportKey] = useState('admissions');
  const [from, setFrom] = useState(addDays(todayISO(), -180));
  const [to, setTo] = useState(todayISO());
  const [preset, setPreset] = useState('180');
  const [attendanceView, setAttendanceView] = useState('daily');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [reportKey, from, to, attendanceView]);

  const applyPreset = (value) => {
    setPreset(value);
    const today = todayISO();
    if (value === '30') { setFrom(addDays(today, -29)); setTo(today); }
    if (value === 'month') { setFrom(monthStart(0)); setTo(today); }
    if (value === '180') { setFrom(addDays(today, -179)); setTo(today); }
    if (value === 'all') { setFrom(''); setTo(today); }
  };

  const report = useMemo(() => {
    const admissions = state.students.filter((student) => inRange(student.admissionDate, from, to));
    const attendance = state.attendance.filter((record) => inRange(record.date, from, to));
    const assessments = state.assessments.filter((assessment) => inRange(assessment.date, from, to));
    const tasks = state.tasks.filter((task) => inRange(task.dueDate, from, to)).map((task) => ({ ...task, kind: 'General', owner: state.users.find((u) => u.id === task.assignee || u.name === task.assignee)?.name || task.assignee, due: task.dueDate }));
    const trainerTasks = state.trainerTasks.filter((task) => inRange(task.deadline, from, to)).map((task) => ({ ...task, kind: 'Trainer', owner: state.users.find((u) => u.id === task.trainerId || u.name === task.owner)?.name || task.owner, due: task.deadline }));
    const allTasks = [...tasks, ...trainerTasks];
    const assessmentIds = new Set(assessments.map((assessment) => assessment.id));
    const results = state.assessmentResults.filter((result) => assessmentIds.has(result.assessmentId) || inRange(result.updatedAt?.slice(0, 10), from, to));
    const attendanceOverall = attendanceSummary(attendance);
    const taskCompleted = allTasks.filter((task) => task.status === 'Completed').length;
    const syllabusAverage = average(state.syllabi.map((syllabus) => syllabusCompletion(syllabus).percentage));
    const passRate = percent(results.filter((result) => result.result === 'Pass').length, results.length);

    const months = buildMonthKeys(from, to, 6);
    const admissionsMonthly = groupBy(admissions, (student) => monthKey(student.admissionDate));
    const admissionsChart = months.map((key) => ({ key, label: monthLabel(key), value: (admissionsMonthly.get(key) || []).length }));
    const attendanceByDate = groupBy(attendance, (record) => record.date);
    const attendanceByMonth = groupBy(attendance, (record) => monthKey(record.date));
    const dailyRows = [...attendanceByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, records]) => {
      const summary = attendanceSummary(records);
      return { id: date, date, total: summary.total, present: summary.Present, late: summary.Late, absent: summary.Absent, excused: summary.Excused, percentage: summary.percentage };
    });
    const monthlyRows = [...attendanceByMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, records]) => {
      const summary = attendanceSummary(records);
      return { id: key, month: monthLabel(key), total: summary.total, present: summary.Present, late: summary.Late, absent: summary.Absent, excused: summary.Excused, percentage: summary.percentage };
    });
    const attendanceRows = attendanceView === 'daily' ? dailyRows : monthlyRows;
    const attendanceChart = attendanceView === 'daily'
      ? dailyRows.slice(-14).map((row) => ({ key: formatDate(row.date, { day: '2-digit', month: 'short' }), value: row.percentage }))
      : monthlyRows.map((row) => ({ key: row.month, value: row.percentage }));

    const courseAdmissions = [...groupBy(admissions, (student) => student.course).entries()].map(([course, records]) => ({ key: course.length > 12 ? `${course.slice(0, 11)}…` : course, value: records.length }));
    const enrollmentStatus = [...groupBy(state.students.filter((student) => inRange(student.admissionDate, from, to)), (student) => student.status).entries()].map(([status, records]) => ({ key: status, value: records.length }));

    const batchRows = state.batches.map((batch) => {
      const students = state.students.filter((student) => student.batchId === batch.id);
      const batchAttendance = attendance.filter((record) => record.batchId === batch.id);
      const batchAssessmentIds = new Set(assessments.filter((assessment) => assessment.batchId === batch.id).map((assessment) => assessment.id));
      const batchResults = state.assessmentResults.filter((result) => batchAssessmentIds.has(result.assessmentId) || result.batchId === batch.id && inRange(state.assessments.find((assessment) => assessment.id === result.assessmentId)?.date, from, to));
      const syllabus = state.syllabi.find((item) => (item.batchIds || []).includes(batch.id));
      const batchTasks = allTasks.filter((task) => task.batchId === batch.id);
      return {
        id: batch.id, batch: batch.name, course: batch.course, students: students.length,
        attendance: attendanceSummary(batchAttendance).percentage,
        assessment: percent(batchResults.filter((result) => result.result === 'Pass').length, batchResults.length),
        syllabus: syllabus ? syllabusCompletion(syllabus).percentage : 0,
        taskCompletion: percent(batchTasks.filter((task) => task.status === 'Completed').length, batchTasks.length),
        status: batch.status,
      };
    });

    const assessmentRows = assessments.map((assessment) => {
      const assessmentResults = state.assessmentResults.filter((result) => result.assessmentId === assessment.id);
      const passed = assessmentResults.filter((result) => result.result === 'Pass').length;
      return {
        id: assessment.id, title: assessment.title, batch: state.batches.find((batch) => batch.id === assessment.batchId)?.name || assessment.batchId,
        date: assessment.date, evaluated: assessmentResults.length, average: average(assessmentResults.map((result) => result.percentage)),
        passRate: percent(passed, assessmentResults.length), maxMarks: assessment.maxMarks, status: assessment.status,
      };
    });

    const taskStatusRows = ['To Do', 'In Progress', 'Completed', 'Blocked'].map((status) => ({ key: status, value: allTasks.filter((task) => task.status === status).length })).filter((row) => row.value);

    const syllabusRows = state.syllabi.map((syllabus) => {
      const topics = (syllabus.modules || []).flatMap((module) => module.topics || []);
      const periodTopics = topics.filter((topic) => !topic.completed || inRange(topic.completionDate, from, to));
      const completed = periodTopics.filter((topic) => topic.completed).length;
      return {
        id: syllabus.id, course: syllabus.course, modules: (syllabus.modules || []).length,
        topics: topics.length, completed, remaining: topics.length - topics.filter((topic) => topic.completed).length,
        percentage: syllabusCompletion(syllabus).percentage,
        periodPercentage: percent(completed, periodTopics.length),
        batches: (syllabus.batchIds || []).map((id) => state.batches.find((batch) => batch.id === id)?.name || id).join('; '),
      };
    });

    const commonKpis = [
      { label: 'Admissions', value: admissions.length, icon: UserPlus },
      { label: 'Avg. attendance', value: `${attendanceOverall.percentage}%`, icon: CalendarRange, tone: 'success' },
      { label: 'Pass rate', value: `${passRate}%`, icon: ClipboardCheck, tone: 'info' },
      { label: 'Task completion', value: `${percent(taskCompleted, allTasks.length)}%`, icon: ListChecks, tone: 'warning' },
    ];

    const configs = {
      admissions: {
        title: 'Admissions report', description: REPORTS[0].description, kpis: commonKpis,
        chart: { type: 'line', data: admissionsChart, xKey: 'label', lines: [{ key: 'value', color: '#F43F5E', name: 'Admissions' }] }, chartTitle: 'Admissions trend',
        rows: admissions.map((student) => ({ ...student, batch: state.batches.find((batch) => batch.id === student.batchId)?.name || student.batchId })),
        columns: [
          { key: 'name', label: 'Student', render: (row) => <strong>{row.name}</strong> },
          { key: 'studentId', label: 'Student ID' }, { key: 'course', label: 'Course' },
          { key: 'batch', label: 'Batch' }, { key: 'admissionDate', label: 'Admission date', render: (row) => formatDate(row.admissionDate) },
          { key: 'status', label: 'Status', render: (row) => <Badge tone="auto">{row.status}</Badge> },
          { key: 'paymentStatus', label: 'Payment', render: (row) => <Badge tone="auto">{row.paymentStatus}</Badge> },
        ],
        filename: 'edutrack-admissions-report.csv',
        headers: [
          { label: 'Student ID', key: 'studentId' }, { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' },
          { label: 'Phone', key: 'phone' }, { label: 'Course', key: 'course' }, { label: 'Batch', key: 'batch' },
          { label: 'Admission date', key: 'admissionDate' }, { label: 'Status', key: 'status' }, { label: 'Payment', key: 'paymentStatus' },
        ],
      },
      enrollment: {
        title: 'Student enrollment report', description: REPORTS[1].description, kpis: [
          { label: 'Students in range', value: admissions.length, icon: Users },
          { label: 'Active students', value: state.students.filter((student) => student.status === 'Active').length, icon: CheckCircle2, tone: 'success' },
          { label: 'Courses', value: new Set(admissions.map((student) => student.course)).size, icon: GraduationCap, tone: 'info' },
          { label: 'Batches', value: new Set(admissions.map((student) => student.batchId)).size, icon: BarChart3 },
        ],
        chart: { type: 'bar', data: courseAdmissions.length ? courseAdmissions : enrollmentStatus, xKey: 'key', bars: [{ key: 'value', color: '#171717', name: 'Students' }] }, chartTitle: 'Students by course',
        rows: admissions.map((student) => ({ ...student, batch: state.batches.find((batch) => batch.id === student.batchId)?.name || student.batchId })),
        columns: [
          { key: 'name', label: 'Student', render: (row) => <strong>{row.name}</strong> },
          { key: 'course', label: 'Course' }, { key: 'batch', label: 'Batch' },
          { key: 'status', label: 'Enrollment', render: (row) => <Badge tone="auto">{row.status}</Badge> },
          { key: 'paymentStatus', label: 'Payment', render: (row) => <Badge tone="auto">{row.paymentStatus}</Badge> },
          { key: 'admissionDate', label: 'Admitted', render: (row) => formatDate(row.admissionDate) },
        ],
        filename: 'edutrack-enrollment-report.csv',
        headers: [
          { label: 'Student ID', key: 'studentId' }, { label: 'Name', key: 'name' }, { label: 'Course', key: 'course' },
          { label: 'Batch', key: 'batch' }, { label: 'Status', key: 'status' }, { label: 'Payment', key: 'paymentStatus' },
          { label: 'Admission date', key: 'admissionDate' },
        ],
      },
      batches: {
        title: 'Batch performance report', description: REPORTS[2].description, kpis: [
          { label: 'Batches', value: batchRows.length, icon: GraduationCap },
          { label: 'Avg. attendance', value: `${average(batchRows.map((row) => row.attendance))}%`, icon: CalendarRange, tone: 'success' },
          { label: 'Avg. pass rate', value: `${average(batchRows.map((row) => row.assessment))}%`, icon: ClipboardCheck, tone: 'info' },
          { label: 'Avg. curriculum', value: `${average(batchRows.map((row) => row.syllabus))}%`, icon: BookOpenCheck, tone: 'warning' },
        ],
        chart: {
          type: 'bar', data: batchRows.map((row) => ({ ...row, key: row.course.length > 12 ? `${row.course.slice(0, 11)}…` : row.course })),
          xKey: 'key', bars: [
            { key: 'attendance', color: '#10B981', name: 'Attendance %' },
            { key: 'assessment', color: '#F43F5E', name: 'Pass rate %' },
            { key: 'syllabus', color: '#6366F1', name: 'Syllabus %' },
          ],
        }, chartTitle: 'Performance by batch',
        rows: batchRows,
        columns: [
          { key: 'batch', label: 'Batch', render: (row) => <strong>{row.batch}</strong> },
          { key: 'course', label: 'Course' }, { key: 'students', label: 'Students' },
          { key: 'attendance', label: 'Attendance', render: (row) => <div className="table-progress"><ProgressBar value={row.attendance} compact /><span>{row.attendance}%</span></div> },
          { key: 'assessment', label: 'Pass rate', render: (row) => `${row.assessment}%` },
          { key: 'syllabus', label: 'Curriculum', render: (row) => `${row.syllabus}%` },
          { key: 'taskCompletion', label: 'Tasks', render: (row) => `${row.taskCompletion}%` },
          { key: 'status', label: 'Status', render: (row) => <Badge tone="auto">{row.status}</Badge> },
        ],
        filename: 'edutrack-batch-performance.csv',
        headers: [
          { label: 'Batch', key: 'batch' }, { label: 'Course', key: 'course' }, { label: 'Students', key: 'students' },
          { label: 'Attendance %', key: 'attendance' }, { label: 'Pass rate %', key: 'assessment' },
          { label: 'Syllabus %', key: 'syllabus' }, { label: 'Task completion %', key: 'taskCompletion' }, { label: 'Status', key: 'status' },
        ],
      },
      attendance: {
        title: attendanceView === 'daily' ? 'Daily attendance report' : 'Monthly attendance report', description: REPORTS[3].description, kpis: [
          { label: 'Records', value: attendance.length, icon: CalendarRange },
          { label: 'Avg. attendance', value: `${attendanceOverall.percentage}%`, icon: TrendingUp, tone: 'success' },
          { label: 'Present / late', value: attendanceOverall.attended, icon: CheckCircle2, tone: 'info' },
          { label: 'Absent', value: attendanceOverall.Absent, icon: Users, tone: 'danger' },
        ],
        chart: { type: attendanceView === 'daily' ? 'line' : 'bar', data: attendanceChart, xKey: 'key', lines: [{ key: 'value', color: '#F43F5E', name: 'Attendance %' }], bars: [{ key: 'value', color: '#10B981', name: 'Attendance %' }] }, chartTitle: attendanceView === 'daily' ? 'Daily attendance %' : 'Monthly attendance %',
        rows: attendanceRows,
        columns: [
          { key: attendanceView, label: attendanceView === 'daily' ? 'Date' : 'Month', render: (row) => <strong>{attendanceView === 'daily' ? formatDate(row.date) : row.month}</strong> },
          { key: 'total', label: 'Total' }, { key: 'present', label: 'Present' }, { key: 'late', label: 'Late' },
          { key: 'absent', label: 'Absent' }, { key: 'excused', label: 'Excused' },
          { key: 'percentage', label: 'Attendance', render: (row) => <div className="table-progress"><ProgressBar value={row.percentage} compact /><span>{row.percentage}%</span></div> },
        ],
        filename: `edutrack-${attendanceView}-attendance-report.csv`,
        headers: [
          { label: attendanceView === 'daily' ? 'Date' : 'Month', key: attendanceView === 'daily' ? 'date' : 'month' },
          { label: 'Total', key: 'total' }, { label: 'Present', key: 'present' }, { label: 'Late', key: 'late' },
          { label: 'Absent', key: 'absent' }, { label: 'Excused', key: 'excused' }, { label: 'Attendance %', key: 'percentage' },
        ],
      },
      assessments: {
        title: 'Assessment performance report', description: REPORTS[4].description, kpis: [
          { label: 'Assessments', value: assessmentRows.length, icon: ClipboardCheck },
          { label: 'Results', value: results.length, icon: ListChecks, tone: 'info' },
          { label: 'Pass rate', value: `${passRate}%`, icon: CheckCircle2, tone: 'success' },
          { label: 'Avg. score', value: `${average(assessmentRows.map((row) => row.average))}%`, icon: TrendingUp, tone: 'warning' },
        ],
        chart: { type: 'bar', data: assessmentRows.map((row) => ({ ...row, key: row.title.length > 13 ? `${row.title.slice(0, 12)}…` : row.title })), xKey: 'key', bars: [{ key: 'passRate', color: '#10B981', name: 'Pass rate %' }, { key: 'average', color: '#F43F5E', name: 'Average %' }] }, chartTitle: 'Assessment outcomes',
        rows: assessmentRows,
        columns: [
          { key: 'title', label: 'Assessment', render: (row) => <strong>{row.title}</strong> },
          { key: 'batch', label: 'Batch' }, { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
          { key: 'evaluated', label: 'Evaluated' }, { key: 'average', label: 'Avg. score', render: (row) => `${row.average}%` },
          { key: 'passRate', label: 'Pass rate', render: (row) => <div className="table-progress"><ProgressBar value={row.passRate} compact /><span>{row.passRate}%</span></div> },
          { key: 'status', label: 'Status', render: (row) => <Badge tone="auto">{row.status}</Badge> },
        ],
        filename: 'edutrack-assessment-performance.csv',
        headers: [
          { label: 'Assessment', key: 'title' }, { label: 'Batch', key: 'batch' }, { label: 'Date', key: 'date' },
          { label: 'Evaluated', key: 'evaluated' }, { label: 'Average %', key: 'average' }, { label: 'Pass rate %', key: 'passRate' }, { label: 'Status', key: 'status' },
        ],
      },
      tasks: {
        title: 'Task completion report', description: REPORTS[5].description, kpis: [
          { label: 'Tasks', value: allTasks.length, icon: ListChecks },
          { label: 'Completed', value: taskCompleted, icon: CheckCircle2, tone: 'success' },
          { label: 'In progress', value: allTasks.filter((task) => task.status === 'In Progress').length, icon: TrendingUp, tone: 'warning' },
          { label: 'Overdue', value: allTasks.filter((task) => task.status !== 'Completed' && task.due < todayISO()).length, icon: CalendarRange, tone: 'danger' },
        ],
        chart: { type: 'bar', data: taskStatusRows, xKey: 'key', bars: [{ key: 'value', color: '#F43F5E', name: 'Tasks' }] }, chartTitle: 'Tasks by status',
        rows: allTasks,
        columns: [
          { key: 'title', label: 'Task', render: (row) => <strong>{row.title}</strong> },
          { key: 'kind', label: 'Type' }, { key: 'owner', label: 'Owner' },
          { key: 'due', label: 'Due', render: (row) => formatDate(row.due) },
          { key: 'priority', label: 'Priority', render: (row) => <Badge tone="auto">{row.priority}</Badge> },
          { key: 'status', label: 'Status', render: (row) => <Badge tone="auto">{row.status}</Badge> },
        ],
        filename: 'edutrack-task-completion.csv',
        headers: [
          { label: 'Task', key: 'title' }, { label: 'Type', key: 'kind' }, { label: 'Owner', key: 'owner' },
          { label: 'Due', key: 'due' }, { label: 'Priority', key: 'priority' }, { label: 'Status', key: 'status' },
        ],
      },
      syllabus: {
        title: 'Syllabus completion report', description: REPORTS[6].description, kpis: [
          { label: 'Syllabi', value: syllabusRows.length, icon: BookOpenCheck },
          { label: 'Avg. completion', value: `${syllabusAverage}%`, icon: TrendingUp, tone: 'success' },
          { label: 'Modules', value: syllabusRows.reduce((sum, row) => sum + row.modules, 0), icon: BarChart3, tone: 'info' },
          { label: 'Topics remaining', value: syllabusRows.reduce((sum, row) => sum + row.remaining, 0), icon: ListChecks, tone: 'warning' },
        ],
        chart: { type: 'bar', data: syllabusRows.map((row) => ({ ...row, key: row.course.length > 12 ? `${row.course.slice(0, 11)}…` : row.course })), xKey: 'key', bars: [{ key: 'percentage', color: '#6366F1', name: 'Completion %' }] }, chartTitle: 'Curriculum completion',
        rows: syllabusRows,
        columns: [
          { key: 'course', label: 'Course', render: (row) => <strong>{row.course}</strong> },
          { key: 'modules', label: 'Modules' }, { key: 'topics', label: 'Topics' }, { key: 'completed', label: 'Completed' },
          { key: 'remaining', label: 'Remaining' },
          { key: 'percentage', label: 'Completion', render: (row) => <div className="table-progress"><ProgressBar value={row.percentage} compact /><span>{row.percentage}%</span></div> },
          { key: 'batches', label: 'Batches' },
        ],
        filename: 'edutrack-syllabus-completion.csv',
        headers: [
          { label: 'Course', key: 'course' }, { label: 'Modules', key: 'modules' }, { label: 'Topics', key: 'topics' },
          { label: 'Completed', key: 'completed' }, { label: 'Remaining', key: 'remaining' },
          { label: 'Completion %', key: 'percentage' }, { label: 'Period completion %', key: 'periodPercentage' }, { label: 'Batches', key: 'batches' },
        ],
      },
    };
    return { ...configs[reportKey], common: { admissions, attendance, assessments, results, allTasks, attendanceOverall, taskCompleted, syllabusAverage, passRate } };
  }, [state, reportKey, from, to, attendanceView]);

  const pagination = paginate(report.rows, page, Number(state.meta?.preferences?.pageSize || 8));

  const exportReport = () => {
    if (!report.rows.length) { notify('No rows to export for this report and date range.', 'info'); return; }
    downloadFile(report.filename, toCSV(report.headers, report.rows));
    notify(`${report.title} exported as CSV.`, 'success');
  };

  return (
    <div className="reports-page entity-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Reports</span>
          <h2>Reports</h2>
          <p>Explore live institute data, apply date filters and export tabular reports.</p>
        </div>
        <Button variant="primary" icon={Download} onClick={exportReport}>Export CSV</Button>
      </div>

      <Card className="report-filter-card">
        <div className="report-filter-head">
          <div>
            <strong>Report period</strong>
            <span>{from ? formatDate(from) : 'All available records'} → {to ? formatDate(to) : 'Today'}</span>
          </div>
          <div className="preset-buttons">
            {[['30', '30 days'], ['month', 'This month'], ['180', '6 months'], ['all', 'All time']].map(([value, label]) => (
              <button key={value} type="button" className={preset === value ? 'active' : ''} onClick={() => applyPreset(value)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="report-date-fields">
          <label className="date-filter"><span>From</span><input className="form-control" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPreset('custom'); }} /></label>
          <label className="date-filter"><span>To</span><input className="form-control" type="date" value={to} max={todayISO()} onChange={(event) => { setTo(event.target.value); setPreset('custom'); }} /></label>
          <div className="report-range-summary">
            <Badge tone="neutral">{report.common.admissions.length} admissions</Badge>
            <Badge tone="neutral">{report.common.attendance.length} attendance entries</Badge>
            <Badge tone="neutral">{report.common.allTasks.length} tasks</Badge>
          </div>
        </div>
      </Card>

      <Tabs tabs={REPORTS.map(({ value, label, icon }) => ({ value, label, icon }))} value={reportKey} onChange={setReportKey} className="report-tabs" />

      <div className="report-summary-head">
        <div><h2>{report.title}</h2><p>{report.description}</p></div>
        {reportKey === 'attendance' && (
          <Tabs
            tabs={[{ value: 'daily', label: 'Daily', icon: LineChartIcon }, { value: 'monthly', label: 'Monthly', icon: BarChart3 }]}
            value={attendanceView}
            onChange={setAttendanceView}
          />
        )}
      </div>

      <div className="mini-stat-grid four report-kpis">
        {report.kpis.map((kpi) => <MiniStat key={kpi.label} {...kpi} />)}
      </div>

      <div className="report-content-grid">
        <Card className="report-chart-card">
          <CardHeader title={report.chartTitle} subtitle="Generated from saved EduTrack records" action={<Badge tone="neutral">{report.chart.data?.length || 0} points</Badge>} />
          <ReportChart config={report.chart} />
        </Card>
        <Card className="report-insight-card">
          <CardHeader title="Period snapshot" subtitle="Key values behind this report" />
          <div className="report-insight-list">
            <div><span>Students</span><strong>{state.students.length}</strong></div>
            <div><span>Active batches</span><strong>{state.batches.filter((batch) => batch.status === 'Active').length}</strong></div>
            <div><span>Avg. attendance</span><strong>{report.common.attendanceOverall.percentage}%</strong></div>
            <div><span>Assessment results</span><strong>{report.common.results.length}</strong></div>
            <div><span>Task completion</span><strong>{percent(report.common.taskCompleted, report.common.allTasks.length)}%</strong></div>
            <div><span>Syllabus completion</span><strong>{report.common.syllabusAverage}%</strong></div>
          </div>
          <div className="report-export-note"><Download size={15} /><span>The CSV export contains every row in the current filtered report, not only the visible page.</span></div>
        </Card>
      </div>

      <Card padded={false} className="report-table-card">
        <CardHeader title={`${report.title} details`} subtitle={`${report.rows.length} rows in the selected period`} action={<Button variant="secondary" size="sm" icon={Download} onClick={exportReport}>Download CSV</Button>} />
        <DataTable
          columns={report.columns}
          rows={pagination.rows}
          pagination={{ ...pagination, onPage: setPage }}
          emptyTitle="No report data"
          emptyDescription="Try a wider date range or choose a different report."
          caption={report.title}
        />
      </Card>
    </div>
  );
}
