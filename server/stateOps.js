export function applyStateOperation(currentState, operation) {
  const next = structuredClone(currentState);
  const { collection, action, record, id } = operation;
  if (!Array.isArray(next[collection])) next[collection] = [];
  if (action === 'create') {
    next[collection] = [record, ...next[collection].filter((item) => item.id !== record?.id)];
  } else if (action === 'update') {
    next[collection] = next[collection].map((item) => item.id === (id || record?.id) ? { ...item, ...record, id: item.id } : item);
  } else if (action === 'delete') {
    next[collection] = next[collection].filter((item) => item.id !== id);
  } else if (action === 'replace') {
    next[collection] = record;
  }
  return next;
}
