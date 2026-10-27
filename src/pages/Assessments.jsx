import React, { useEffect, useMemo, useState } from 'react';
import { Award, Calculator, ClipboardCheck, Download, PenLine, Save } from 'lucide-react';
import EntityPage, { StatusBadge } from '../components/EntityPage';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Card, CardHeader } from '../components/ui/Card';
import FilterSelect from '../components/ui/FilterSelect';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import { DetailGrid, DetailSection, MiniStat, ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { downloadFile, formatDate, paginate, sortBy, toCSV, uid } from '../lib/utils';

const STATUSES = ['Draft', 'Published', 'Completed', 'Cancelled'];
const TYPES = ['Quiz', 'Written Test', 'Practical', 'Project', 'Case Study', 'Presentation'];

export default function Assessments() {
  const { state, commit, notify, canWrite } = useApp();
  const batchOptions = state.batches.map((batch) => [batch.id, `${batch.name} · ${batch.course}`]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(() => state.assessments[0]?.id || '');
  const [marks, setMarks] = useState({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [resultFilters, setResultFilters] = useState({ batchId: '', assessmentId: '' });
  const [resultPage, setResultPage] = useState(1);

  const selectedAssessment = state.assessments.find((assessment) => assessment.id === selectedAssessmentId) || null;
  const studentsForMarks = useMemo(
    () => selectedAssessment ? state.students.filter((student) => student.batchId === selectedAssessment.batchId && student.status !== 'Dropped') : [],
    [selectedAssessment, state.students],
  );

  useEffect(() => {
    if (!selectedAssessmentId && state.assessments.length) setSelectedAssessmentId(state.assessments[0].id);
    if (selectedAssessmentId && !state.assessments.some((assessment) => assessment.id === selectedAssessmentId)) setSelectedAssessmentId(state.assessments[0]?.id || '');
  }, [selectedAssessmentId, state.assessments]);

  useEffect(() => {
    if (!selectedAssessment) { setMarks({}); return; }
    const existing = state.assessmentResults.filter((result) => result.assessmentId === selectedAssessment.id);
    setMarks(Object.fromEntries(existing.map((result) => [result.studentId, result.marks])));
  }, [selectedAssessment?.id, state.assessmentResults]);

  const fields = [
    { name: 'title', label: 'Assessment title', required: true, placeholder: 'e.g. Kubernetes Deployment Practical' },
    { name: 'batchId', label: 'Batch', type: 'select', required: true, options: [['', 'Select batch'], ...batchOptions] },
    { name: 'type', label: 'Assessment type', type: 'select', required: true, options: TYPES },
    { name: 'date', label: 'Assessment date', type: 'date', required: true },
    { name: 'maxMarks', label: 'Maximum marks', type: 'number', min: 1, required: true, defaultValue: 100 },
    { name: 'passingMarks', label: 'Passing marks', type: 'number', min: 0, required: true, defaultValue: state.meta?.preferences?.defaultPassingMarks || 40 },
    { name: 'status', label: 'Status', type: 'select', required: true, options: STATUSES },
    { name: 'duration', label: 'Duration', placeholder: 'e.g. 90 minutes' },
    { name: 'description', label: 'Description', type: 'textarea', span: 2, placeholder: 'Instructions, topics covered and submission expectations.' },
  ];

  const columns = [
    {
      key: 'title', label: 'Assessment', sortable: true,
      render: (assessment) => <div className="primary-cell"><span className="cell-icon"><ClipboardCheck size={16} /></span><span><strong>{assessment.title}</strong><small>{assessment.type}</small></span></div>,
    },
    { key: 'batchId', label: 'Batch', sortable: true, render: (assessment) => state.batches.find((batch) => batch.id === assessment.batchId)?.course || assessment.batchId },
    { key: 'date', label: 'Date', sortable: true, render: (assessment) => formatDate(assessment.date) },
    { key: 'maxMarks', label: 'Max marks', sortable: true },
    { key: 'passingMarks', label: 'Pass marks', sortable: true },
    {
      key: 'results', label: 'Results',
      render: (assessment) => {
        const results = state.assessmentResults.filter((result) => result.assessmentId === assessment.id);
        const pass = results.filter((result) => result.result === 'Pass').length;
        return <span className="stacked-cell"><span>{results.length} entered</span><small>{pass} passed</small></span>;
      },
    },
    { key: 'status', label: 'Status', sortable: true, render: (assessment) => <StatusBadge value={assessment.status} /> },
  ];

  const filteredResults = useMemo(() => {
    let rows = [...state.assessmentResults];
    if (resultFilters.batchId) rows = rows.filter((row) => row.batchId === resultFilters.batchId);
    if (resultFilters.assessmentId) rows = rows.filter((row) => row.assessmentId === resultFilters.assessmentId);
    return sortBy(rows, (row) => row.percentage || 0, 'desc');
  }, [state.assessmentResults, resultFilters]);

  const saveMarks = async () => {
    if (!selectedAssessment) { notify('Select an assessment first.', 'error'); return; }
    if (!canWrite('assessmentResults', { batchId: selectedAssessment.batchId })) { notify('You cannot enter results for this batch.', 'error'); return; }
    const entries = studentsForMarks
      .map((student) => ({ student, value: marks[student.id] }))
      .filter(({ value }) => value !== '' && value !== undefined && value !== null);
    if (!entries.length) { notify('Enter at least one mark before saving.', 'info'); return; }
    const invalid = entries.find(({ value }) => Number.isNaN(Number(value)) || Number(value) < 0 || Number(value) > Number(selectedAssessment.maxMarks));
    if (invalid) { notify(`Marks must be between 0 and ${selectedAssessment.maxMarks}.`, 'error'); return; }
    setSavingMarks(true);
    try {
      const existingResults = state.assessmentResults.filter((result) => result.assessmentId === selectedAssessment.id);
      const operations = entries.map(({ student, value }) => {
        const score = Number(value);
        const percentage = Math.round((score / Number(selectedAssessment.maxMarks)) * 100);
        const existing = existingResults.find((result) => result.studentId === student.id);
        return {
          collection: 'assessmentResults', action: existing ? 'update' : 'create', id: existing?.id,
          record: {
            id: existing?.id || uid('RES'),
            assessmentId: selectedAssessment.id,
            studentId: student.id,
            batchId: selectedAssessment.batchId,
            marks: score,
            maxMarks: Number(selectedAssessment.maxMarks),
            percentage,
            result: score >= Number(selectedAssessment.passingMarks) ? 'Pass' : 'Fail',
            remarks: existing?.remarks || '',
            updatedAt: new Date().toISOString(),
          },
        };
      });
      const allMarked = studentsForMarks.every((student) => {
        const value = marks[student.id];
        return value !== '' && value !== undefined && value !== null;
      });
      if (allMarked) {
        operations.push({ collection: 'assessments', action: 'update', id: selectedAssessment.id, record: { ...selectedAssessment, status: 'Completed' } });
      }
      await commit(operations);
      notify(`Saved ${entries.length} result${entries.length > 1 ? 's' : ''} for ${selectedAssessment.title}.`, 'success');
    } catch (error) {
      notify(error.message || 'Unable to save marks.', 'error');
    } finally {
      setSavingMarks(false);
    }
  };

  const exportResults = () => {
    if (!filteredResults.length) { notify('No results to export.', 'info'); return; }
    downloadFile('edutrack-assessment-results.csv', toCSV([
      { label: 'Assessment', value: (row) => state.assessments.find((assessment) => assessment.id === row.assessmentId)?.title || row.assessmentId },
      { label: 'Student', value: (row) => state.students.find((student) => student.id === row.studentId)?.name || row.studentId },
      { label: 'Batch', value: (row) => state.batches.find((batch) => batch.id === row.batchId)?.name || row.batchId },
      { label: 'Marks', key: 'marks' }, { label: 'Maximum marks', key: 'maxMarks' },
      { label: 'Percentage', value: (row) => `${row.percentage}%` }, { label: 'Result', key: 'result' },
      { label: 'Updated', value: (row) => formatDate(row.updatedAt) },
    ], filteredResults));
    notify('Assessment results exported.', 'success');
  };

  const renderAlternateView = (view, { setView }) => {
    if (view === 'results') {
      const pagination = paginate(filteredResults, resultPage, Number(state.meta?.preferences?.pageSize || 8));
      const passRate = filteredResults.length ? Math.round((filteredResults.filter((row) => row.result === 'Pass').length / filteredResults.length) * 100) : 0;
      return (
        <Card padded={false} className="alternate-view-card">
          <CardHeader title="Assessment results" subtitle={`${filteredResults.length} evaluated results · ${passRate}% pass rate`} action={<Button variant="secondary" size="sm" icon={Download} onClick={exportResults}>CSV</Button>} />
          <div className="history-filters">
            <FilterSelect label="Batch" value={resultFilters.batchId} onChange={(value) => { setResultFilters((f) => ({ ...f, batchId: value })); setResultPage(1); }} options={batchOptions} />
            <FilterSelect label="Assessment" value={resultFilters.assessmentId} onChange={(value) => { setResultFilters((f) => ({ ...f, assessmentId: value })); setResultPage(1); }} options={state.assessments.map((assessment) => [assessment.id, assessment.title])} />
          </div>
          <DataTable
            columns={[
              { key: 'studentId', label: 'Student', render: (row) => state.students.find((student) => student.id === row.studentId)?.name || row.studentId },
              { key: 'assessmentId', label: 'Assessment', render: (row) => state.assessments.find((assessment) => assessment.id === row.assessmentId)?.title || row.assessmentId },
              { key: 'batchId', label: 'Batch', render: (row) => state.batches.find((batch) => batch.id === row.batchId)?.course || row.batchId },
              { key: 'marks', label: 'Score', render: (row) => <strong>{row.marks} / {row.maxMarks}</strong> },
              { key: 'percentage', label: 'Percentage', sortable: true, render: (row) => <span className="percentage-cell"><ProgressBar value={row.percentage} compact /><span>{row.percentage}%</span></span> },
              { key: 'result', label: 'Result', render: (row) => <Badge tone={row.result === 'Pass' ? 'success' : 'danger'} dot>{row.result}</Badge> },
              { key: '_actions', label: '', sortable: false, render: (row) => <button type="button" className="text-button compact" onClick={() => { setSelectedAssessmentId(row.assessmentId); setView('marks'); notify('Assessment loaded in Enter Marks.', 'info'); }}>Edit marks</button> },
            ]}
            rows={pagination.rows}
            pagination={{ ...pagination, onPage: setResultPage }}
            emptyTitle="No assessment results"
            emptyDescription="Enter student marks to see calculated percentages and pass/fail status."
          />
        </Card>
      );
    }
    if (view === 'marks') {
      const canEnter = selectedAssessment && canWrite('assessmentResults', { batchId: selectedAssessment.batchId });
      const entered = studentsForMarks.filter((student) => marks[student.id] !== '' && marks[student.id] !== undefined && marks[student.id] !== null).length;
      const average = entered ? Math.round(Object.values(marks).filter((value) => value !== '' && value !== undefined && value !== null).reduce((sum, value) => sum + Number(value), 0) / entered / Number(selectedAssessment?.maxMarks || 1) * 100) : 0;
      return (
        <Card padded={false} className="alternate-view-card">
          <CardHeader
            title="Enter student marks"
            subtitle="Scores, percentages and pass/fail are calculated automatically."
            action={<Button variant="primary" icon={Save} onClick={saveMarks} loading={savingMarks} disabled={!canEnter || !studentsForMarks.length}>Save Results</Button>}
          />
          <div className="mark-entry-controls">
            <FilterSelect label="Assessment" value={selectedAssessmentId} onChange={setSelectedAssessmentId} options={state.assessments.map((assessment) => [assessment.id, `${assessment.title} · ${formatDate(assessment.date)}`])} allLabel="Select assessment" />
            {selectedAssessment && <div className="mark-entry-summary">
              <Badge tone="neutral">Max {selectedAssessment.maxMarks}</Badge><Badge tone="neutral">Pass {selectedAssessment.passingMarks}</Badge><Badge tone="info">Average {average}%</Badge><Badge tone="auto">{selectedAssessment.status}</Badge>
            </div>}
          </div>
          {selectedAssessment ? (
            <>
              <div className="table-scroll">
                <table className="data-table marks-table">
                  <thead><tr><th>Student</th><th>Marks</th><th>Percentage</th><th>Status</th><th>Current result</th></tr></thead>
                  <tbody>
                    {studentsForMarks.map((student) => {
                      const value = marks[student.id];
                      const hasValue = value !== '' && value !== undefined && value !== null && !Number.isNaN(Number(value));
                      const percentage = hasValue ? Math.round((Number(value) / Number(selectedAssessment.maxMarks)) * 100) : 0;
                      const status = hasValue ? (Number(value) >= Number(selectedAssessment.passingMarks) ? 'Pass' : 'Fail') : '—';
                      const existing = state.assessmentResults.find((result) => result.assessmentId === selectedAssessment.id && result.studentId === student.id);
                      return (
                        <tr key={student.id}>
                          <td data-label="Student"><strong>{student.name}</strong><small>{student.studentId}</small></td>
                          <td data-label="Marks"><input className="form-control marks-input" type="number" min="0" max={selectedAssessment.maxMarks} value={value ?? ''} onChange={(event) => setMarks((current) => ({ ...current, [student.id]: event.target.value }))} disabled={!canEnter} placeholder="—" /></td>
                          <td data-label="Percentage">{hasValue ? `${percentage}%` : '—'}</td>
                          <td data-label="Status">{hasValue ? <Badge tone={status === 'Pass' ? 'success' : 'danger'}>{status}</Badge> : <span className="muted">Not entered</span>}</td>
                          <td data-label="Current result">{existing ? <Badge tone={existing.result === 'Pass' ? 'success' : 'danger'} dot>{existing.result}</Badge> : <span className="muted">New</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!studentsForMarks.length && <EmptyState title="No students in this batch" description="Enroll students before entering marks." compact />}
              <div className="attendance-save-bar">
                <span>{entered} of {studentsForMarks.length} marks entered · Passing score {selectedAssessment.passingMarks} of {selectedAssessment.maxMarks}</span>
                <Button variant="primary" icon={Save} onClick={saveMarks} loading={savingMarks} disabled={!canEnter || !studentsForMarks.length}>Save Results</Button>
              </div>
            </>
          ) : <EmptyState title="No assessment selected" description="Create an assessment first, then enter marks here." />}
        </Card>
      );
    }
    return null;
  };

  return (
    <EntityPage
      title="Assessments"
      description="Create evaluations, enter marks and review calculated student results."
      collection="assessments"
      columns={columns}
      fields={fields}
      searchFields={['title', 'description', 'type', 'batchId']}
      filters={[
        { key: 'batchId', label: 'Batch', options: batchOptions },
        { key: 'status', label: 'Status', options: STATUSES },
        { key: 'type', label: 'Type', options: TYPES },
      ]}
      alternateViews={[
        { value: 'marks', label: 'Enter Marks', icon: PenLine },
        { value: 'results', label: 'Results', icon: Award },
      ]}
      renderAlternateView={renderAlternateView}
      initialSort={{ key: 'date', direction: 'desc' }}
      defaultValues={() => ({ date: new Date().toISOString().slice(0, 10), maxMarks: 100, passingMarks: state.meta?.preferences?.defaultPassingMarks || 40, status: 'Draft', type: 'Quiz' })}
      transformForSave={(values, editing) => ({
        ...values,
        id: editing?.id || uid('ASM'),
        maxMarks: Number(values.maxMarks),
        passingMarks: Number(values.passingMarks),
      })}
      customValidate={(values) => {
        const errors = {};
        if (Number(values.maxMarks) < 1) errors.maxMarks = 'Maximum marks must be at least 1.';
        if (Number(values.passingMarks) < 0 || Number(values.passingMarks) > Number(values.maxMarks)) errors.passingMarks = 'Passing marks must be between 0 and maximum marks.';
        return errors;
      }}
      duplicateCheck={(record, editing, records) => records.some((assessment) => assessment.id !== editing?.id && assessment.title.toLowerCase() === record.title.toLowerCase() && assessment.batchId === record.batchId && assessment.date === record.date) ? 'An assessment with this title, batch and date already exists.' : null}
      onBeforeDelete={(assessment) => state.assessmentResults.filter((result) => result.assessmentId === assessment.id).map((result) => ({ collection: 'assessmentResults', action: 'delete', id: result.id }))}
      detailRenderer={(assessment) => {
        const results = state.assessmentResults.filter((result) => result.assessmentId === assessment.id);
        const pass = results.filter((result) => result.result === 'Pass').length;
        const average = results.length ? Math.round(results.reduce((sum, result) => sum + result.percentage, 0) / results.length) : 0;
        return (
          <>
            <div className="detail-hero"><div className="detail-hero-icon"><ClipboardCheck size={22} /></div><div><strong>{assessment.type}</strong><p>{formatDate(assessment.date)} · {state.batches.find((b) => b.id === assessment.batchId)?.name || assessment.batchId}</p></div><StatusBadge value={assessment.status} /></div>
            <div className="mini-stat-grid four">
              <MiniStat label="Results" value={results.length} icon={ClipboardCheck} />
              <MiniStat label="Passed" value={pass} icon={Award} tone="success" />
              <MiniStat label="Average" value={`${average}%`} icon={Calculator} tone="info" />
              <MiniStat label="Pass score" value={assessment.passingMarks} hint={`of ${assessment.maxMarks}`} icon={PenLine} />
            </div>
            <DetailSection title="Assessment information"><DetailGrid items={[
              { label: 'Title', value: assessment.title }, { label: 'Type', value: assessment.type },
              { label: 'Batch', value: state.batches.find((b) => b.id === assessment.batchId)?.name || assessment.batchId },
              { label: 'Date', value: formatDate(assessment.date) }, { label: 'Maximum marks', value: assessment.maxMarks },
              { label: 'Passing marks', value: assessment.passingMarks }, { label: 'Duration', value: assessment.duration || '—' },
              { label: 'Status', value: assessment.status },
            ]} /></DetailSection>
            {assessment.description && <DetailSection title="Description"><p className="notes-box">{assessment.description}</p></DetailSection>}
            <DetailSection title={`Results (${results.length})`}>
              {results.length ? <><ProgressBar value={average} label="Average score" /><div className="compact-list scroll-list">{results.map((result) => (
                <div className="compact-list-row" key={result.id}>
                  <span className="result-score"><strong>{result.marks}</strong><small>/{result.maxMarks}</small></span>
                  <div><strong>{state.students.find((s) => s.id === result.studentId)?.name || result.studentId}</strong><span>{result.percentage}% · updated {formatDate(result.updatedAt)}</span></div>
                  <Badge tone={result.result === 'Pass' ? 'success' : 'danger'}>{result.result}</Badge>
                </div>
              ))}</div></> : <p className="muted">No marks have been entered for this assessment.</p>}
            </DetailSection>
          </>
        );
      }}
      recordLabel={(assessment) => assessment.title}
      deleteMessage={(assessment) => `Delete “${assessment.title}”? All result records for this assessment will also be removed.`}
      exportConfig={{
        filename: 'edutrack-assessments.csv',
        headers: [
          { label: 'Assessment', key: 'title' }, { label: 'Batch', value: (row) => state.batches.find((b) => b.id === row.batchId)?.name || row.batchId },
          { label: 'Type', key: 'type' }, { label: 'Date', key: 'date' }, { label: 'Max marks', key: 'maxMarks' },
          { label: 'Passing marks', key: 'passingMarks' }, { label: 'Status', key: 'status' }, { label: 'Description', key: 'description' },
        ],
      }}
      headerActions={<Button variant="secondary" icon={Download} onClick={exportResults}>Export Results</Button>}
      createLabel="Create Assessment"
      createTitle="Create assessment"
      editTitle="Edit assessment"
      emptyTitle="No assessments yet"
      emptyDescription="Create a quiz, project or practical to start recording results."
    />
  );
}
