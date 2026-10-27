import React from 'react';
import {
  BookOpenCheck, CalendarClock, CheckSquare, ClipboardCheck, FileCheck2, GraduationCap,
  Layers3, Presentation, UserRound,
} from 'lucide-react';
import EntityPage, { StatusBadge } from '../components/EntityPage';
import Badge from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { addDays, formatDate, isOverdue, todayISO } from '../lib/utils';

const STATUSES = ['To Do', 'In Progress', 'Completed', 'Blocked'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const CATEGORIES = [
  'Syllabus Completion', 'Lesson Preparation', 'Assignment Evaluation',
  'Attendance Submission', 'Project Review',
];

function decorateTrainerTask(task) {
  return { ...task, __overdue: isOverdue(task.deadline, task.status) };
}

export default function TrainerTasks() {
  const { state, commit, notify, canWrite } = useApp();
  const trainerOptions = state.users.filter((user) => user.role === 'Trainer' || user.role === 'Admin').map((user) => [user.id, `${user.name} · ${user.role}`]);
  const batchOptions = state.batches.map((batch) => [batch.id, `${batch.name} · ${batch.course}`]);
  const ownerName = (task) => state.users.find((user) => user.id === task.trainerId || user.name === task.owner)?.name || task.owner || '—';

  const fields = [
    { name: 'title', label: 'Task title', required: true, placeholder: 'e.g. Complete Docker module delivery' },
    { name: 'trainerId', label: 'Owner / trainer', type: 'select', required: true, options: [['', 'Select trainer'], ...trainerOptions] },
    { name: 'category', label: 'Responsibility', type: 'select', required: true, options: CATEGORIES },
    { name: 'batchId', label: 'Batch', type: 'select', required: true, options: [['', 'Select batch'], ...batchOptions] },
    { name: 'course', label: 'Course', required: true, hint: 'Automatically aligned with the batch.' },
    { name: 'deadline', label: 'Deadline', type: 'date', required: true },
    { name: 'priority', label: 'Priority', type: 'select', required: true, options: PRIORITIES },
    { name: 'status', label: 'Status', type: 'select', required: true, options: STATUSES },
    { name: 'progress', label: 'Progress (%)', type: 'number', min: 0, max: 100, required: true, defaultValue: 0 },
    { name: 'notes', label: 'Notes', type: 'textarea', span: 2, placeholder: 'Delivery notes, blockers or follow-up actions.' },
  ];

  const changeStatus = async (task, status) => {
    if (!canWrite('trainerTasks', { ...task, status }, task)) { notify('Only the task owner can change this responsibility.', 'error'); return; }
    try {
      await commit([{
        collection: 'trainerTasks', action: 'update', id: task.id,
        record: { ...task, status, progress: status === 'Completed' ? 100 : task.progress },
      }]);
      notify(`Trainer task moved to ${status}.`, 'success');
    } catch (error) {
      notify(error.message || 'Unable to update this task.', 'error');
    }
  };

  const columns = [
    {
      key: 'title', label: 'Responsibility', sortable: true,
      render: (task) => <div className="primary-cell"><span className="cell-icon"><Presentation size={16} /></span><span><strong>{task.title}</strong><small>{task.category}</small></span></div>,
    },
    { key: 'owner', label: 'Owner', sortable: true, render: (task) => <span className="person-cell"><UserRound size={14} />{ownerName(task)}</span> },
    { key: 'batchId', label: 'Batch / course', render: (task) => <span className="stacked-cell"><span>{state.batches.find((b) => b.id === task.batchId)?.name || task.batchId}</span><small>{task.course}</small></span> },
    { key: 'deadline', label: 'Deadline', sortable: true, render: (task) => <span className={task.__overdue ? 'overdue-text' : ''}>{formatDate(task.deadline)}{task.__overdue && <small className="block-note">Overdue</small>}</span> },
    { key: 'priority', label: 'Priority', sortable: true, render: (task) => <Badge tone="auto" dot>{task.priority}</Badge> },
    {
      key: 'progress', label: 'Progress', sortable: true,
      render: (task) => <div className="table-progress"><ProgressBar value={task.progress || 0} compact /><span>{task.progress || 0}%</span></div>,
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (task) => (
        <div className="inline-status" onClick={(event) => event.stopPropagation()}>
          <StatusBadge value={task.status} />
          <select
            className="mini-select status-select"
            value={task.status}
            aria-label={`Change status for ${task.title}`}
            disabled={!canWrite('trainerTasks', task, task)}
            onChange={(event) => changeStatus(task, event.target.value)}
          >
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      ),
    },
  ];

  const topContent = (
    <div className="trainer-overview">
      <div className="mini-stat-grid four">
        <div className="mini-stat"><span className="mini-stat-label">Total responsibilities</span><strong>{state.trainerTasks.length}</strong><small>Across {new Set(state.trainerTasks.map((task) => task.trainerId || task.owner)).size} trainers</small></div>
        <div className="mini-stat mini-stat-success"><span className="mini-stat-label">Completed</span><strong>{state.trainerTasks.filter((task) => task.status === 'Completed').length}</strong><small>Finished work</small></div>
        <div className="mini-stat mini-stat-warning"><span className="mini-stat-label">In progress</span><strong>{state.trainerTasks.filter((task) => task.status === 'In Progress').length}</strong><small>Active delivery</small></div>
        <div className="mini-stat mini-stat-danger"><span className="mini-stat-label">Overdue</span><strong>{state.trainerTasks.filter((task) => isOverdue(task.deadline, task.status)).length}</strong><small>Needs attention</small></div>
      </div>
      <div className="tracker-category-grid">
        {CATEGORIES.map((category, index) => {
          const items = state.trainerTasks.filter((task) => task.category === category);
          const completed = items.filter((task) => task.status === 'Completed').length;
          const progress = items.length ? Math.round(items.reduce((sum, task) => sum + Number(task.progress || 0), 0) / items.length) : 0;
          const Icon = [BookOpenCheck, CheckSquare, ClipboardCheck, FileCheck2, GraduationCap][index];
          return (
            <article className="tracker-category" key={category}>
              <span className="tracker-icon"><Icon size={17} /></span>
              <strong>{category}</strong>
              <span>{completed} of {items.length} completed</span>
              <ProgressBar value={progress} compact />
            </article>
          );
        })}
      </div>
    </div>
  );

  return (
    <EntityPage
      title="Trainer Tasks"
      description="Coordinate trainer responsibilities, deadlines, courses and delivery progress."
      collection="trainerTasks"
      columns={columns}
      fields={fields}
      decorateRow={decorateTrainerTask}
      topContent={topContent}
      searchFields={['title', 'category', 'owner', 'course', 'notes', 'batchId']}
      filters={[
        {
          key: 'trainerId', label: 'Trainer', options: trainerOptions,
          match: (task, value) => task.trainerId === value || state.users.some((user) => user.id === value && user.name === task.owner),
        },
        { key: 'batchId', label: 'Batch', options: batchOptions },
        { key: 'status', label: 'Status', options: STATUSES },
        {
          key: 'deadlineWindow', label: 'Deadline', options: [['overdue', 'Overdue'], ['today', 'Today'], ['week', 'Next 7 days'], ['later', 'Later']],
          match: (task, value) => {
            const today = todayISO();
            if (value === 'overdue') return isOverdue(task.deadline, task.status);
            if (value === 'today') return task.deadline === today;
            if (value === 'week') return task.deadline >= today && task.deadline <= addDays(today, 7);
            return task.deadline > addDays(today, 7);
          },
        },
      ]}
      initialSort={{ key: 'deadline', direction: 'asc' }}
      defaultValues={() => ({ status: 'To Do', priority: 'Medium', deadline: addDays(todayISO(), 5), progress: 0, category: 'Lesson Preparation' })}
      transformForEdit={(task) => {
        const trainer = state.users.find((user) => user.name === task.owner || user.id === task.trainerId);
        return { ...task, trainerId: task.trainerId || trainer?.id || '' };
      }}
      transformForSave={(values, editing) => {
        const trainer = state.users.find((user) => user.id === values.trainerId);
        const batch = state.batches.find((item) => item.id === values.batchId);
        return {
          ...values,
          id: editing?.id || `TTASK-${Date.now().toString().slice(-6)}`,
          owner: trainer?.name || editing?.owner || 'Unassigned',
          trainerId: values.trainerId,
          course: batch?.course || values.course,
          progress: Math.min(100, Math.max(0, Number(values.progress || 0))),
          createdAt: editing?.createdAt || todayISO(),
        };
      }}
      customValidate={(values) => {
        const errors = {};
        if (Number(values.progress) < 0 || Number(values.progress) > 100) errors.progress = 'Progress must be between 0 and 100.';
        return errors;
      }}
      duplicateCheck={(record, editing, records) => records.some((task) => task.id !== editing?.id && task.title.toLowerCase() === record.title.toLowerCase() && task.batchId === record.batchId) ? 'This responsibility is already assigned to the batch.' : null}
      detailRenderer={(task) => {
        const syllabus = state.syllabi.find((item) => item.course === task.course || (item.batchIds || []).includes(task.batchId));
        return (
          <>
            <div className="detail-hero"><div className="detail-hero-icon"><Presentation size={22} /></div><div><strong>{task.category}</strong><p>{ownerName(task)} · Deadline {formatDate(task.deadline)}</p></div><StatusBadge value={task.status} /></div>
            <ProgressBar value={task.progress || 0} label="Responsibility progress" />
            <div className="detail-grid detail-grid-2 spaced-grid">
              <div className="detail-item"><span>Owner</span><strong>{ownerName(task)}</strong></div>
              <div className="detail-item"><span>Priority</span><strong>{task.priority}</strong></div>
              <div className="detail-item"><span>Batch</span><strong>{state.batches.find((b) => b.id === task.batchId)?.name || task.batchId}</strong></div>
              <div className="detail-item"><span>Course</span><strong>{task.course}</strong></div>
              <div className="detail-item"><span>Deadline</span><strong>{formatDate(task.deadline)}</strong></div>
              <div className="detail-item"><span>Status</span><strong>{task.status}</strong></div>
            </div>
            {syllabus && <div className="linked-row"><span><strong>Linked syllabus</strong><small>{syllabus.course} · {syllabus.modules?.length || 0} modules</small></span><Layers3 size={18} /></div>}
            <div className="notes-box">{task.notes || 'No notes have been added for this responsibility.'}</div>
            {task.__overdue && <div className="form-alert warning">This responsibility is past its deadline and not complete.</div>}
          </>
        );
      }}
      recordLabel={(task) => task.title}
      exportConfig={{
        filename: 'edutrack-trainer-tasks.csv',
        headers: [
          { label: 'Task', key: 'title' }, { label: 'Category', key: 'category' },
          { label: 'Owner', value: (task) => ownerName(task) },
          { label: 'Batch', value: (task) => state.batches.find((b) => b.id === task.batchId)?.name || task.batchId },
          { label: 'Course', key: 'course' }, { label: 'Deadline', key: 'deadline' },
          { label: 'Priority', key: 'priority' }, { label: 'Status', key: 'status' },
          { label: 'Progress', value: (task) => `${task.progress || 0}%` }, { label: 'Notes', key: 'notes' },
        ],
      }}
      createLabel="Assign Task"
      createTitle="Assign trainer responsibility"
      editTitle="Edit trainer task"
      emptyTitle="No trainer tasks found"
      emptyDescription="Assign a trainer responsibility or adjust the filters."
    />
  );
}
