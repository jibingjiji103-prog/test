import React, { useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, GripVertical, LayoutGrid, Pencil, Trash2 } from 'lucide-react';
import EntityPage, { StatusBadge } from '../components/EntityPage';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { DetailGrid, DetailSection, MiniStat } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { addDays, formatDate, isOverdue, todayISO } from '../lib/utils';

const STATUSES = ['To Do', 'In Progress', 'Completed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const CATEGORIES = ['Operations', 'Academics', 'Infrastructure', 'Accounts', 'Reporting', 'Marketing', 'Placements'];

function decorateTask(task) {
  return { ...task, __overdue: isOverdue(task.dueDate, task.status) };
}

export default function Tasks() {
  const { state, commit, notify, canWrite } = useApp();
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [moving, setMoving] = useState(false);
  const userOptions = state.users.filter((user) => user.active !== false).map((user) => [user.id, `${user.name} · ${user.role}`]);

  const fields = [
    { name: 'title', label: 'Task title', required: true, placeholder: 'e.g. Publish course completion certificates' },
    { name: 'assignee', label: 'Assign to', type: 'select', required: true, options: [['', 'Select user'], ...userOptions] },
    { name: 'priority', label: 'Priority', type: 'select', required: true, options: PRIORITIES },
    { name: 'dueDate', label: 'Due date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: STATUSES },
    { name: 'category', label: 'Category', type: 'select', required: true, options: CATEGORIES },
    { name: 'description', label: 'Description', type: 'textarea', span: 2, required: true, placeholder: 'Describe the expected outcome.' },
  ];

  const assigneeName = (value) => state.users.find((user) => user.id === value || user.name === value)?.name || value || '—';

  const columns = [
    {
      key: 'title', label: 'Task', sortable: true,
      render: (task) => <div className="primary-cell"><span className={`cell-icon ${task.status === 'Completed' ? 'success' : ''}`}><ClipboardList size={16} /></span><span><strong>{task.title}</strong><small>{task.category}</small></span></div>,
    },
    { key: 'assignee', label: 'Assignee', sortable: true, render: (task) => assigneeName(task.assignee) },
    { key: 'priority', label: 'Priority', sortable: true, render: (task) => <Badge tone="auto" dot>{task.priority}</Badge> },
    { key: 'dueDate', label: 'Due date', sortable: true, render: (task) => <span className={task.__overdue ? 'overdue-text' : ''}>{formatDate(task.dueDate)}{task.__overdue && <small className="block-note">Overdue</small>}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (task) => <StatusBadge value={task.status} /> },
  ];

  const changeStatus = async (task, status) => {
    if (!canWrite('tasks', { ...task, status }, task)) { notify('You can only change tasks assigned to you.', 'error'); return; }
    setMoving(true);
    try {
      await commit([{ collection: 'tasks', action: 'update', id: task.id, record: { ...task, status, completedAt: status === 'Completed' ? todayISO() : null } }]);
      notify(`“${task.title}” moved to ${status}.`, 'success');
    } catch (error) {
      notify(error.message || 'Could not change task status.', 'error');
    } finally {
      setMoving(false);
    }
  };

  const renderKanban = (view, { records, openEdit, openView, setDeleteTarget, editable, deletable }) => {
    if (view !== 'kanban') return null;
    return (
      <div className="kanban-board">
        {STATUSES.map((status) => {
          const tasks = records.filter((task) => task.status === status);
          return (
            <section
              key={status}
              className={`kanban-column ${draggedTaskId ? 'drop-active' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const task = records.find((item) => item.id === draggedTaskId);
                if (task && task.status !== status) changeStatus(task, status);
                setDraggedTaskId(null);
              }}
            >
              <header className="kanban-column-head">
                <div><span className={`kanban-status-dot ${status.toLowerCase().replace(' ', '-')}`} /><strong>{status}</strong></div>
                <Badge tone="neutral">{tasks.length}</Badge>
              </header>
              <div className="kanban-cards">
                {tasks.length ? tasks.map((task) => (
                  <article
                    key={task.id}
                    className={`kanban-card ${task.__overdue ? 'overdue' : ''} ${moving ? 'moving' : ''}`}
                    draggable={editable(task)}
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onDragEnd={() => setDraggedTaskId(null)}
                  >
                    <div className="kanban-card-top">
                      <Badge tone="auto" dot>{task.priority}</Badge>
                      {editable(task) && <GripVertical size={14} className="drag-handle" />}
                    </div>
                    <button type="button" className="kanban-title" onClick={() => openView(task)}>{task.title}</button>
                    <p>{task.description}</p>
                    <div className="kanban-card-meta">
                      <span><CalendarClock size={13} /> {formatDate(task.dueDate)}</span>
                      <span>{assigneeName(task.assignee)}</span>
                    </div>
                    {task.__overdue && <Badge tone="danger">Overdue</Badge>}
                    <div className="kanban-card-footer">
                      <label className="sr-only" htmlFor={`status-${task.id}`}>Status</label>
                      <select id={`status-${task.id}`} className="mini-select" value={task.status} disabled={!editable(task)} onChange={(event) => changeStatus(task, event.target.value)}>
                        {STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <div className="row-actions">
                        {editable(task) && <button type="button" className="icon-action" aria-label="Edit task" onClick={() => openEdit(task)}><Pencil size={14} /></button>}
                        {deletable(task) && <button type="button" className="icon-action danger" aria-label="Delete task" onClick={() => setDeleteTarget(task)}><Trash2 size={14} /></button>}
                      </div>
                    </div>
                  </article>
                )) : <EmptyState compact icon={LayoutGrid} title="No tasks" description="Drop a card here or change a task’s status." />}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <EntityPage
      title="Tasks"
      description="Track operational work with priorities, owners, deadlines and status."
      collection="tasks"
      columns={columns}
      fields={fields}
      decorateRow={decorateTask}
      searchFields={['title', 'description', 'category', 'assignee']}
      filters={[
        { key: 'status', label: 'Status', options: STATUSES },
        { key: 'priority', label: 'Priority', options: PRIORITIES },
        {
          key: 'assignee', label: 'Assignee', options: userOptions,
          match: (task, value) => task.assignee === value || state.users.some((user) => user.id === value && user.name === task.assignee),
        },
        {
          key: 'dueWindow', label: 'Due', options: [['overdue', 'Overdue'], ['today', 'Today'], ['week', 'Next 7 days'], ['later', 'Later']],
          match: (task, value) => {
            const today = todayISO();
            if (value === 'overdue') return isOverdue(task.dueDate, task.status);
            if (value === 'today') return task.dueDate === today;
            if (value === 'week') return task.dueDate >= today && task.dueDate <= addDays(today, 7);
            return task.dueDate > addDays(today, 7);
          },
        },
      ]}
      alternateViews={[{ value: 'kanban', label: 'Kanban', icon: LayoutGrid }]}
      renderAlternateView={renderKanban}
      initialSort={{ key: 'dueDate', direction: 'asc' }}
      defaultValues={() => ({ status: 'To Do', priority: 'Medium', dueDate: addDays(todayISO(), 3), category: 'Operations' })}
      transformForSave={(values, editing) => ({
        ...values,
        id: editing?.id || `TASK-${Date.now().toString().slice(-6)}`,
        createdAt: editing?.createdAt || todayISO(),
        completedAt: values.status === 'Completed' ? (editing?.completedAt || todayISO()) : null,
      })}
      duplicateCheck={(record, editing, records) => records.some((task) => task.id !== editing?.id && task.title.toLowerCase() === record.title.toLowerCase() && task.dueDate === record.dueDate && task.assignee === record.assignee) ? 'A similar task is already assigned for this date.' : null}
      detailRenderer={(task) => (
        <>
          <div className="detail-hero"><div className="detail-hero-icon"><ClipboardList size={22} /></div><div><strong>{task.category}</strong><p>Due {formatDate(task.dueDate)}</p></div><StatusBadge value={task.status} /></div>
          <div className="mini-stat-grid three">
            <MiniStat label="Priority" value={task.priority} icon={ClipboardList} tone={task.priority === 'Urgent' ? 'danger' : 'neutral'} />
            <MiniStat label="Assignee" value={assigneeName(task.assignee)} icon={CheckCircle2} />
            <MiniStat label="Status" value={task.status} icon={CalendarClock} tone={task.status === 'Completed' ? 'success' : 'info'} />
          </div>
          <DetailSection title="Task information"><DetailGrid items={[
            { label: 'Title', value: task.title }, { label: 'Category', value: task.category },
            { label: 'Assignee', value: assigneeName(task.assignee) }, { label: 'Priority', value: task.priority },
            { label: 'Due date', value: formatDate(task.dueDate) }, { label: 'Status', value: task.status },
            { label: 'Created', value: formatDate(task.createdAt) }, { label: 'Completed', value: task.completedAt ? formatDate(task.completedAt) : '—' },
          ]} /></DetailSection>
          <DetailSection title="Description"><p className="notes-box">{task.description}</p></DetailSection>
          {task.__overdue && <div className="form-alert warning">This task is past its due date and is not marked complete.</div>}
        </>
      )}
      recordLabel={(task) => task.title}
      exportConfig={{
        filename: 'edutrack-tasks.csv',
        headers: [
          { label: 'Task', key: 'title' }, { label: 'Description', key: 'description' },
          { label: 'Assignee', value: (task) => assigneeName(task.assignee) }, { label: 'Priority', key: 'priority' },
          { label: 'Due date', key: 'dueDate' }, { label: 'Status', key: 'status' }, { label: 'Category', key: 'category' },
        ],
      }}
      createLabel="Create Task"
      createTitle="Create a new task"
      editTitle="Edit task"
      emptyTitle="No tasks found"
      emptyDescription="Create a task or adjust the status, priority, assignee and due date filters."
    />
  );
}
