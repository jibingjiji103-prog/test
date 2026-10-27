export function uid(prefix = 'id') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso, amount) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return todayISOFromDate(d);
}

export function todayISOFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthStart(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return todayISOFromDate(d);
}

export function formatDate(value, options) {
  if (!value) return '—';
  const isoDate = value instanceof Date ? todayISOFromDate(value) : String(value).slice(0, 10);
  const d = value instanceof Date ? value : new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  if (!options) {
    const preference = typeof document !== 'undefined' ? document.documentElement.dataset.dateFormat : '';
    if (preference === 'YYYY-MM-DD') return isoDate;
    if (preference === 'MM/DD/YYYY') return `${isoDate.slice(5, 7)}/${isoDate.slice(8, 10)}/${isoDate.slice(0, 4)}`;
    options = { day: '2-digit', month: 'short', year: 'numeric' };
  }
  return new Intl.DateTimeFormat('en-GB', options).format(d);
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

export function percent(numerator, denominator, decimals = 0) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(decimals));
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ET';
}

export function titleCase(value = '') {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ''))];
}

export function sortBy(records, key, direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...records].sort((a, b) => {
    const av = typeof key === 'function' ? key(a) : a?.[key];
    const bv = typeof key === 'function' ? key(b) : b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * factor;
  });
}

export function matchesSearch(record, term, fields) {
  if (!term?.trim()) return true;
  const needle = term.trim().toLowerCase();
  return fields.some((field) => {
    const value = typeof field === 'function' ? field(record) : record?.[field];
    return String(value ?? '').toLowerCase().includes(needle);
  });
}

export function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCSV(headers, rows) {
  const lines = [headers.map((h) => csvEscape(h.label)).join(',')];
  rows.forEach((row) => lines.push(headers.map((h) => csvEscape(typeof h.value === 'function' ? h.value(row) : row[h.key])).join(',')));
  return lines.join('\n');
}

export function downloadFile(filename, content, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\ufeff', content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function paginate(records, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { rows: records.slice(start, start + pageSize), page: safePage, totalPages, start, total: records.length };
}

export function deepClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function isOverdue(date, status) {
  if (!date || ['Completed', 'Cancelled'].includes(status)) return false;
  return date < todayISO();
}

export function getInitialsColor(value = '') {
  const colors = ['#F43F5E', '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6'];
  const sum = [...value].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[sum % colors.length];
}
