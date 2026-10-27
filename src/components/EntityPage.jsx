import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Drawer from './ui/Drawer';
import DataTable from './ui/DataTable';
import SearchInput from './ui/SearchInput';
import FilterSelect from './ui/FilterSelect';
import Tabs from './ui/Tabs';
import { DynamicForm, formInitialValues, validateForm } from './ui/Field';
import { useApp } from '../context/AppContext';
import { canWriteCollection } from '../lib/permissions';
import { deepClone, downloadFile, matchesSearch, paginate, sortBy, toCSV } from '../lib/utils';

const TABLE_VIEW = 'table';

function singularize(title) {
  const irregular = { Batches: 'Batch', Syllabi: 'Syllabus', Assessments: 'Assessment' };
  if (irregular[title]) return irregular[title];
  if (title.endsWith('ies')) return `${title.slice(0, -3)}y`;
  if (title.endsWith('ches') || title.endsWith('shes') || title.endsWith('sses')) return title.slice(0, -2);
  return title.endsWith('s') ? title.slice(0, -1) : title;
}

export default function EntityPage({
  title, description, collection, columns, fields, searchFields = [],
  filters = [], initialSort = { key: 'id', direction: 'asc' }, entityLabel,
  defaultValues = {}, transformForEdit, transformForSave, customValidate, duplicateCheck, onFieldChange,
  onBeforeDelete, onAfterSave, detailRenderer, detailFooter, exportConfig, headerActions,
  decorateRow, alternateViews = [], renderAlternateView, pageSize, createLabel = 'Add Record',
  createTitle, editTitle, formSize = 'lg', recordLabel = (record) => record.name || record.title || record.id,
  deleteMessage = (record) => `Delete “${recordLabel(record)}”? This action cannot be undone.`,
  emptyTitle, emptyDescription, topContent, allowCreate = true, allowDelete = true,
  allowEdit = true, showActions = true, className = '',
}) {
  const { state, commit, notify, user, canWrite, isReadOnly } = useApp();
  const allRecords = state[collection] || [];
  const itemLabel = entityLabel || singularize(title);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [view, setView] = useState(TABLE_VIEW);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const resolvedFilters = useMemo(() => filters.map((filter) => ({
    ...filter,
    options: typeof filter.options === 'function' ? filter.options(state) : filter.options,
  })), [filters, state]);

  const resolvedFields = useMemo(
    () => (typeof fields === 'function' ? fields({ values, editing, state }) : fields),
    [fields, values, editing, state],
  );

  const filteredRecords = useMemo(() => {
    let rows = [...allRecords];
    if (search.trim()) rows = rows.filter((record) => matchesSearch(record, search, searchFields));
    resolvedFilters.forEach((filter) => {
      const value = filterValues[filter.key];
      if (!value) return;
      rows = rows.filter((record) => (filter.match ? filter.match(record, value, state) : record[filter.key] === value));
    });
    const sorted = sortBy(rows, sort.key === 'id' ? 'id' : (record) => (typeof sort.key === 'function' ? sort.key(record) : record[sort.key]), sort.direction);
    return decorateRow ? sorted.map((row) => decorateRow(row, state)) : sorted;
  }, [allRecords, search, filterValues, sort, searchFields, resolvedFilters, state, decorateRow]);

  const size = Number(pageSize || state.meta?.preferences?.pageSize || 8);
  const paginationData = paginate(filteredRecords, page, size);
  const selected = allRecords.find((record) => record.id === selectedId) || null;

  useEffect(() => { setPage(1); }, [search, JSON.stringify(filterValues), sort.key, sort.direction, view]);
  useEffect(() => { if (selectedId && !selected) setSelectedId(null); }, [selected, selectedId]);

  const canCreate = allowCreate && !isReadOnly && canWriteCollection(user, collection);
  const editable = (record) => allowEdit && !isReadOnly && canWrite(collection, record, record);
  const deletable = (record) => allowDelete && !isReadOnly && canWrite(collection, record, record);

  const openCreate = () => {
    const initial = typeof defaultValues === 'function' ? defaultValues(state) : defaultValues;
    setEditing(null);
    setValues(formInitialValues(resolvedFields, { ...initial }));
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (record) => {
    if (!editable(record)) {
      notify('You do not have permission to edit this record.', 'error');
      return;
    }
    const source = transformForEdit ? transformForEdit(deepClone(record), state) : deepClone(record);
    setEditing(record);
    setValues(formInitialValues(resolvedFields, source));
    setErrors({});
    setFormOpen(true);
  };

  const handleSort = (key) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  const handleChange = (name, value) => {
    if (onFieldChange) {
      const replacement = onFieldChange(name, value, values, state);
      if (replacement) {
        setValues(replacement);
        setErrors({});
        return;
      }
    }
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async () => {
    const validation = validateForm(resolvedFields, values, (formValues) => customValidate?.(formValues, editing, state, allRecords));
    if (Object.keys(validation).length) {
      setErrors(validation);
      notify('Please correct the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      const record = transformForSave ? await transformForSave(deepClone(values), editing, state) : deepClone(values);
      const duplicateMessage = duplicateCheck?.(record, editing, allRecords, state);
      if (duplicateMessage) {
        setErrors({ form: duplicateMessage });
        notify(duplicateMessage, 'error');
        return;
      }
      const operations = [{
        collection,
        action: editing ? 'update' : 'create',
        id: editing?.id,
        record,
      }];
      const updated = await commit(operations);
      await onAfterSave?.(record, editing, updated);
      notify(`${itemLabel} ${editing ? 'updated' : 'created'} successfully.`, 'success');
      setFormOpen(false);
      setEditing(null);
      if (selectedId && editing?.id === selectedId) setSelectedId(record.id || editing.id);
    } catch (error) {
      notify(error.message || 'Unable to save this record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const extraOperations = onBeforeDelete ? await onBeforeDelete(deleteTarget, state) : [];
      await commit([
        { collection, action: 'delete', id: deleteTarget.id },
        ...(extraOperations || []),
      ]);
      notify(`${itemLabel} deleted successfully.`, 'success');
      setSelectedId(null);
      setDeleteTarget(null);
    } catch (error) {
      notify(error.message || 'Unable to delete this record.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const exportRows = () => {
    if (!exportConfig || !filteredRecords.length) {
      notify('No rows to export.', 'info');
      return;
    }
    const rows = exportConfig.rows ? exportConfig.rows(filteredRecords, state) : filteredRecords;
    downloadFile(exportConfig.filename || `${collection}.csv`, toCSV(exportConfig.headers, rows));
    notify('CSV export downloaded.', 'success');
  };

  const actionsColumn = showActions ? {
    key: '_actions', label: '', sortable: false, className: 'actions-column',
    render: (record) => (
      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        {detailRenderer && <button type="button" className="icon-action" title="View details" aria-label="View details" onClick={() => setSelectedId(record.id)}><Eye size={15} /></button>}
        {editable(record) && <button type="button" className="icon-action" title="Edit" aria-label="Edit" onClick={() => openEdit(record)}><Pencil size={15} /></button>}
        {deletable(record) && <button type="button" className="icon-action danger" title="Delete" aria-label="Delete" onClick={() => setDeleteTarget(record)}><Trash2 size={15} /></button>}
      </div>
    ),
  } : null;
  const tableColumns = actionsColumn ? [...columns, actionsColumn] : columns;

  const viewTabs = alternateViews.length ? [{ value: TABLE_VIEW, label: 'Table' }, ...alternateViews.map(({ value, label, icon }) => ({ value, label, icon }))] : [];

  return (
    <div className={`entity-page ${className}`}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{title}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="page-heading-actions">
          {headerActions}
          {exportConfig && <Button variant="secondary" icon={Download} onClick={exportRows}>Export CSV</Button>}
          {canCreate && <Button variant="primary" icon={Plus} onClick={openCreate}>{createLabel}</Button>}
        </div>
      </div>

      {topContent}

      <div className="toolbar-card">
        <SearchInput value={search} onChange={setSearch} placeholder={exportConfig?.searchPlaceholder || `Search ${title.toLowerCase()}…`} />
        <div className="toolbar-filters">
          {resolvedFilters.map((filter) => (
            <FilterSelect
              key={filter.key}
              label={filter.label}
              value={filterValues[filter.key] || ''}
              onChange={(value) => setFilterValues((current) => ({ ...current, [filter.key]: value }))}
              options={filter.options}
              allLabel={filter.allLabel || `All ${filter.label.toLowerCase()}`}
            />
          ))}
          {viewTabs.length > 0 && <Tabs tabs={viewTabs} value={view} onChange={setView} className="toolbar-tabs" />}
        </div>
      </div>

      {errors.form && <div className="form-alert error page-alert" role="alert">{errors.form}</div>}

      {view !== TABLE_VIEW && renderAlternateView ? renderAlternateView(view, {
        records: filteredRecords,
        state,
        openEdit,
        openView: (record) => setSelectedId(record.id),
        setDeleteTarget,
        setView,
        editable,
        deletable,
      }) : (
        <DataTable
          columns={tableColumns}
          rows={paginationData.rows}
          sort={sort}
          onSort={handleSort}
          pagination={{ ...paginationData, onPage: setPage }}
          onRowClick={detailRenderer ? (record) => setSelectedId(record.id) : undefined}
          rowClassName={(row) => row.__overdue ? 'overdue-row' : ''}
          emptyTitle={emptyTitle || `No ${title.toLowerCase()} yet`}
          emptyDescription={emptyDescription || 'Add a record or adjust the current filters to see results.'}
          emptyAction={canCreate ? <Button variant="primary" icon={Plus} onClick={openCreate}>{createLabel}</Button> : null}
          caption={`${title} table`}
        />
      )}

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) { setFormOpen(false); setEditing(null); } }}
        title={editing ? (editTitle || `Edit ${itemLabel}`) : (createTitle || `Add ${itemLabel}`)}
        subtitle="Fields marked with an asterisk are required."
        size={formSize}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Save Record'}</Button>
          </>
        )}
      >
        {errors.form && <div className="form-alert error" role="alert">{errors.form}</div>}
        <DynamicForm fields={resolvedFields} values={values} onChange={handleChange} errors={errors} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        message={deleteTarget ? deleteMessage(deleteTarget) : ''}
        confirmLabel="Delete"
      />

      {detailRenderer && (
        <Drawer
          open={Boolean(selected)}
          onClose={() => setSelectedId(null)}
          title={selected ? recordLabel(selected) : ''}
          subtitle={selected ? `${itemLabel} details` : ''}
          size="lg"
          footer={selected && (editable(selected) || deletable(selected) || detailFooter) ? (
            <>
              {detailFooter?.(selected, { openEdit, setDeleteTarget })}
              {deletable(selected) && <Button variant="danger" icon={Trash2} onClick={() => setDeleteTarget(selected)}>Delete</Button>}
              {editable(selected) && <Button variant="primary" icon={Pencil} onClick={() => openEdit(selected)}>Edit</Button>}
            </>
          ) : null}
        >
          {selected ? detailRenderer(selected, state) : null}
        </Drawer>
      )}
    </div>
  );
}

export function StatusBadge({ value }) {
  return <Badge tone="auto" dot>{value || '—'}</Badge>;
}
