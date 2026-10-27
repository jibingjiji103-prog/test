import React from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, LoaderCircle } from 'lucide-react';
import Button from './Button';

export default function DataTable({
  columns, rows, rowKey = (row) => row.id, sort, onSort, pagination, onRowClick,
  emptyTitle = 'No records found', emptyDescription = 'Try changing your search or filters.',
  emptyAction, loading = false, className = '', rowClassName = () => '', caption,
}) {
  const hasRows = rows.length > 0;
  return (
    <div className={`table-card ${className}`}>
      <div className="table-scroll">
        <table className="data-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th key={column.key} className={column.className || ''} style={column.width ? { width: column.width } : undefined}>
                    {column.sortable && onSort ? (
                      <button type="button" className={`sort-button ${active ? 'active' : ''}`} onClick={() => onSort(column.key)}>
                        {column.label}
                        {active ? (sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <span className="sort-placeholder">↕</span>}
                      </button>
                    ) : column.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="table-state" colSpan={columns.length}><LoaderCircle className="spin" size={20} /><span>Loading records…</span></td></tr>
            ) : !hasRows ? (
              <tr><td className="table-state" colSpan={columns.length}>
                <span className="empty-icon"><Inbox size={22} /></span>
                <strong>{emptyTitle}</strong>
                <p>{emptyDescription}</p>
                {emptyAction}
              </td></tr>
            ) : rows.map((row, index) => (
              <tr
                key={typeof rowKey === 'function' ? rowKey(row, index) : row[rowKey]}
                className={`${onRowClick ? 'clickable' : ''} ${rowClassName(row)}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.className || ''} data-label={column.label}>
                    {column.render ? column.render(row, index) : row[column.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="table-footer">
          <span>
            {pagination.total ? `Showing ${pagination.start + 1}–${Math.min(pagination.start + rows.length, pagination.total)} of ${pagination.total}` : 'No records'}
          </span>
          <div className="pagination">
            <Button variant="icon" size="sm" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => pagination.onPage(pagination.page - 1)}><ChevronLeft size={15} /></Button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <Button variant="icon" size="sm" aria-label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.onPage(pagination.page + 1)}><ChevronRight size={15} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
