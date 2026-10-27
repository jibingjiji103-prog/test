import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, health } from '../services/api';
import {
  clearDemoSession, clearLocalState, ensureLocalState, readDemoSession, readLocalState,
  readTheme, writeDemoSession, writeLocalState, writeTheme,
} from '../services/localStore';
import { derivePassword, verifyDemoPassword } from '../lib/crypto';
import { normalizeState } from '../lib/metrics';
import { canChangeSettings, canManageUsers, canMutateRecord, isAdmin, isReadOnly } from '../lib/permissions';
import { deepClone, uid } from '../lib/utils';

const AppContext = createContext(null);

const EMPTY_STATE = normalizeState({});

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, passwordIterations, passwordAlgorithm, ...safe } = user;
  return safe;
}

function sameIdentity(a, b) {
  if (!a || !b) return false;
  return [a.studentId, a.batchId, a.date].every((key) => key && a[key] === b[key]);
}

function sameResultIdentity(a, b) {
  return a.assessmentId === b.assessmentId && a.studentId === b.studentId;
}

export function applyOperation(currentState, operation) {
  const next = deepClone(currentState || EMPTY_STATE);
  const { collection, action, record, id, internal } = operation;
  if (collection === 'meta') {
    next.meta = { ...next.meta, ...(record || {}) };
    return next;
  }
  if (!Array.isArray(next[collection])) next[collection] = [];
  if (action === 'create') {
    const item = { ...(record || {}), id: record?.id || uid(collection.slice(0, 3).toUpperCase()) };
    if (collection === 'attendance') {
      const existing = next.attendance.find((row) => sameIdentity(row, item));
      if (existing) {
        Object.assign(existing, item, { id: existing.id });
        return next;
      }
    }
    if (collection === 'assessmentResults') {
      const existing = next.assessmentResults.find((row) => sameResultIdentity(row, item));
      if (existing) {
        Object.assign(existing, item, { id: existing.id });
        return next;
      }
    }
    if (!internal && ['students', 'groups', 'assessments', 'tasks', 'trainerTasks', 'syllabi'].includes(collection)) {
      const duplicate = next[collection].find((row) => row.id === item.id);
      if (duplicate) throw new Error(`A record with ID ${item.id} already exists.`);
    }
    next[collection].unshift(item);
  } else if (action === 'update') {
    const index = next[collection].findIndex((row) => row.id === (id || record?.id));
    if (index === -1) throw new Error('The record no longer exists. Refresh and try again.');
    next[collection][index] = { ...next[collection][index], ...(record || {}), id: next[collection][index].id };
  } else if (action === 'delete') {
    next[collection] = next[collection].filter((row) => row.id !== id);
  } else if (action === 'replace') {
    next[collection] = record;
  }
  return next;
}

function applyOperations(currentState, operations) {
  let next = deepClone(currentState || EMPTY_STATE);
  operations.forEach((operation) => { next = applyOperation(next, operation); });
  next.updatedAt = new Date().toISOString();
  return normalizeState(next);
}

export function AppProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('loading');
  const [connection, setConnection] = useState({ label: 'Checking services…', detail: '' });
  const [initializing, setInitializing] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [theme, setThemeState] = useState(readTheme);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  const userRef = useRef(user);
  const modeRef = useRef(mode);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.dateFormat = state.meta?.preferences?.dateFormat || 'DD MMM YYYY';
    document.documentElement.dataset.compactTables = String(Boolean(state.meta?.preferences?.compactTables));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101112' : '#ffffff');
  }, [theme, state.meta?.preferences?.dateFormat, state.meta?.preferences?.compactTables]);

  const dismissToast = useCallback((id) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, type = 'success') => {
    const id = uid('toast');
    setToasts((items) => [...items.slice(-3), { id, message, type }]);
    window.setTimeout(() => dismissToast(id), 4200);
  }, [dismissToast]);

  const bootstrap = useCallback(async () => {
    try {
      const status = await health();
      if (status.ok && status.mode === 'database') {
        setMode('database');
        setConnection({ label: 'PostgreSQL API', detail: status.database || 'Connected database', connected: true });
        try {
          const session = await api.me();
          setUser(sanitizeUser(session.user));
          const payload = await api.getState();
          setState(normalizeState(payload.state));
        } catch {
          setUser(null);
          setState(EMPTY_STATE);
        }
      } else {
        const local = await ensureLocalState();
        const session = readDemoSession();
        const found = local.users.find((entry) => entry.id === session?.userId && entry.active !== false);
        setUser(sanitizeUser(found || null));
        setState(local);
        if (status.ok) {
          setMode('demo');
          setConnection({ label: 'Local demo mode', detail: 'Browser-persisted data · no database connected', connected: false });
        } else {
          setMode('unavailable');
          setConnection({ label: 'Local demo · API unavailable', detail: 'Browser-persisted data · Express/PostgreSQL unavailable', connected: false });
        }
      }
    } catch (error) {
      setMode('unavailable');
      setConnection({ label: 'Local demo · offline', detail: error.message, connected: false });
      setState(await ensureLocalState().catch(() => EMPTY_STATE));
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const requireUser = useCallback(() => {
    if (!userRef.current) throw new Error('Your session has expired. Please sign in again.');
    return userRef.current;
  }, []);

  const commit = useCallback(async (rawOperations) => {
    const currentUser = requireUser();
    const operations = Array.isArray(rawOperations) ? rawOperations : [rawOperations];
    const currentState = stateRef.current || EMPTY_STATE;
    operations.forEach((operation) => {
      if (operation.internal || operation.collection === 'meta') return;
      const existing = currentState[operation.collection]?.find((row) => row.id === (operation.id || operation.record?.id));
      const permission = canMutateRecord(currentUser, currentState, operation.collection, operation.record || existing || {}, existing);
      if (!permission.allowed) throw new Error(permission.reason);
    });

    setBusy(true);
    try {
      if (modeRef.current === 'database') {
        const payload = await api.mutations(operations.map(({ internal, ...operation }) => operation));
        const next = normalizeState(payload.state);
        stateRef.current = next;
        setState(next);
        return next;
      }
      const next = applyOperations(currentState, operations);
      writeLocalState(next);
      stateRef.current = next;
      setState(next);
      return next;
    } finally {
      setBusy(false);
    }
  }, [requireUser]);

  const login = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
    if (!password) throw new Error('Enter your password.');
    setBusy(true);
    try {
      if (modeRef.current === 'database') {
        const payload = await api.login(normalizedEmail, password);
        const nextUser = sanitizeUser(payload.user);
        setUser(nextUser);
        userRef.current = nextUser;
        const payloadState = await api.getState();
        const next = normalizeState(payloadState.state);
        setState(next);
        stateRef.current = next;
      } else {
        const local = readLocalState() || await ensureLocalState();
        const found = local.users.find((entry) => entry.email.toLowerCase() === normalizedEmail);
        const credential = local.credentials.find((entry) => entry.userId === found?.id);
        if (!found || found.active === false || !credential || !(await verifyDemoPassword(password, credential))) {
          throw new Error('Incorrect email or password.');
        }
        const nextUser = sanitizeUser(found);
        writeDemoSession(nextUser);
        setUser(nextUser);
        userRef.current = nextUser;
        setState(local);
        stateRef.current = local;
      }
      return userRef.current;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (modeRef.current === 'database') {
      try { await api.logout(); } catch { /* clear local session regardless */ }
    }
    clearDemoSession();
    setUser(null);
    userRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      if (modeRef.current === 'database' && userRef.current) {
        const payload = await api.getState();
        const next = normalizeState(payload.state);
        setState(next);
        stateRef.current = next;
      } else {
        const next = readLocalState() || await ensureLocalState();
        setState(next);
        stateRef.current = next;
      }
      return stateRef.current;
    } finally {
      setBusy(false);
    }
  }, []);

  const setTheme = useCallback((nextTheme) => {
    const value = nextTheme === 'dark' ? 'dark' : 'light';
    setThemeState(value);
    writeTheme(value);
  }, []);

  const savePreferences = useCallback(async (preferences = {}) => {
    requireUser();
    const existing = stateRef.current.meta || EMPTY_STATE.meta;
    const merged = {
      ...existing,
      preferences: { ...existing.preferences, ...(preferences.preferences || {}) },
      dashboard: { ...existing.dashboard, ...(preferences.dashboard || {}) },
    };
    if (preferences.preferences?.theme) setTheme(preferences.preferences.theme);
    if (modeRef.current === 'database') {
      const payload = await api.savePreferences({ preferences: merged.preferences, dashboard: merged.dashboard });
      const next = normalizeState(payload.state || payload);
      setState(next);
      stateRef.current = next;
      return next;
    }
    const next = applyOperations(stateRef.current, [{ collection: 'meta', action: 'update', record: { preferences: merged.preferences, dashboard: merged.dashboard }, internal: true }]);
    writeLocalState(next);
    setState(next);
    stateRef.current = next;
    return next;
  }, [requireUser, setTheme]);

  const saveSettings = useCallback(async (meta) => {
    const currentUser = requireUser();
    if (!canChangeSettings(currentUser)) throw new Error('Only administrators can change institute settings.');
    if (modeRef.current === 'database') {
      const payload = await api.saveSettings(meta);
      const next = normalizeState(payload.state || payload);
      setState(next);
      stateRef.current = next;
      return next;
    }
    const next = applyOperations(stateRef.current, [{ collection: 'meta', action: 'update', record: meta, internal: true }]);
    writeLocalState(next);
    setState(next);
    stateRef.current = next;
    return next;
  }, [requireUser]);

  const saveUser = useCallback(async (record, password) => {
    const currentUser = requireUser();
    if (!canManageUsers(currentUser)) throw new Error('Only administrators can manage users.');
    const clean = { ...record };
    delete clean.password;
    delete clean.passwordHash;
    delete clean.passwordSalt;
    if (!clean.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email || '')) throw new Error('A valid name and email are required.');
    if (!clean.role) throw new Error('Select a role.');
    if (!clean.id && !password) throw new Error('A password is required for a new user.');
    if (password && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) throw new Error('Password must be at least 8 characters and include a letter and a number.');

    if (modeRef.current === 'database') {
      await api.saveUser({ ...clean, password });
      await refresh();
      return;
    }
    const isNew = !clean.id;
    const id = clean.id || uid('USER');
    const userRecord = { ...clean, id, email: clean.email.trim().toLowerCase(), active: clean.active !== false };
    const derived = password ? await derivePassword(password) : null;
    const credentialRecord = derived ? { id: `CRED-${id}`, userId: id, ...derived } : null;
    const operations = [
      { collection: 'users', action: isNew ? 'create' : 'update', record: userRecord, id, internal: true },
      ...(credentialRecord ? [{ collection: 'credentials', action: 'create', record: credentialRecord, internal: true }] : []),
    ];
    const next = applyOperations(stateRef.current, operations);
    if (credentialRecord) {
      next.credentials = [
        ...next.credentials.filter((credential) => credential.userId !== id),
        credentialRecord,
      ];
    }
    if (currentUser.id === id) {
      const nextUser = sanitizeUser(userRecord);
      setUser(nextUser);
      userRef.current = nextUser;
    }
    writeLocalState(next);
    setState(next);
    stateRef.current = next;
    return userRecord;
  }, [refresh, requireUser]);

  const deleteUser = useCallback(async (id) => {
    const currentUser = requireUser();
    if (!canManageUsers(currentUser)) throw new Error('Only administrators can manage users.');
    if (currentUser.id === id) throw new Error('You cannot delete your own account.');
    if (modeRef.current === 'database') {
      await api.deleteUser(id);
      await refresh();
      return;
    }
    const next = applyOperations(stateRef.current, [
      { collection: 'users', action: 'delete', id, internal: true },
      { collection: 'credentials', action: 'delete', id: `CRED-${id}`, internal: true },
    ]);
    next.credentials = next.credentials.filter((credential) => credential.userId !== id);
    writeLocalState(next);
    setState(next);
    stateRef.current = next;
  }, [refresh, requireUser]);

  const saveProfile = useCallback(async (profile) => {
    const currentUser = requireUser();
    if (!profile.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || '')) throw new Error('A valid name and email are required.');
    if (modeRef.current === 'database') {
      const payload = await api.saveProfile(profile);
      const nextUser = sanitizeUser(payload.user);
      setUser(nextUser);
      userRef.current = nextUser;
      await refresh();
      return nextUser;
    }
    const nextUser = sanitizeUser({ ...currentUser, ...profile, email: profile.email.trim().toLowerCase() });
    const next = applyOperations(stateRef.current, [{ collection: 'users', action: 'update', id: currentUser.id, record: nextUser, internal: true }]);
    setUser(nextUser);
    userRef.current = nextUser;
    writeLocalState(next);
    setState(next);
    stateRef.current = next;
    return nextUser;
  }, [refresh, requireUser]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const currentUser = requireUser();
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) throw new Error('New password must be at least 8 characters and include a letter and a number.');
    if (modeRef.current === 'database') {
      await api.changePassword(currentPassword, newPassword);
      return;
    }
    const local = stateRef.current;
    const credential = local.credentials.find((entry) => entry.userId === currentUser.id);
    if (!credential || !(await verifyDemoPassword(currentPassword, credential))) throw new Error('Current password is incorrect.');
    const derived = await derivePassword(newPassword);
    const credentialId = credential.id || `CRED-${currentUser.id}`;
    const next = applyOperations(local, [{
      collection: 'credentials', action: 'update', id: credentialId,
      record: { ...derived, id: credentialId, userId: currentUser.id }, internal: true,
    }]);
    next.credentials = next.credentials.map((entry) => entry.userId === currentUser.id
      ? { ...entry, ...derived, id: credentialId }
      : entry);
    writeLocalState(next);
    setState(next);
    stateRef.current = next;
  }, [requireUser]);

  const resetDemoData = useCallback(async () => {
    if (modeRef.current === 'database') throw new Error('Demo reset is only available in local browser mode.');
    if (!isAdmin(requireUser())) throw new Error('Only administrators can reset demo data.');
    clearLocalState();
    clearDemoSession();
    const next = await ensureLocalState();
    setState(next);
    stateRef.current = next;
    setUser(null);
    userRef.current = null;
  }, [requireUser]);

  const canWrite = useCallback((collection, record = {}, existingRecord = null) => {
    return canMutateRecord(userRef.current, stateRef.current, collection, record, existingRecord).allowed;
  }, []);

  const value = useMemo(() => ({
    state, user, mode, connection, initializing, busy, theme, toasts,
    isDatabase: mode === 'database', isLocalDemo: mode !== 'database',
    isAdmin: isAdmin(user), isReadOnly: isReadOnly(user),
    notify, dismissToast, login, logout, refresh, commit, setTheme,
    savePreferences, saveSettings, saveUser, deleteUser, saveProfile, changePassword,
    resetDemoData, canWrite, canManageUsers: canManageUsers(user), canChangeSettings: canChangeSettings(user),
  }), [state, user, mode, connection, initializing, busy, theme, toasts, notify, dismissToast, login, logout, refresh, commit, setTheme, savePreferences, saveSettings, saveUser, deleteUser, saveProfile, changePassword, resetDemoData, canWrite]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

export default AppContext;
