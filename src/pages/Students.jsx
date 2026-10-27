import React from 'react';
import { BookOpen, CalendarCheck, ClipboardCheck, Mail, Phone, UserRound } from 'lucide-react';
import EntityPage, { StatusBadge } from '../components/EntityPage';
import Badge from '../components/ui/Badge';
import { Avatar, DetailGrid, DetailSection, MiniStat, ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { attendanceSummary, studentAttendancePercentage } from '../lib/metrics';
import { formatDate, sortBy, todayISO, unique } from '../lib/utils';

const ENROLLMENT_STATUSES = ['Active', 'Completed', 'Dropped', 'On Hold'];
const PAYMENT_STATUSES = ['Paid', 'Partial', 'Pending', 'Refunded'];

export default function Students() {
  const { state, commit, isAdmin, notify } = useApp();
  const batchOptions = state.batches.map((batch) => [batch.id, `${batch.name} · ${batch.course}`]);
  const courseOptions = unique([...state.batches.map((batch) => batch.course), ...state.syllabi.map((syllabus) => syllabus.course)]).sort();

  const fields = [
    { name: 'studentId', label: 'Student ID', required: true, hint: 'Permanent ID · cannot be changed after creation.' },
    { name: 'name', label: 'Full name', required: true, placeholder: 'e.g. Ananya Iyer' },
    { name: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'student@institute.com', autoComplete: 'off' },
    { name: 'phone', label: 'Phone number', required: true, placeholder: '+91 98450 12345' },
    { name: 'batchId', label: 'Assigned batch', type: 'select', required: true, options: [['', 'Select batch'], ...batchOptions] },
    { name: 'course', label: 'Course', type: 'select', required: true, options: [['', 'Select course'], ...courseOptions], hint: 'Automatically aligned with the selected batch.' },
    { name: 'admissionDate', label: 'Admission date', type: 'date', required: true },
    { name: 'status', label: 'Enrollment status', type: 'select', required: true, options: ENROLLMENT_STATUSES },
    { name: 'paymentStatus', label: 'Payment status', type: 'select', required: true, options: PAYMENT_STATUSES },
    { name: 'guardian', label: 'Guardian / contact', placeholder: 'Optional emergency contact' },
    { name: 'notes', label: 'Notes', type: 'textarea', span: 2, placeholder: 'Learning goals, scholarship information or follow-up notes.' },
  ];

  const columns = [
    {
      key: 'name', label: 'Student', sortable: true,
      render: (student) => (
        <div className="primary-cell">
          <Avatar name={student.name} size="sm" />
          <span><strong>{student.name}</strong><small>{student.studentId}</small></span>
        </div>
      ),
    },
    {
      key: 'email', label: 'Contact', sortable: true,
      render: (student) => <span className="stacked-cell"><span><Mail size={12} /> {student.email}</span><small><Phone size={12} /> {student.phone}</small></span>,
    },
    { key: 'course', label: 'Course', sortable: true },
    {
      key: 'batchId', label: 'Batch', sortable: true,
      render: (student) => <span className="muted-cell">{state.batches.find((batch) => batch.id === student.batchId)?.name || student.batchId}</span>,
    },
    { key: 'admissionDate', label: 'Admission date', sortable: true, render: (student) => formatDate(student.admissionDate) },
    { key: 'status', label: 'Enrollment', sortable: true, render: (student) => <StatusBadge value={student.status} /> },
    { key: 'paymentStatus', label: 'Payment', sortable: true, render: (student) => <Badge tone="auto" dot>{student.paymentStatus}</Badge> },
  ];

  const detailRenderer = (student) => {
    const batch = state.batches.find((item) => item.id === student.batchId);
    const attendanceRecords = sortBy(state.attendance.filter((record) => record.studentId === student.id), 'date', 'desc');
    const results = state.assessmentResults.filter((result) => result.studentId === student.id);
    const passRate = results.length ? Math.round((results.filter((result) => result.result === 'Pass').length / results.length) * 100) : 0;
    const assignments = state.assessments.filter((assessment) => assessment.batchId === student.batchId);
    const groups = state.groups.filter((group) => (group.memberIds || []).includes(student.id));
    const attendance = attendanceSummary(attendanceRecords);
    return (
      <>
        <div className="detail-hero student-hero">
          <Avatar name={student.name} size="lg" />
          <div><strong>{student.name}</strong><p>{student.studentId} · {student.course}</p></div>
          <StatusBadge value={student.status} />
        </div>
        <div className="mini-stat-grid four">
          <MiniStat label="Attendance" value={`${studentAttendancePercentage(state, student.id)}%`} hint={`${attendance.total} sessions`} icon={CalendarCheck} tone="success" />
          <MiniStat label="Assessments" value={results.length} hint={`${assignments.length} assigned`} icon={ClipboardCheck} tone="info" />
          <MiniStat label="Pass rate" value={`${passRate}%`} hint={`${results.filter((r) => r.result === 'Pass').length} passed`} icon={BookOpen} tone={passRate >= 70 ? 'success' : 'warning'} />
          <MiniStat label="Groups" value={groups.length} hint="Active memberships" icon={UserRound} />
        </div>
        <DetailSection title="Enrollment information">
          <DetailGrid items={[
            { label: 'Student ID', value: student.studentId },
            { label: 'Email', value: student.email },
            { label: 'Phone', value: student.phone },
            { label: 'Course', value: student.course },
            { label: 'Batch', value: batch?.name || student.batchId },
            { label: 'Admission date', value: formatDate(student.admissionDate) },
            { label: 'Enrollment status', value: student.status },
            { label: 'Payment status', value: student.paymentStatus },
            { label: 'Guardian / contact', value: student.guardian || '—' },
            { label: 'Trainer', value: batch?.trainer || '—' },
          ]} />
        </DetailSection>
        <DetailSection title="Attendance history">
          {attendanceRecords.length ? (
            <>
              <ProgressBar value={attendance.percentage} label="Attendance rate" compact />
              <div className="compact-list scroll-list">
                {attendanceRecords.slice(0, 8).map((record) => (
                  <div className="compact-list-row" key={record.id}>
                    <span className="date-block"><strong>{formatDate(record.date, { day: '2-digit' })}</strong><small>{formatDate(record.date, { month: 'short' })}</small></span>
                    <div><strong>{state.batches.find((b) => b.id === record.batchId)?.course || record.batchId}</strong><span>{record.note || 'Regular session'}</span></div>
                    <Badge tone="auto">{record.status}</Badge>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="muted">No attendance has been recorded for this student.</p>}
        </DetailSection>
        <DetailSection title="Assessment results">
          {results.length ? <div className="compact-list">{results.map((result) => {
            const assessment = state.assessments.find((item) => item.id === result.assessmentId);
            return (
              <div className="compact-list-row" key={result.id}>
                <span className="result-score"><strong>{result.marks}</strong><small>/{result.maxMarks}</small></span>
                <div><strong>{assessment?.title || result.assessmentId}</strong><span>{formatDate(assessment?.date)} · {result.percentage}%</span></div>
                <Badge tone={result.result === 'Pass' ? 'success' : 'danger'}>{result.result}</Badge>
              </div>
            );
          })}</div> : <p className="muted">No assessment results have been entered yet.</p>}
        </DetailSection>
        <DetailSection title="Learning assignments">
          {assignments.length ? <div className="compact-list">{assignments.map((assessment) => {
            const result = results.find((item) => item.assessmentId === assessment.id);
            return (
              <div className="compact-list-row" key={assessment.id}>
                <span className="assignment-icon"><ClipboardCheck size={16} /></span>
                <div><strong>{assessment.title}</strong><span>{assessment.type} · Due {formatDate(assessment.date)}</span></div>
                <Badge tone={result ? 'success' : 'warning'}>{result ? result.result : 'Assigned'}</Badge>
              </div>
            );
          })}</div> : <p className="muted">No assignments are linked to this student’s batch.</p>}
        </DetailSection>
        {student.notes && <DetailSection title="Notes"><p className="notes-box">{student.notes}</p></DetailSection>}
      </>
    );
  };

  const updateBatchCounts = async (nextState, batchIds) => {
    if (!isAdmin) return;
    const operations = unique(batchIds).map((batchId) => {
      const batch = nextState.batches.find((item) => item.id === batchId);
      if (!batch) return null;
      return {
        collection: 'batches', action: 'update', id: batchId,
        record: { ...batch, studentCount: nextState.students.filter((student) => student.batchId === batchId).length },
      };
    }).filter(Boolean);
    if (operations.length) {
      try { await commit(operations); } catch { /* counts are derived in the UI even if update is unavailable */ }
    }
  };

  return (
    <EntityPage
      title="Students"
      description="Manage admissions, profiles, enrollment status and fee records."
      collection="students"
      columns={columns}
      fields={fields}
      searchFields={['name', 'email', 'phone', 'studentId', 'course', 'notes']}
      filters={[
        { key: 'batchId', label: 'Batch', options: batchOptions },
        { key: 'status', label: 'Status', options: ENROLLMENT_STATUSES },
        { key: 'paymentStatus', label: 'Payment', options: PAYMENT_STATUSES },
        { key: 'course', label: 'Course', options: courseOptions },
      ]}
      initialSort={{ key: 'admissionDate', direction: 'desc' }}
      defaultValues={() => ({
        studentId: `STU-${1001 + state.students.length}`,
        admissionDate: todayISO(), status: 'Active', paymentStatus: 'Pending',
        batchId: state.batches.find((batch) => batch.status === 'Active')?.id || '',
        course: state.batches.find((batch) => batch.status === 'Active')?.course || '',
      })}
      transformForSave={(values, editing) => {
        const batch = state.batches.find((item) => item.id === values.batchId);
        const studentId = editing?.studentId || values.studentId.trim().toUpperCase();
        return {
          ...values,
          id: editing?.id || studentId,
          studentId,
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          course: batch?.course || values.course,
          createdAt: editing?.createdAt || new Date().toISOString(),
        };
      }}
      customValidate={(values) => {
        const errors = {};
        if (!/^[+]?[\d\s()-]{7,20}$/.test(values.phone || '')) errors.phone = 'Enter a valid phone number.';
        if (values.admissionDate > todayISO()) errors.admissionDate = 'Admission date cannot be in the future.';
        if (!values.batchId) errors.batchId = 'Select an assigned batch.';
        return errors;
      }}
      duplicateCheck={(record, editing, records) => {
        const duplicate = records.find((student) => student.id !== editing?.id && (
          student.studentId === record.studentId || student.email.toLowerCase() === record.email.toLowerCase() || student.phone === record.phone
        ));
        return duplicate ? 'A student with this ID, email or phone number already exists.' : null;
      }}
      onAfterSave={async (record, editing, updated) => {
        await updateBatchCounts(updated, [editing?.batchId, record.batchId]);
      }}
      onBeforeDelete={(student, currentState) => {
        const operations = [];
        currentState.attendance.filter((record) => record.studentId === student.id).forEach((record) => operations.push({ collection: 'attendance', action: 'delete', id: record.id }));
        currentState.assessmentResults.filter((record) => record.studentId === student.id).forEach((record) => operations.push({ collection: 'assessmentResults', action: 'delete', id: record.id }));
        currentState.groups.filter((group) => (group.memberIds || []).includes(student.id)).forEach((group) => operations.push({
          collection: 'groups', action: 'update', id: group.id,
          record: { ...group, memberIds: (group.memberIds || []).filter((id) => id !== student.id), leaderId: group.leaderId === student.id ? '' : group.leaderId },
        }));
        if (isAdmin) {
          const batch = currentState.batches.find((item) => item.id === student.batchId);
          if (batch) operations.push({
            collection: 'batches', action: 'update', id: batch.id,
            record: { ...batch, studentCount: currentState.students.filter((item) => item.id !== student.id && item.batchId === batch.id).length },
          });
        }
        return operations;
      }}
      detailRenderer={detailRenderer}
      recordLabel={(student) => student.name}
      deleteMessage={(student) => `Delete “${student.name}”? Attendance, results and group memberships for this student will also be removed.`}
      exportConfig={{
        filename: 'edutrack-students.csv',
        searchPlaceholder: 'Search by name, email or phone…',
        headers: [
          { label: 'Student ID', key: 'studentId' }, { label: 'Full name', key: 'name' },
          { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
          { label: 'Course', key: 'course' }, { label: 'Batch', value: (student) => state.batches.find((b) => b.id === student.batchId)?.name || student.batchId },
          { label: 'Admission date', key: 'admissionDate' }, { label: 'Enrollment status', key: 'status' },
          { label: 'Payment status', key: 'paymentStatus' }, { label: 'Notes', key: 'notes' },
        ],
      }}
      createLabel="Add Student"
      createTitle="Add a new student"
      editTitle="Edit student profile"
      emptyTitle="No students found"
      emptyDescription="Add an admission or adjust your filters to see student records."
    />
  );
}
