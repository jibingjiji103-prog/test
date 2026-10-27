import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock, Award, BookOpenCheck, CalendarCheck, ChevronRight, ClipboardList, GripVertical,
  GraduationCap, Layers3, ListTodo, Plus, Settings2, Sparkles, UserPlus, Users, UsersRound, Wallet, X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Avatar, ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import {
  admissionsByMonth, attendanceSummary, batchDistribution, getDashboardMetrics, getMetricMap,
  pendingTasks, todayAttendanceRecords, upcomingAssessments,
} from '../lib/metrics';
import { formatDate, isOverdue, sortBy } from '../lib/utils';

const METRIC_ICONS = {
  UserPlus, Layers3, Users, CalendarCheck, ClipboardList, ListTodo, UsersRound,
  BookOpenCheck, Award, AlarmClock, GraduationCap, Wallet,
};

export default function Dashboard() {
  const { state, user, savePreferences, notify, isReadOnly } = useApp();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState(null);

  const allMetrics = useMemo(() => getDashboardMetrics(state), [state]);
  const metricMap = useMemo(() => getMetricMap(state), [state]);
  const preferences = state.meta?.dashboard || { cards: [], order: [] };
  const cardIds = preferences.cards || [];
  const orderedIds = (preferences.order || []).filter((id) => cardIds.includes(id));
  cardIds.filter((id) => !orderedIds.includes(id)).forEach((id) => orderedIds.push(id));
  const visibleMetrics = orderedIds.map((id) => metricMap[id]).filter(Boolean);
  const availableMetrics = allMetrics.filter((metric) => !cardIds.includes(metric.id));
  const todaySummary = attendanceSummary(todayAttendanceRecords(state));
  const assessments = sortBy(upcomingAssessments(state), 'date').slice(0, 5);
  const tasks = sortBy(pendingTasks(state), (task) => task.dueDate || task.deadline).slice(0, 5);
  const recentAdmissions = sortBy(state.students, 'admissionDate', 'desc').slice(0, 5);
  const distribution = batchDistribution(state).map((item) => ({ ...item, short: item.course.length > 14 ? `${item.course.slice(0, 13)}…` : item.course }));
  const trend = admissionsByMonth(state, 6);

  const persistDashboard = async (cards, order, message) => {
    setSaving(true);
    try {
      await savePreferences({ dashboard: { cards, order } });
      notify(message, 'success');
    } catch (error) {
      notify(error.message || 'Could not save dashboard preferences.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setSelectedMetrics([]);
    setAddOpen(true);
  };

  const addSelectedCards = async () => {
    if (!selectedMetrics.length) {
      notify('Select at least one metric to add.', 'info');
      return;
    }
    const cards = [...cardIds, ...selectedMetrics];
    await persistDashboard(cards, [...orderedIds, ...selectedMetrics], `${selectedMetrics.length} card${selectedMetrics.length > 1 ? 's' : ''} added.`);
    setAddOpen(false);
    setSelectedMetrics([]);
  };

  const removeCard = async (id) => {
    const cards = cardIds.filter((cardId) => cardId !== id);
    await persistDashboard(cards, orderedIds.filter((cardId) => cardId !== id), 'Card removed from dashboard.');
  };

  const dropCard = async (targetId) => {
    if (!draggedId || draggedId === targetId) return;
    const order = [...orderedIds];
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, draggedId);
    setDraggedId(null);
    await persistDashboard(cardIds, order, 'Dashboard layout saved.');
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="dashboard-page">
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow">Institute overview</span>
          <h2>Welcome back, {firstName}</h2>
          <p>Here’s a clean snapshot of admissions, learning activity and work that needs attention.</p>
        </div>
        <Button variant="secondary" icon={Settings2} onClick={openAddModal}>Customize</Button>
      </div>

      <div className="metric-grid" aria-label="Dashboard metrics">
        {visibleMetrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.icon] || Sparkles;
          return (
            <article
              key={metric.id}
              className={`metric-card ${draggedId === metric.id ? 'dragging' : ''}`}
              draggable={!isReadOnly}
              onDragStart={() => setDraggedId(metric.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropCard(metric.id)}
            >
              <div className="metric-card-top">
                <span className="metric-icon"><Icon size={17} /></span>
                <div className="metric-card-tools">
                  <button type="button" className="card-remove" title="Remove card" aria-label={`Remove ${metric.label}`} onClick={() => removeCard(metric.id)}><X size={14} /></button>
                  {!isReadOnly && <GripVertical size={15} className="drag-handle" aria-label="Drag to reorder" />}
                </div>
              </div>
              <h3>{metric.label}</h3>
              <strong className="metric-value">{metric.value}</strong>
              <p>{metric.description}</p>
              <span className="metric-trend">{metric.trend}</span>
            </article>
          );
        })}
        <button type="button" className="add-card-tile" onClick={openAddModal}>
          <span className="add-card-icon"><Plus size={22} /></span>
          <strong>Add Card</strong>
          <small>Choose a metric</small>
        </button>
      </div>

      <div className="dashboard-widgets">
        <Card className="widget recent-widget">
          <CardHeader
            title="Recent admissions"
            subtitle="Latest students added to EduTrack"
            action={<Button variant="ghost" size="sm" onClick={() => navigate('/students')} iconRight={ChevronRight}>View all</Button>}
          />
          {recentAdmissions.length ? (
            <div className="activity-list">
              {recentAdmissions.map((student) => (
                <div className="activity-row" key={student.id}>
                  <Avatar name={student.name} />
                  <div className="activity-copy">
                    <strong>{student.name}</strong>
                    <span>{student.course} · {student.batchId}</span>
                  </div>
                  <div className="activity-meta">
                    <Badge tone="auto" dot>{student.status}</Badge>
                    <small>{formatDate(student.admissionDate)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No admissions yet" description="New students will appear here." compact />}
        </Card>

        <Card className="widget attendance-widget">
          <CardHeader title="Today’s attendance" subtitle={formatDate(new Date(), { day: '2-digit', month: 'long', year: 'numeric' })} />
          <div className="attendance-summary">
            <div className="donut" style={{ '--value': `${todaySummary.percentage * 3.6}deg` }} role="img" aria-label={`${todaySummary.percentage}% attendance`}>
              <div><strong>{todaySummary.percentage}%</strong><span>present</span></div>
            </div>
            <div className="attendance-legend">
              <div><span className="legend-dot present" /><span>Present</span><strong>{todaySummary.Present}</strong></div>
              <div><span className="legend-dot late" /><span>Late</span><strong>{todaySummary.Late}</strong></div>
              <div><span className="legend-dot absent" /><span>Absent</span><strong>{todaySummary.Absent}</strong></div>
              <div><span className="legend-dot excused" /><span>Excused</span><strong>{todaySummary.Excused}</strong></div>
            </div>
          </div>
          <div className="widget-footnote">{todaySummary.attended} of {todaySummary.total} marked students attended today</div>
        </Card>

        <Card className="widget assessments-widget">
          <CardHeader title="Upcoming assessments" subtitle="Next scheduled evaluations" action={<Badge tone="neutral">{assessments.length}</Badge>} />
          {assessments.length ? (
            <div className="compact-list">
              {assessments.map((assessment) => (
                <div className="compact-list-row" key={assessment.id}>
                  <span className="date-block"><strong>{formatDate(assessment.date, { day: '2-digit' })}</strong><small>{formatDate(assessment.date, { month: 'short' })}</small></span>
                  <div><strong>{assessment.title}</strong><span>{assessment.type} · {state.batches.find((b) => b.id === assessment.batchId)?.course || 'Course'}</span></div>
                  <Badge tone="auto">{assessment.status}</Badge>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No upcoming assessments" description="Scheduled assessments will appear here." compact />}
        </Card>

        <Card className="widget tasks-widget">
          <CardHeader title="Pending tasks" subtitle="Operational and trainer work" action={<Badge tone="neutral">{tasks.length}</Badge>} />
          {tasks.length ? (
            <div className="compact-list">
              {tasks.map((task) => {
                const due = task.dueDate || task.deadline;
                return (
                  <div className="compact-list-row" key={task.id}>
                    <span className="task-priority-dot" data-priority={task.priority} />
                    <div><strong>{task.title}</strong><span>{task.assignee || task.owner} · Due {formatDate(due)}</span></div>
                    {isOverdue(due, task.status) ? <Badge tone="danger" dot>Overdue</Badge> : <Badge tone="auto">{task.status}</Badge>}
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="All caught up" description="No pending tasks right now." compact />}
        </Card>

        <Card className="widget chart-widget wide-widget">
          <CardHeader title="Batch-wise student distribution" subtitle="Enrollment counts from current batch records" />
          <div className="dashboard-chart-grid">
            <div className="chart-box">
              <span className="chart-label">Students by course</span>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={distribution} margin={{ top: 8, right: 8, left: -22, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="short" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  <Bar dataKey="count" name="Students" fill="#F43F5E" radius={[7, 7, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-box">
              <span className="chart-label">Admissions · last 6 months</span>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={trend} margin={{ top: 8, right: 10, left: -22, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  <Line type="monotone" dataKey="admissions" name="Admissions" stroke="#171717" strokeWidth={2.4} dot={{ r: 3, fill: '#F43F5E', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add dashboard cards"
        subtitle="Choose metrics to display in your workspace."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addSelectedCards} loading={saving} disabled={!availableMetrics.length}>Add Selected</Button>
          </>
        )}
      >
        {availableMetrics.length ? (
          <div className="metric-picker">
            {availableMetrics.map((metric) => {
              const Icon = METRIC_ICONS[metric.icon] || Sparkles;
              const checked = selectedMetrics.includes(metric.id);
              return (
                <label key={metric.id} className={`metric-picker-item ${checked ? 'selected' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => setSelectedMetrics((items) => checked ? items.filter((id) => id !== metric.id) : [...items, metric.id])} />
                  <span className="metric-picker-icon"><Icon size={17} /></span>
                  <span><strong>{metric.label}</strong><small>{metric.description}</small></span>
                  <em>{metric.value}</em>
                </label>
              );
            })}
          </div>
        ) : <EmptyState title="All metrics are on your dashboard" description="Remove a card to make room for a different metric." compact />}
      </Modal>
    </div>
  );
}
