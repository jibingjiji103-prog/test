import React, { useState } from 'react';
import {
  BookOpen, BookOpenCheck, Check, ChevronDown, ChevronRight, CirclePlus, Download,
  FileText, Layers3, Pencil, Plus, Trash2,
} from 'lucide-react';
import EntityPage, { StatusBadge } from '../components/EntityPage';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { DetailGrid, DetailSection, ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { syllabusCompletion } from '../lib/metrics';
import { downloadFile, formatDate, toCSV, todayISO, uid } from '../lib/utils';

const STATUSES = ['Active', 'Draft', 'Archived'];

function serializeOutline(syllabus) {
  return (syllabus?.modules || []).map((module) => [module.title, ...(module.topics || []).map((topic) => topic.title)].join(' | ')).join('\n');
}

function parseOutline(outline, existingModules = []) {
  return String(outline || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line, moduleIndex) => {
    const [title, ...topicTitles] = line.split('|').map((part) => part.trim()).filter(Boolean);
    const existingModule = existingModules[moduleIndex]?.title === title ? existingModules[moduleIndex] : existingModules.find((module) => module.title === title);
    return {
      id: existingModule?.id || uid('MOD'),
      title,
      targetHours: existingModule?.targetHours || 8,
      topics: topicTitles.map((topicTitle, topicIndex) => {
        const existingTopic = (existingModule?.topics || []).find((topic) => topic.title === topicTitle) || (existingModule?.topics || [])[topicIndex];
        return {
          id: existingTopic?.title === topicTitle ? existingTopic.id : uid('TOP'),
          title: topicTitle,
          completed: existingTopic?.title === topicTitle ? Boolean(existingTopic.completed) : false,
          completionDate: existingTopic?.title === topicTitle ? (existingTopic.completionDate || null) : null,
        };
      }),
    };
  });
}

function SyllabusEditor({ syllabus, state, commit, notify, canEdit }) {
  const [expanded, setExpanded] = useState(() => Object.fromEntries((syllabus.modules || []).map((module, index) => [module.id, index === 0])));
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const updateSyllabus = async (modules, message) => {
    if (!canEdit) { notify('You do not have permission to edit this syllabus.', 'error'); return; }
    setSaving(true);
    try {
      await commit([{ collection: 'syllabi', action: 'update', id: syllabus.id, record: { ...syllabus, modules } }]);
      notify(message, 'success');
    } catch (error) {
      notify(error.message || 'Unable to update curriculum.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleTopic = (moduleId, topicId) => {
    const modules = (syllabus.modules || []).map((module) => module.id !== moduleId ? module : {
      ...module,
      topics: (module.topics || []).map((topic) => topic.id !== topicId ? topic : {
        ...topic,
        completed: !topic.completed,
        completionDate: !topic.completed ? todayISO() : null,
      }),
    });
    updateSyllabus(modules, 'Lesson completion updated.');
  };

  const saveEditor = async () => {
    const title = editor.title?.trim();
    if (!title) { setEditorError('A title is required.'); return; }
    let modules = [...(syllabus.modules || [])];
    if (editor.type === 'module') {
      if (editor.mode === 'add') {
        const id = uid('MOD');
        modules.push({ id, title, targetHours: Number(editor.targetHours || 8), topics: [] });
        setExpanded((current) => ({ ...current, [id]: true }));
      } else {
        modules = modules.map((module) => module.id === editor.moduleId ? { ...module, title, targetHours: Number(editor.targetHours || 8) } : module);
      }
    } else if (editor.mode === 'add') {
      modules = modules.map((module) => module.id === editor.moduleId ? { ...module, topics: [...(module.topics || []), { id: uid('TOP'), title, completed: false, completionDate: null }] } : module);
    } else {
      modules = modules.map((module) => module.id !== editor.moduleId ? module : {
        ...module,
        topics: (module.topics || []).map((topic) => topic.id === editor.topicId ? { ...topic, title } : topic),
      });
    }
    await updateSyllabus(modules, editor.mode === 'add' ? `${editor.type === 'module' ? 'Module' : 'Topic'} added.` : 'Curriculum updated.');
    setEditor(null);
    setEditorError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    let modules;
    if (deleteTarget.type === 'module') modules = (syllabus.modules || []).filter((module) => module.id !== deleteTarget.moduleId);
    else modules = (syllabus.modules || []).map((module) => module.id !== deleteTarget.moduleId ? module : { ...module, topics: (module.topics || []).filter((topic) => topic.id !== deleteTarget.topicId) });
    await updateSyllabus(modules, `${deleteTarget.type === 'module' ? 'Module' : 'Topic'} deleted.`);
    setDeleteTarget(null);
  };

  return (
    <div className="syllabus-editor">
      <div className="syllabus-editor-head">
        <div><strong>Curriculum builder</strong><span>Mark lessons complete, rename items and add new topics.</span></div>
        <Button variant="secondary" size="sm" icon={Plus} disabled={!canEdit} onClick={() => { setEditor({ type: 'module', mode: 'add', title: '', targetHours: 8 }); setEditorError(''); }}>Add Module</Button>
      </div>
      {(syllabus.modules || []).length ? syllabus.modules.map((module, moduleIndex) => {
        const done = (module.topics || []).filter((topic) => topic.completed).length;
        const total = (module.topics || []).length;
        return (
          <div className="syllabus-module" key={module.id}>
            <div className="syllabus-module-head">
              <button type="button" className="module-toggle" onClick={() => setExpanded((current) => ({ ...current, [module.id]: !current[module.id] }))}>
                {expanded[module.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="module-index">{String(moduleIndex + 1).padStart(2, '0')}</span>
                <strong>{module.title}</strong>
              </button>
              <div className="module-tools">
                <Badge tone="neutral">{done}/{total}</Badge>
                {canEdit && <>
                  <button type="button" className="icon-action" title="Add topic" aria-label={`Add topic to ${module.title}`} onClick={() => { setExpanded((current) => ({ ...current, [module.id]: true })); setEditor({ type: 'topic', mode: 'add', moduleId: module.id, title: '' }); setEditorError(''); }}><CirclePlus size={15} /></button>
                  <button type="button" className="icon-action" title="Edit module" aria-label={`Edit ${module.title}`} onClick={() => { setEditor({ type: 'module', mode: 'edit', moduleId: module.id, title: module.title, targetHours: module.targetHours || 8 }); setEditorError(''); }}><Pencil size={15} /></button>
                  <button type="button" className="icon-action danger" title="Delete module" aria-label={`Delete ${module.title}`} onClick={() => setDeleteTarget({ type: 'module', moduleId: module.id, label: module.title })}><Trash2 size={15} /></button>
                </>}
              </div>
            </div>
            {expanded[module.id] && (
              <div className="syllabus-topics">
                <ProgressBar value={total ? (done / total) * 100 : 0} compact />
                {(module.topics || []).map((topic, topicIndex) => (
                  <div className={`syllabus-topic ${topic.completed ? 'completed' : ''}`} key={topic.id}>
                    <button type="button" className="topic-check" disabled={!canEdit} aria-label={`${topic.completed ? 'Mark incomplete' : 'Mark complete'}: ${topic.title}`} onClick={() => toggleTopic(module.id, topic.id)}>
                      {topic.completed ? <Check size={13} /> : <span>{topicIndex + 1}</span>}
                    </button>
                    <div><strong>{topic.title}</strong><small>{topic.completed ? `Completed ${formatDate(topic.completionDate)}` : 'Not completed'}</small></div>
                    {canEdit && <div className="row-actions">
                      <button type="button" className="icon-action" aria-label={`Edit topic ${topic.title}`} onClick={() => { setEditor({ type: 'topic', mode: 'edit', moduleId: module.id, topicId: topic.id, title: topic.title }); setEditorError(''); }}><Pencil size={14} /></button>
                      <button type="button" className="icon-action danger" aria-label={`Delete topic ${topic.title}`} onClick={() => setDeleteTarget({ type: 'topic', moduleId: module.id, topicId: topic.id, label: topic.title })}><Trash2 size={14} /></button>
                    </div>}
                  </div>
                ))}
                {!(module.topics || []).length && <p className="muted small">No topics yet. Add the first lesson to this module.</p>}
              </div>
            )}
          </div>
        );
      }) : <EmptyState icon={BookOpen} title="No modules yet" description="Add a module to start building this curriculum." compact />}

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={`${editor?.mode === 'add' ? 'Add' : 'Edit'} ${editor?.type === 'module' ? 'module' : 'topic'}`}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setEditor(null)}>Cancel</Button><Button variant="primary" onClick={saveEditor} loading={saving}>Save</Button></>}
      >
        <div className="form-grid">
          <div className="form-field span-2">
            <label className="field-label" htmlFor="editor-title"><span>{editor?.type === 'module' ? 'Module title' : 'Topic title'}</span></label>
            <input id="editor-title" className={`form-control ${editorError ? 'has-error' : ''}`} value={editor?.title || ''} onChange={(event) => { setEditor((current) => ({ ...current, title: event.target.value })); setEditorError(''); }} placeholder={editor?.type === 'module' ? 'e.g. Kubernetes' : 'e.g. Services and ingress'} />
            {editorError && <span className="field-error">{editorError}</span>}
          </div>
          {editor?.type === 'module' && (
            <div className="form-field span-2">
              <label className="field-label" htmlFor="editor-hours"><span>Target hours</span></label>
              <input id="editor-hours" className="form-control" type="number" min="1" value={editor.targetHours || 8} onChange={(event) => setEditor((current) => ({ ...current, targetHours: event.target.value }))} />
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={saving}
        message={`Delete “${deleteTarget?.label}”? ${deleteTarget?.type === 'module' ? 'All topics in this module will also be removed.' : 'This topic will be removed from the module.'}`}
      />
    </div>
  );
}

export default function Syllabi() {
  const { state, commit, notify, canWrite } = useApp();
  const batchOptions = state.batches.map((batch) => [batch.id, `${batch.name} · ${batch.course}`]);
  const courseOptions = [...new Set(state.syllabi.map((syllabus) => syllabus.course))].sort();

  const fields = [
    { name: 'course', label: 'Course name', required: true, placeholder: 'e.g. DevOps, Data Analytics, UI/UX Design' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: STATUSES },
    {
      name: 'batchIds', label: 'Assign to batches', type: 'multiselect', required: true, span: 2,
      options: batchOptions,
    },
    { name: 'description', label: 'Description', type: 'textarea', span: 2, placeholder: 'Short description of the curriculum and learning outcomes.' },
    {
      name: 'outline', label: 'Curriculum outline', type: 'textarea', rows: 8, required: true, span: 2,
      placeholder: 'Introduction to DevOps | DevOps culture | SDLC\nLinux Fundamentals | File system | Shell scripting',
      help: 'One module per line. Separate the module title and its topics with “|”. Existing completion is preserved for matching titles.',
    },
  ];

  const columns = [
    {
      key: 'course', label: 'Course / syllabus', sortable: true,
      render: (syllabus) => <div className="primary-cell"><span className="cell-icon"><BookOpen size={16} /></span><span><strong>{syllabus.course}</strong><small>{syllabus.description || 'No description'}</small></span></div>,
    },
    {
      key: 'batchIds', label: 'Assigned batches',
      render: (syllabus) => <div className="chip-list">{(syllabus.batchIds || []).slice(0, 2).map((id) => <Badge key={id} tone="neutral">{state.batches.find((b) => b.id === id)?.course || id}</Badge>)}{(syllabus.batchIds || []).length > 2 && <span className="more-chip">+{(syllabus.batchIds || []).length - 2}</span>}</div>,
    },
    { key: '__modules', label: 'Modules', sortable: true, render: (syllabus) => (syllabus.modules || []).length },
    { key: '__topics', label: 'Topics', sortable: true, render: (syllabus) => (syllabus.modules || []).reduce((sum, module) => sum + (module.topics || []).length, 0) },
    {
      key: '__completion', label: 'Completion', sortable: true,
      render: (syllabus) => <div className="table-progress"><ProgressBar value={syllabusCompletion(syllabus).percentage} compact /><span>{syllabusCompletion(syllabus).percentage}%</span></div>,
    },
    { key: 'status', label: 'Status', sortable: true, render: (syllabus) => <StatusBadge value={syllabus.status || 'Active'} /> },
  ];

  const exportCurriculum = () => {
    const rows = state.syllabi.flatMap((syllabus) => (syllabus.modules || []).flatMap((module, moduleIndex) => (module.topics || []).map((topic, topicIndex) => ({
      course: syllabus.course, moduleIndex: moduleIndex + 1, module: module.title, topicIndex: topicIndex + 1, topic: topic.title,
      completed: topic.completed ? 'Yes' : 'No', completionDate: topic.completionDate || '',
      batches: (syllabus.batchIds || []).map((id) => state.batches.find((b) => b.id === id)?.name || id).join('; '),
    }))));
    if (!rows.length) { notify('No curriculum topics to export.', 'info'); return; }
    downloadFile('edutrack-curriculum.csv', toCSV([
      { label: 'Course', key: 'course' }, { label: 'Module #', key: 'moduleIndex' }, { label: 'Module', key: 'module' },
      { label: 'Topic #', key: 'topicIndex' }, { label: 'Topic', key: 'topic' }, { label: 'Completed', key: 'completed' },
      { label: 'Completion date', key: 'completionDate' }, { label: 'Batches', key: 'batches' },
    ], rows));
    notify('Curriculum export downloaded.', 'success');
  };

  return (
    <EntityPage
      title="Syllabi"
      description="Build course curricula, assign them to batches and track lesson completion."
      collection="syllabi"
      columns={columns}
      fields={fields}
      decorateRow={(syllabus) => ({
        ...syllabus,
        __modules: (syllabus.modules || []).length,
        __topics: (syllabus.modules || []).reduce((sum, module) => sum + (module.topics || []).length, 0),
        __completion: syllabusCompletion(syllabus).percentage,
      })}
      searchFields={['course', 'description', (syllabus) => (syllabus.modules || []).map((module) => module.title).join(' ')]}
      filters={[
        { key: 'course', label: 'Course', options: courseOptions },
        { key: 'status', label: 'Status', options: STATUSES },
        {
          key: 'batchId', label: 'Batch', options: batchOptions,
          match: (syllabus, value) => (syllabus.batchIds || []).includes(value),
        },
        {
          key: 'completion', label: 'Completion', options: [['not-started', 'Not started'], ['in-progress', 'In progress'], ['complete', 'Complete']],
          match: (syllabus, value) => {
            const percentage = syllabusCompletion(syllabus).percentage;
            if (value === 'not-started') return percentage === 0;
            if (value === 'complete') return percentage === 100;
            return percentage > 0 && percentage < 100;
          },
        },
      ]}
      initialSort={{ key: 'course', direction: 'asc' }}
      defaultValues={() => ({ status: 'Active', batchIds: [], outline: 'Module 1 | Introduction | Core concepts\nModule 2 | Practice | Review' })}
      transformForEdit={(syllabus) => ({ ...syllabus, outline: serializeOutline(syllabus), batchIds: syllabus.batchIds || [] })}
      transformForSave={(values, editing) => {
        const { outline, ...rest } = values;
        return {
          ...rest,
          id: editing?.id || uid('SYL'),
          batchIds: [...new Set(values.batchIds || [])],
          modules: parseOutline(outline, editing?.modules || []),
          createdAt: editing?.createdAt || new Date().toISOString(),
        };
      }}
      customValidate={(values) => {
        const errors = {};
        const modules = parseOutline(values.outline);
        if (!modules.length) errors.outline = 'Add at least one module.';
        else if (modules.some((module) => !module.title || !module.topics.length)) errors.outline = 'Each module needs a title and at least one topic.';
        else if (modules.length !== new Set(modules.map((module) => module.title.toLowerCase())).size) errors.outline = 'Module titles must be unique.';
        return errors;
      }}
      duplicateCheck={(record, editing, records) => records.some((syllabus) => syllabus.id !== editing?.id && syllabus.course.toLowerCase() === record.course.toLowerCase()) ? 'A syllabus for this course already exists. Edit that syllabus instead.' : null}
      detailRenderer={(syllabus) => {
        const completion = syllabusCompletion(syllabus);
        const canEdit = canWrite('syllabi', syllabus, syllabus);
        return (
          <>
            <div className="detail-hero"><div className="detail-hero-icon"><BookOpenCheck size={22} /></div><div><strong>{syllabus.course}</strong><p>{syllabus.modules?.length || 0} modules · {completion.total} topics</p></div><StatusBadge value={syllabus.status || 'Active'} /></div>
            <ProgressBar value={completion.percentage} label="Overall completion" />
            <DetailSection title="Syllabus information"><DetailGrid items={[
              { label: 'Course', value: syllabus.course }, { label: 'Status', value: syllabus.status || 'Active' },
              { label: 'Modules', value: syllabus.modules?.length || 0 }, { label: 'Topics', value: completion.total },
              { label: 'Completed topics', value: completion.completed }, { label: 'Created', value: formatDate(syllabus.createdAt) },
              { label: 'Assigned batches', value: (syllabus.batchIds || []).map((id) => state.batches.find((b) => b.id === id)?.name || id).join(', ') || '—' },
              { label: 'Completion', value: `${completion.percentage}%` },
            ]} /></DetailSection>
            {syllabus.description && <DetailSection title="Description"><p className="notes-box">{syllabus.description}</p></DetailSection>}
            <DetailSection title="Modules and topics">
              <SyllabusEditor key={syllabus.id} syllabus={syllabus} state={state} commit={commit} notify={notify} canEdit={canEdit} />
            </DetailSection>
          </>
        );
      }}
      recordLabel={(syllabus) => `${syllabus.course} syllabus`}
      deleteMessage={(syllabus) => `Delete the ${syllabus.course} syllabus? All modules, topics and completion dates will be removed.`}
      exportConfig={{
        filename: 'edutrack-syllabi.csv',
        headers: [
          { label: 'Course', key: 'course' }, { label: 'Status', key: 'status' },
          { label: 'Modules', value: (syllabus) => (syllabus.modules || []).length },
          { label: 'Topics', value: (syllabus) => (syllabus.modules || []).reduce((sum, module) => sum + (module.topics || []).length, 0) },
          { label: 'Completion', value: (syllabus) => `${syllabusCompletion(syllabus).percentage}%` },
          { label: 'Batches', value: (syllabus) => (syllabus.batchIds || []).join('; ') },
          { label: 'Description', key: 'description' },
        ],
      }}
      headerActions={<Button variant="secondary" icon={Download} onClick={exportCurriculum}>Export Curriculum</Button>}
      createLabel="Create Syllabus"
      createTitle="Create course syllabus"
      editTitle="Edit syllabus"
      formSize="xl"
      emptyTitle="No syllabi found"
      emptyDescription="Create a curriculum for any course and assign it to one or more batches."
    />
  );
}
