import React from 'react';
import { FolderKanban, Layers3, UserRound, UsersRound } from 'lucide-react';
import EntityPage, { StatusBadge } from '../components/EntityPage';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Avatar, DetailGrid, DetailSection, MiniStat } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { formatDate, unique } from '../lib/utils';

const STATUSES = ['Active', 'Inactive', 'Completed'];

export default function Groups() {
  const { state } = useApp();
  const batchOptions = state.batches.map((batch) => [batch.id, `${batch.name} · ${batch.course}`]);
  const trainerOptions = state.users.filter((user) => user.role === 'Trainer' || user.role === 'Admin').map((user) => [user.id, `${user.name} · ${user.role}`]);
  const trainerName = (group) => state.users.find((user) => user.id === group.trainerId || user.name === group.trainer)?.name || group.trainer || '—';

  const fields = ({ values }) => {
    const eligibleStudents = values.batchId ? state.students.filter((student) => student.batchId === values.batchId) : [];
    const memberIds = Array.isArray(values.memberIds) ? values.memberIds : [];
    return [
      { name: 'name', label: 'Group name', required: true, placeholder: 'e.g. CI/CD Builders' },
      { name: 'batchId', label: 'Batch', type: 'select', required: true, options: [['', 'Select batch'], ...batchOptions] },
      { name: 'trainerId', label: 'Assigned trainer / leader', type: 'select', required: true, options: [['', 'Select trainer'], ...trainerOptions] },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STATUSES },
      { name: 'project', label: 'Associated project', required: true, span: 2, placeholder: 'e.g. Automated release pipeline' },
      {
        name: 'memberIds', label: 'Group members', type: 'multiselect', required: true, span: 2,
        options: eligibleStudents.map((student) => [student.id, `${student.name} · ${student.studentId}`]),
        help: values.batchId ? 'Only students enrolled in the selected batch are shown.' : 'Select a batch to see eligible students.',
      },
      {
        name: 'leaderId', label: 'Group leader', type: 'select', required: true,
        options: [['', 'Select group leader'], ...state.students.filter((student) => memberIds.includes(student.id)).map((student) => [student.id, student.name])],
      },
      { name: 'description', label: 'Description', type: 'textarea', span: 2, placeholder: 'Group goals and collaboration notes.' },
    ];
  };

  const columns = [
    {
      key: 'name', label: 'Group', sortable: true,
      render: (group) => <div className="primary-cell"><span className="cell-icon"><UsersRound size={16} /></span><span><strong>{group.name}</strong><small>{group.project}</small></span></div>,
    },
    { key: 'batchId', label: 'Batch', sortable: true, render: (group) => state.batches.find((batch) => batch.id === group.batchId)?.name || group.batchId },
    { key: 'memberCount', label: 'Members', sortable: true, render: (group) => <strong>{(group.memberIds || []).length}</strong> },
    { key: 'trainerId', label: 'Trainer', sortable: true, render: (group) => <span className="person-cell"><UserRound size={14} />{trainerName(group)}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (group) => <StatusBadge value={group.status} /> },
  ];

  return (
    <EntityPage
      title="Groups"
      description="Create student groups, assign mentors and manage project memberships."
      collection="groups"
      columns={columns}
      fields={fields}
      searchFields={['name', 'project', 'description', 'batchId']}
      filters={[
        { key: 'batchId', label: 'Batch', options: batchOptions },
        { key: 'status', label: 'Status', options: STATUSES },
        { key: 'trainerId', label: 'Trainer', options: trainerOptions },
      ]}
      initialSort={{ key: 'name', direction: 'asc' }}
      defaultValues={() => ({ status: 'Active', memberIds: [], batchId: state.batches[0]?.id || '' })}
      onFieldChange={(name, value, values) => {
        if (name === 'batchId') return { ...values, batchId: value, memberIds: [], leaderId: '' };
        if (name === 'memberIds') return { ...values, memberIds: value, leaderId: value.includes(values.leaderId) ? values.leaderId : '' };
        return null;
      }}
      transformForSave={(values, editing) => {
        const trainer = state.users.find((user) => user.id === values.trainerId);
        const memberIds = unique(values.memberIds);
        return {
          ...values,
          id: editing?.id || `GRP-${Date.now().toString().slice(-6)}`,
          memberIds,
          memberCount: memberIds.length,
          trainer: trainer?.name || editing?.trainer || 'Unassigned',
          createdAt: editing?.createdAt || new Date().toISOString(),
        };
      }}
      customValidate={(values, editing) => {
        const errors = {};
        const memberIds = unique(values.memberIds || []);
        if (!memberIds.length) errors.memberIds = 'Select at least one group member.';
        if (memberIds.length !== (values.memberIds || []).length) errors.memberIds = 'Duplicate members are not allowed.';
        if (values.batchId && memberIds.some((id) => state.students.find((student) => student.id === id)?.batchId !== values.batchId)) errors.memberIds = 'All members must belong to the selected batch.';
        if (values.leaderId && !memberIds.includes(values.leaderId)) errors.leaderId = 'The group leader must also be a member.';
        const conflicts = memberIds.filter((id) => state.groups.some((group) => group.batchId === values.batchId && group.id !== editing?.id && (group.memberIds || []).includes(id)));
        if (conflicts.length) errors.memberIds = `${conflicts.length} selected student${conflicts.length > 1 ? 's are' : ' is'} already in another group for this batch.`;
        return errors;
      }}
      duplicateCheck={(record, editing, records) => records.some((group) => group.id !== editing?.id && group.name.toLowerCase() === record.name.toLowerCase() && group.batchId === record.batchId) ? 'A group with this name already exists in this batch.' : null}
      detailRenderer={(group) => {
        const members = state.students.filter((student) => (group.memberIds || []).includes(student.id));
        const leader = state.students.find((student) => student.id === group.leaderId);
        return (
          <>
            <div className="detail-hero"><div className="detail-hero-icon"><UsersRound size={22} /></div><div><strong>{group.project}</strong><p>{state.batches.find((b) => b.id === group.batchId)?.name || group.batchId}</p></div><StatusBadge value={group.status} /></div>
            <div className="mini-stat-grid three">
              <MiniStat label="Members" value={members.length} icon={UsersRound} />
              <MiniStat label="Trainer" value={trainerName(group)} icon={UserRound} tone="info" />
              <MiniStat label="Created" value={formatDate(group.createdAt)} icon={FolderKanban} />
            </div>
            <DetailSection title="Group information"><DetailGrid items={[
              { label: 'Group name', value: group.name }, { label: 'Batch', value: state.batches.find((b) => b.id === group.batchId)?.name || group.batchId },
              { label: 'Project', value: group.project }, { label: 'Trainer', value: trainerName(group) },
              { label: 'Group leader', value: leader?.name || '—' }, { label: 'Status', value: group.status },
              { label: 'Created', value: formatDate(group.createdAt) }, { label: 'Member count', value: members.length },
            ]} /></DetailSection>
            <DetailSection title={`Members (${members.length})`}>
              {members.length ? <div className="member-list">{members.map((student) => (
                <div className="member-row" key={student.id}>
                  <Avatar name={student.name} size="sm" />
                  <span><strong>{student.name}</strong><small>{student.email}</small></span>
                  {student.id === group.leaderId && <Badge tone="info">Leader</Badge>}
                </div>
              ))}</div> : <EmptyState title="No members" description="Edit this group to add students." compact />}
            </DetailSection>
            {group.description && <DetailSection title="Description"><p className="notes-box">{group.description}</p></DetailSection>}
          </>
        );
      }}
      detailFooter={(group, { openEdit }) => <Button variant="secondary" onClick={() => openEdit(group)}>Manage members</Button>}
      recordLabel={(group) => group.name}
      deleteMessage={(group) => `Delete “${group.name}”? The group record will be removed; students will remain enrolled.`}
      exportConfig={{
        filename: 'edutrack-groups.csv',
        headers: [
          { label: 'Group', key: 'name' }, { label: 'Batch', value: (group) => state.batches.find((b) => b.id === group.batchId)?.name || group.batchId },
          { label: 'Members', value: (group) => (group.memberIds || []).length }, { label: 'Trainer', value: (group) => trainerName(group) },
          { label: 'Project', key: 'project' }, { label: 'Leader', value: (group) => state.students.find((s) => s.id === group.leaderId)?.name || '—' },
          { label: 'Status', key: 'status' },
        ],
      }}
      createLabel="Create Group"
      createTitle="Create student group"
      editTitle="Edit group"
      emptyTitle="No groups found"
      emptyDescription="Create a project group or adjust the batch, trainer and status filters."
    />
  );
}
