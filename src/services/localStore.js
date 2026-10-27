import { createSeedState } from '../data/seed';
import { normalizeState } from '../lib/metrics';

export const STATE_KEY = 'edutrack.demo.state.v2';
export const SESSION_KEY = 'edutrack.demo.session.v2';
export const THEME_KEY = 'edutrack.theme.v2';

export function readLocalState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const state = normalizeState(JSON.parse(raw));
    let changed = false;
    state.credentials = state.credentials.map((credential) => {
      if (credential.id) return credential;
      changed = true;
      return { ...credential, id: `CRED-${credential.userId}` };
    });
    if (changed) writeLocalState(state);
    return state;
  } catch {
    return null;
  }
}

export function writeLocalState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export async function ensureLocalState() {
  const existing = readLocalState();
  if (existing) return existing;
  const seeded = normalizeState(await createSeedState());
  writeLocalState(seeded);
  return seeded;
}

export function clearLocalState() {
  localStorage.removeItem(STATE_KEY);
}

export function readDemoSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function writeDemoSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, email: user.email, createdAt: new Date().toISOString() }));
}

export function clearDemoSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function readTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function writeTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}
