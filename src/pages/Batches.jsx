import React from 'react';
import { CalendarDays, Clock3, GraduationCap, UserRound, Users } from 'lucide-react';
import EntityPage, { StatusBadge } from '../components/EntityPage';
import Badge from '../components/ui/Badge';
import { Avatar, DetailGrid, DetailSection, MiniStat, ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { attendanceSummary, syllabusCompletion } from '../lib/metrics';
import { formatDate, toCSV, downloadFile, todayISO } from '../lib/utils';

const STATUSES = ['Upcoming', 'Active', 'Completed', 'On Hold'];

export default function Batches() {
  const { state, notify } = useApp();
  const trainerOptions = state.users.filter((user) => user.active !== false).map((user) => [user.id, `${user.name} · ${user.role}`]);
  const courseOptions = [...new Set([...state.batches.map((batch) => batch.course), ...state.syllabi.map((syllabus) => syllabus.course)])].filter(Boolean).sort();

  const fields = [
    { name: 'batchId', label: 'Batch ID', required: true, placeholder: 'BATCH-2026-04', hint: 'Used as the permanent record ID.' },
    { name: 'name', label: 'Batch name', required: true, placeholder: 'DevOps Immersive — Cohort 13' },
    { name: 'course', label: 'Course name', required: true, placeholder: 'DevOps' },
    { name: 'trainerId', label: 'Assigned trainer', type: 'select', required: true, options: [['', 'Select trainer'], ...trainerOptions] },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date', required: true },
    { name: 'schedule', label: 'Schedule', required: true, placeholder: 'Mon–Fri · 09:00–11:00 IST' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: STATUSES },
    { name: 'room', label: 'Room / location', placeholder: 'Lab 1 or Online' },
    { name: 'capacity', label: 'Capacity', type: 'number', min: 1, required: true, defaultValue: 20 },
    { name: 'notes', label: 'Internal notes', type: 'textarea', span: 2, placeholder: 'Optional handover notes for this batch.' },
  ];

  const columns = [
    {
      key: 'name', label: 'Batch', sortable: true,
      render: (batch) => (
        <div className="primary-cell">
          <span className="cell-icon"><GraduationCap size={16} /></span>
          <span><strong>{batch.name}</strong><small>{batch.batchId}</small></span>
        </div>
      ),
    },
    { key: 'course', label: 'Course', sortable: true },
    {
      key: 'trainer', label: 'Trainer', sortable: true,
      render: (batch) => <span className="person-cell"><UserRound size={14} />{batch.trainer}</span>,
    },
    {
      key: 'schedule', label: 'Schedule',
      render: (batch) => <span className="muted-cell">{batch.schedule}</span>,
    },
    {
      key: 'studentCount', label: 'Students', sortable: true,
      render: (batch) => <strong>{state.students.filter((student) => student.batchId === batch.id).length}</strong>,
    },
    {
      key: 'startDate', label: 'Timeline', sortable: true,
      render: (batch) => <span className="stacked-cell"><span>{formatDate(batch.startDate)}</span><small>to {formatDate(batch.endDate)}</small></span>,
    },
    { key: 'status', label: 'Status', sortable: true, render: (batch) => <StatusBadge value={batch.status} /> },
  ];

  const detailRenderer = (batch) => {
    const students = state.students.filter((student) => student.batchId === batch.id);
    const records = state.attendance.filter((record) => record.batchId === batch.id);
    const summary = attendanceSummary(records);
    const syllabus = state.syllabi.find((item) => (item.batchIds || []).includes(batch.id));
    const completion = syllabus ? syllabusCompletion(syllabus).percentage : 0;
    const trainer = state.users.find((user) => user.id === batch.trainerId);
    return (
      <>
        <div className="detail-hero">
          <div className="detail-hero-icon"><GraduationCap size={23} /></div>
          <div><strong>{batch.course}</strong><p>{batch.batchId} · {batch.room || 'Location not set'}</p></div>
          <StatusBadge value={batch.status} />
        </div>
        <div className="mini-stat-grid four">
          <MiniStat label="Students" value={students.length} hint={`Capacity ${batch.capacity || '—'}`} icon={Users} />
          <MiniStat label="Attendance" value={`${summary.percentage}%`} hint={`${summary.total} records`} icon={CalendarDays} tone="success" />
          <MiniStat label="Syllabus" value={`${completion}%`} hint={syllabus?.course || 'Not assigned'} icon={GraduationCap} tone="info" />
          <MiniStat label="Duration" value={Math.max(0, Math.ceil((new Date(batch.endDate) - new Date(batch.startDate)) / 86400000 / 7))} hint="weeks" icon={Clock3} />
        </div>
        <DetailSection title="Batch information">
          <DetailGrid items={[
            { label: 'Batch ID', value: batch.batchId },
            { label: 'Course', value: batch.course },
            { label: 'Assigned trainer', value: trainer?.name || batch.trainer },
            { label: 'Trainer email', value: trainer?.email || '—' },
            { label: 'Start date', value: formatDate(batch.startDate) },
            { label: 'End date', value: formatDate(batch.endDate) },
            { label: 'Schedule', value: batch.schedule },
            { label: 'Room / location', value: batch.room || '—' },
          ]} />
        </DetailSection>
        <DetailSection title="Attendance summary">
          <ProgressBar value={summary.percentage} label="Overall attendance" />
          <div className="summary-pills">
            <Badge tone="success">Present {summary.Present}</Badge><Badge tone="warning">Late {summary.Late}</Badge>
            <Badge tone="danger">Absent {summary.Absent}</Badge><Badge tone="neutral">Excused {summary.Excused}</Badge>
          </div>
        </DetailSection>
        <DetailSection title="Syllabus">
          {syllabus ? (
            <>
              <div className="linked-row"><span><strong>{syllabus.course}</strong><small>{syllabus.modules?.length || 0} modules</small></span><strong>{completion}%</strong></div>
              <ProgressBar value={completion} compact />
            </>
          ) : <p className="muted">No syllabus is assigned to this batch yet.</p>}
        </DetailSection>
        <DetailSection title={`Enrolled students (${students.length})`}>
          {students.length ? <div className="member-list">{students.map((student) => (
            <div className="member-row" key={student.id}><Avatar name={student.name} size="sm" /><span><strong>{student.name}</strong><small>{student.email}</small></span><Badge tone="auto">{student.status}</Badge></div>
          ))}</div> : <p className="muted">No students are enrolled in this batch.</p>}
        </DetailSection>
        {batch.notes && <DetailSection title="Notes"><p className="notes-box">{batch.notes}</p></DetailSection>}
      </>
    );
  };

  return (
    <EntityPage
      title="Batches"
      description="Manage cohorts, course assignments, trainers and schedules."
      collection="batches"
      columns={columns}
      fields={fields}
      searchFields={['name', 'batchId', 'course', 'trainer', 'schedule', 'room']}
      filters={[
        { key: 'status', label: 'Status', options: STATUSES },
        { key: 'course', label: 'Course', options: courseOptions },
        { key: 'trainerId', label: 'Trainer', options: trainerOptions },
        {
          key: 'timeline', label: 'Timeline', options: [['current', 'Current'], ['future', 'Upcoming'], ['past', 'Completed']],
          match: (batch, value) => {
            const today = todayISO();
            if (value === 'current') return batch.startDate <= today && batch.endDate >= today;
            if (value === 'future') return batch.startDate > today;
            return batch.endDate < today;
          },
        },
      ]}
      initialSort={{ key: 'startDate', direction: 'desc' }}
      defaultValues={() => ({ batchId: `BATCH-${new Date().getFullYear()}-${String(state.batches.length + 1).padStart(2, '0')}`, status: 'Upcoming', capacity: 20, schedule: 'Mon–Fri · 09:00–11:00 IST' })}
      transformForSave={(values, editing) => {
        const trainer = state.users.find((user) => user.id === values.trainerId);
        const batchId = editing?.batchId || values.batchId.trim().toUpperCase();
        return {
          ...values,
          id: editing?.id || batchId,
          batchId,
          trainer: trainer?.name || editing?.trainer || 'Unassigned',
          capacity: Number(values.capacity),
          studentCount: state.students.filter((student) => student.batchId === (editing?.id || batchId)).length,
        };
      }}
      customValidate={(values) => {
        const errors = {};
        if (values.startDate && values.endDate && values.endDate < values.startDate) errors.endDate = 'End date must be after the start date.';
        if (Number(values.capacity) < 1) errors.capacity = 'Capacity must be at least 1.';
        if (!values.trainerId) errors.trainerId = 'Select an assigned trainer.';
        return errors;
      }}
      duplicateCheck={(record, editing, records) => records.some((batch) => batch.batchId === record.batchId && batch.id !== editing?.id) ? 'A batch with this ID already exists.' : null}
      onBeforeDelete={(batch, currentState) => {
        const ids = {
          students: currentState.students.filter((student) => student.batchId === batch.id).map((student) => student.id),
          attendance: currentState.attendance.filter((record) => record.batchId === batch.id).map((record) => record.id),
          assessments: currentState.assessments.filter((assessment) => assessment.batchId === batch.id).map((assessment) => assessment.id),
          groups: currentState.groups.filter((group) => group.batchId === batch.id).map((group) => group.id),
          trainerTasks: currentState.trainerTasks.filter((task) => task.batchId === batch.id).map((task) => task.id),
        };
        const operations = Object.entries(ids).flatMap(([collection, recordIds]) => recordIds.map((id) => ({ collection, action: 'delete', id })));
        const assessmentIds = new Set(ids.assessments);
        currentState.assessmentResults.filter((result) => assessmentIds.has(result.assessmentId) || result.batchId === batch.id).forEach((result) => operations.push({ collection: 'assessmentResults', action: 'delete', id: result.id }));
        currentState.syllabi.filter((syllabus) => (syllabus.batchIds || []).includes(batch.id)).forEach((syllabus) => operations.push({ collection: 'syllabi', action: 'update', id: syllabus.id, record: { ...syllabus, batchIds: syllabus.batchIds.filter((id) => id !== batch.id) } }));
        return operations;
      }}
      detailRenderer={detailRenderer}
      recordLabel={(batch) => batch.name}
      deleteMessage={(batch) => `Delete “${batch.name}”? Students, attendance, assessments, groups and linked tasks for this batch will also be removed.`}
      exportConfig={{
        filename: 'edutrack-batches.csv',
        searchPlaceholder: 'Search batches, courses, trainers…',
        headers: [
          { label: 'Batch ID', key: 'batchId' }, { label: 'Batch name', key: 'name' },
          { label: 'Course', key: 'course' }, { label: 'Trainer', key: 'trainer' },
          { label: 'Start date', key: 'startDate' }, { label: 'End date', key: 'endDate' },
          { label: 'Schedule', key: 'schedule' }, { label: 'Students', value: (batch) => state.students.filter((student) => student.batchId === batch.id).length },
          { label: 'Status', key: 'status' },
        ],
      }}
      headerActions={(
        <button type="button" className="text-button" onClick={() => {
          const headers = [
            { label: 'Batch ID', key: 'batchId' }, { label: 'Course', key: 'course' },
            { label: 'Trainer', key: 'trainer' }, { label: 'Status', key: 'status' },
          ];
          downloadFile('edutrack-batch-summary.csv', toCSV(headers, state.batches));
          notify('Batch summary downloaded.', 'success');
        }}>Download summary</button>
      )}
      createLabel="Add Batch"
      createTitle="Create a new batch"
      editTitle="Edit batch details"
      emptyTitle="No batches found"
      emptyDescription="Create a batch to start organizing students, attendance and curriculum."
    />
  );
}
