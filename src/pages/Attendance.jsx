import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CalendarDays, CheckCheck, Download, Save, UserRound, Users } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import FilterSelect from '../components/ui/FilterSelect';
import { Card, CardHeader } from '../components/ui/Card';
import { MiniStat } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { attendanceSummary } from '../lib/metrics';
import { addDays, downloadFile, formatDate, paginate, sortBy, toCSV, todayISO } from '../lib/utils';

const STATUSES = ['Present', 'Absent', 'Late', 'Excused'];
const STATUS_TONE = { Present: 'success', Absent: 'danger', Late: 'warning', Excused: 'info' };

export default function Attendance() {
  const { state, commit, notify, user, canWrite } = useApp();
  const [batchId, setBatchId] = useState(() => state.batches.find((batch) => batch.status === 'Active')?.id || state.batches[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [statuses, setStatuses] = useState({});
  const [saving, setSaving] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({ batchId: '', studentId: '', from: addDays(todayISO(), -30), to: todayISO() });
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);

  const students = useMemo(
    () => state.students.filter((student) => student.batchId === batchId && student.status !== 'Dropped'),
    [state.students, batchId],
  );
  const savedRecords = useMemo(
    () => state.attendance.filter((record) => record.batchId === batchId && record.date === date),
    [state.attendance, batchId, date],
  );
  const selectedBatch = state.batches.find((batch) => batch.id === batchId);
  const canEdit = Boolean(batchId) && canWrite('attendance', { batchId, date });

  useEffect(() => {
    const map = Object.fromEntries(savedRecords.map((record) => [record.studentId, record.status]));
    setStatuses(map);
  }, [savedRecords]);

  useEffect(() => {
    if (!batchId && state.batches.length) setBatchId(state.batches[0].id);
  }, [batchId, state.batches.length]);

  const currentRecords = students.map((student) => ({ studentId: student.id, batchId, date, status: statuses[student.id] || '' }));
  const summary = attendanceSummary(currentRecords.filter((record) => record.status));
  const unsavedCount = students.filter((student) => !statuses[student.id]).length;

  const setStudentStatus = (studentId, status) => setStatuses((current) => ({ ...current, [studentId]: status }));
  const markAllPresent = () => {
    if (!canEdit) { notify('You do not have permission to edit attendance for this batch.', 'error'); return; }
    setStatuses(Object.fromEntries(students.map((student) => [student.id, 'Present'])));
    notify(`All ${students.length} students marked present. Save to persist.`, 'info');
  };

  const saveAttendance = async () => {
    if (!canEdit) { notify('You do not have permission to save attendance for this batch.', 'error'); return; }
    if (!students.length) { notify('There are no enrolled students to record.', 'info'); return; }
    if (students.some((student) => !statuses[student.id])) {
      notify(`Mark attendance for every student. ${unsavedCount} still need a status.`, 'error');
      return;
    }
    setSaving(true);
    try {
      const operations = students.map((student) => {
        const existing = savedRecords.find((record) => record.studentId === student.id);
        return {
          collection: 'attendance',
          action: existing ? 'update' : 'create',
          id: existing?.id,
          record: {
            id: existing?.id || `ATT-${date.replaceAll('-', '')}-${student.id}`,
            studentId: student.id,
            batchId,
            date,
            status: statuses[student.id],
            note: existing?.note || '',
            recordedBy: user?.name || 'EduTrack user',
            updatedAt: new Date().toISOString(),
          },
        };
      });
      await commit(operations);
      notify(`Attendance saved for ${students.length} students on ${formatDate(date)}.`, 'success');
    } catch (error) {
      notify(error.message || 'Unable to save attendance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const history = useMemo(() => {
    let records = [...state.attendance];
    const { batchId: historyBatch, studentId, from, to } = historyFilters;
    if (historyBatch) records = records.filter((record) => record.batchId === historyBatch);
    if (studentId) records = records.filter((record) => record.studentId === studentId);
    if (from) records = records.filter((record) => record.date >= from);
    if (to) records = records.filter((record) => record.date <= to);
    return sortBy(records, (record) => `${record.date}-${record.studentId}`, sort.direction);
  }, [state.attendance, historyFilters, sort.direction]);

  const pagination = paginate(history, page, Number(state.meta?.preferences?.pageSize || 8));
  useEffect(() => { setPage(1); }, [historyFilters.batchId, historyFilters.studentId, historyFilters.from, historyFilters.to, sort.direction]);

  const exportHistory = () => {
    if (!history.length) { notify('No attendance rows to export.', 'info'); return; }
    downloadFile('edutrack-attendance-history.csv', toCSV([
      { label: 'Date', key: 'date' },
      { label: 'Student', value: (row) => state.students.find((student) => student.id === row.studentId)?.name || row.studentId },
      { label: 'Batch', value: (row) => state.batches.find((batch) => batch.id === row.batchId)?.name || row.batchId },
      { label: 'Status', key: 'status' }, { label: 'Recorded by', key: 'recordedBy' },
      { label: 'Note', key: 'note' },
    ], history));
    notify('Attendance history exported.', 'success');
  };

  const loadRecord = (record) => {
    setBatchId(record.batchId);
    setDate(record.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify('Loaded that attendance date for editing.', 'info');
  };

  return (
    <div className="entity-page attendance-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Attendance</span>
          <h2>Attendance</h2>
          <p>Record daily attendance, correct saved entries and review historical patterns.</p>
        </div>
        <div className="page-heading-actions">
          <Button variant="secondary" icon={Download} onClick={exportHistory}>Export History</Button>
          <Button variant="primary" icon={Save} onClick={saveAttendance} loading={saving} disabled={!canEdit || !students.length}>Save Attendance</Button>
        </div>
      </div>

      <Card className="attendance-controls">
        <div className="attendance-control-grid">
          <label className="form-field">
            <span className="field-label"><span>Batch</span></span>
            <span className="select-wrap"><select className="form-control" value={batchId} onChange={(event) => setBatchId(event.target.value)}>
              <option value="">Select batch</option>
              {state.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </select></span>
          </label>
          <label className="form-field">
            <span className="field-label"><span>Attendance date</span></span>
            <input className="form-control" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="form-field attendance-control-actions">
            <span className="field-label"><span>Quick actions</span></span>
            <Button variant="secondary" icon={CheckCheck} onClick={markAllPresent} disabled={!canEdit || !students.length}>Mark All Present</Button>
          </div>
        </div>
        <div className="attendance-context">
          <CalendarDays size={15} />
          <span>{selectedBatch ? `${selectedBatch.course} · ${selectedBatch.schedule}` : 'Select a batch'}</span>
          <Badge tone={savedRecords.length ? 'success' : 'warning'}>{savedRecords.length ? `${savedRecords.length} saved entries` : 'New entry'}</Badge>
        </div>
      </Card>

      <div className="mini-stat-grid five attendance-stats">
        <MiniStat label="Total students" value={students.length} icon={Users} />
        <MiniStat label="Present" value={summary.Present} icon={CalendarCheck2} tone="success" />
        <MiniStat label="Absent" value={summary.Absent} icon={Users} tone="danger" />
        <MiniStat label="Late" value={summary.Late} icon={CalendarDays} tone="warning" />
        <MiniStat label="Attendance" value={`${summary.percentage}%`} icon={CalendarCheck2} tone="info" hint="Present + late" />
      </div>

      <Card padded={false} className="attendance-mark-card">
        <CardHeader
          title="Mark attendance"
          subtitle={`${formatDate(date)} · ${students.length} enrolled students`}
          action={!canEdit ? <Badge tone="neutral">Read-only for this batch</Badge> : <Badge tone="neutral">{unsavedCount} unmarked</Badge>}
        />
        {students.length ? (
          <div className="table-scroll">
            <table className="data-table attendance-table">
              <thead><tr><th>Student</th><th>Student ID</th><th>Status</th><th>Current entry</th></tr></thead>
              <tbody>
                {students.map((student) => {
                  const saved = savedRecords.find((record) => record.studentId === student.id);
                  return (
                    <tr key={student.id}>
                      <td data-label="Student"><div className="primary-cell"><span className="cell-icon"><UserRound size={15} /></span><span><strong>{student.name}</strong><small>{student.email}</small></span></div></td>
                      <td data-label="Student ID">{student.studentId}</td>
                      <td data-label="Status">
                        <div className="status-segment" role="group" aria-label={`Attendance status for ${student.name}`}>
                          {STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              className={statuses[student.id] === status ? `selected ${status.toLowerCase()}` : ''}
                              onClick={() => setStudentStatus(student.id, status)}
                              disabled={!canEdit}
                            >{status}</button>
                          ))}
                        </div>
                      </td>
                      <td data-label="Current entry">{saved ? <Badge tone={STATUS_TONE[saved.status]} dot>{saved.status}</Badge> : <span className="muted">Not saved</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No enrolled students" description="Select a batch with active students to record attendance." />}
        <div className="attendance-save-bar">
          <span>{Object.keys(statuses).length} of {students.length} students marked · {savedRecords.length} records already saved for this date</span>
          <Button variant="primary" icon={Save} onClick={saveAttendance} loading={saving} disabled={!canEdit || !students.length}>Save Attendance</Button>
        </div>
      </Card>

      <Card padded={false} className="history-card">
        <CardHeader title="Attendance history" subtitle="Filter by batch, student and date range" action={<Button variant="secondary" size="sm" icon={Download} onClick={exportHistory}>CSV</Button>} />
        <div className="history-filters">
          <FilterSelect label="Batch" value={historyFilters.batchId} onChange={(value) => setHistoryFilters((f) => ({ ...f, batchId: value }))} options={state.batches.map((b) => [b.id, b.name])} />
          <FilterSelect label="Student" value={historyFilters.studentId} onChange={(value) => setHistoryFilters((f) => ({ ...f, studentId: value }))} options={state.students.map((s) => [s.id, s.name])} />
          <label className="date-filter"><span>From</span><input className="form-control" type="date" value={historyFilters.from} onChange={(event) => setHistoryFilters((f) => ({ ...f, from: event.target.value }))} /></label>
          <label className="date-filter"><span>To</span><input className="form-control" type="date" value={historyFilters.to} onChange={(event) => setHistoryFilters((f) => ({ ...f, to: event.target.value }))} /></label>
        </div>
        <DataTable
          columns={[
            { key: 'date', label: 'Date', sortable: true, render: (record) => <strong>{formatDate(record.date)}</strong> },
            { key: 'studentId', label: 'Student', render: (record) => state.students.find((s) => s.id === record.studentId)?.name || record.studentId },
            { key: 'batchId', label: 'Batch', render: (record) => state.batches.find((b) => b.id === record.batchId)?.course || record.batchId },
            { key: 'status', label: 'Status', sortable: true, render: (record) => <Badge tone={STATUS_TONE[record.status]} dot>{record.status}</Badge> },
            { key: 'recordedBy', label: 'Recorded by' },
            {
              key: '_actions', label: '', sortable: false,
              render: (record) => <button type="button" className="text-button compact" onClick={() => loadRecord(record)}>Load date</button>,
            },
          ]}
          rows={pagination.rows}
          sort={sort}
          onSort={(key) => setSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })}
          pagination={{ ...pagination, onPage: setPage }}
          emptyTitle="No attendance records"
          emptyDescription="Adjust the date range or save attendance for a batch."
        />
      </Card>
    </div>
  );
}
