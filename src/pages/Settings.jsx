import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, Check, Database, Download, Eye, EyeOff, KeyRound, LockKeyhole, Monitor,
  Moon, Pencil, Plus, RefreshCcw, ShieldCheck, SlidersHorizontal, Sun, Trash2, UserCog, Users,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Card, CardHeader } from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import { DynamicForm, formInitialValues, validateForm } from '../components/ui/Field';
import { Avatar, ProgressBar } from '../components/ui/Details';
import { useApp } from '../context/AppContext';
import { getDashboardMetrics } from '../lib/metrics';
import { deepClone, downloadFile, formatDate, paginate } from '../lib/utils';

const ROLES = ['Admin', 'Trainer', 'Read-Only'];

const INSTITUTE_FIELDS = [
  { name: 'name', label: 'Institute name', required: true },
  { name: 'email', label: 'Contact email', type: 'email', required: true },
  { name: 'phone', label: 'Phone number', required: true },
  { name: 'website', label: 'Website' },
  { name: 'address', label: 'Address', type: 'textarea', span: 2, rows: 2 },
  { name: 'accreditation', label: 'Accreditation / registration', span: 2 },
];

const PROFILE_FIELDS = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'email', label: 'Email address', type: 'email', required: true },
  { name: 'phone', label: 'Phone number' },
  { name: 'role', label: 'Role', type: 'select', options: ROLES, disabled: true, hint: 'Only an administrator can change your role.' },
];

const USER_FIELDS = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'email', label: 'Email address', type: 'email', required: true, autoComplete: 'off' },
  { name: 'role', label: 'Role', type: 'select', required: true, options: ROLES },
  { name: 'phone', label: 'Phone number' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', placeholder: '8+ chars with a letter and number', help: 'Used only during authentication and never stored in plaintext.' },
  { name: 'active', label: 'Active account', type: 'checkbox', checkboxLabel: 'Allow this user to sign in' },
];

const PREFERENCE_FIELDS = [
  { name: 'pageSize', label: 'Rows per table page', type: 'select', options: [['5', '5 rows'], ['8', '8 rows'], ['10', '10 rows'], ['20', '20 rows']], required: true },
  { name: 'defaultPassingMarks', label: 'Default passing marks', type: 'number', min: 0, required: true },
  { name: 'dateFormat', label: 'Date format', type: 'select', options: [['DD MMM YYYY', '26 Oct 2026'], ['MM/DD/YYYY', '10/26/2026'], ['YYYY-MM-DD', '2026-10-26']], required: true },
  { name: 'showDemoLabel', label: 'Demo badge', type: 'checkbox', checkboxLabel: 'Show demo mode badge in header' },
  { name: 'compactTables', label: 'Compact tables', type: 'checkbox', checkboxLabel: 'Use reduced row height' },
];

const PERMISSION_MATRIX = [
  { area: 'View all records', Admin: 'Full', Trainer: 'Assigned batches', 'Read-Only': 'View' },
  { area: 'Students & attendance', Admin: 'Create / edit / delete', Trainer: 'Assigned batches', 'Read-Only': 'View only' },
  { area: 'Assessments & results', Admin: 'Create / edit / delete', Trainer: 'Assigned batches', 'Read-Only': 'View only' },
  { area: 'Tasks & trainer tasks', Admin: 'All records', Trainer: 'Own tasks', 'Read-Only': 'View only' },
  { area: 'Groups & syllabi', Admin: 'Create / edit / delete', Trainer: 'Assigned batches', 'Read-Only': 'View only' },
  { area: 'Batches & users', Admin: 'Manage', Trainer: 'View batches', 'Read-Only': 'View only' },
  { area: 'Institute settings', Admin: 'Manage', Trainer: 'No access', 'Read-Only': 'No access' },
];

export default function Settings() {
  const {
    state, user, theme, setTheme, connection, mode, notify, saveSettings, savePreferences,
    saveProfile, changePassword, saveUser, deleteUser, resetDemoData, canManageUsers,
    canChangeSettings, isDatabase,
  } = useApp();
  const [tab, setTab] = useState('profile');
  const [institute, setInstitute] = useState(state.meta.institute);
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', role: user?.role || '' });
  const [preferences, setPreferences] = useState(state.meta.preferences);
  const [dashboardCards, setDashboardCards] = useState(state.meta.dashboard.cards);
  const [saving, setSaving] = useState('');
  const [userModal, setUserModal] = useState(null);
  const [userValues, setUserValues] = useState({});
  const [userErrors, setUserErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [passwordValues, setPasswordValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => { setInstitute(state.meta.institute); }, [state.meta.institute]);
  useEffect(() => { setPreferences((current) => ({ ...current, ...state.meta.preferences, theme })); }, [state.meta.preferences, theme]);
  useEffect(() => { setDashboardCards(state.meta.dashboard.cards); }, [state.meta.dashboard.cards]);
  useEffect(() => { setProfile({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', role: user?.role || '' }); }, [user]);

  const allMetrics = useMemo(() => getDashboardMetrics(state), [state]);
  const userPagination = paginate(state.users, userPage, 8);

  const updateField = (setter) => (name, value) => {
    setter((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSave = async (key, action, successMessage) => {
    setSaving(key);
    try {
      await action();
      notify(successMessage, 'success');
      return true;
    } catch (error) {
      notify(error.message || 'Unable to save changes.', 'error');
      return false;
    } finally {
      setSaving('');
    }
  };

  const saveInstitute = () => {
    const validation = validateForm(INSTITUTE_FIELDS, institute);
    if (Object.keys(validation).length) { setErrors(validation); notify('Please correct the highlighted institute fields.', 'error'); return; }
    handleSave('institute', () => saveSettings({ ...state.meta, institute }), 'Institute profile saved.');
  };

  const saveProfileForm = () => {
    const validation = validateForm(PROFILE_FIELDS.slice(0, 3), profile);
    if (Object.keys(validation).length) { setErrors(validation); notify('Please correct the highlighted profile fields.', 'error'); return; }
    handleSave('profile', () => saveProfile({ name: profile.name, email: profile.email, phone: profile.phone }), 'User profile updated.');
  };

  const saveAppPreferences = () => {
    if (!canChangeSettings) { notify('Only administrators can change application-wide preferences.', 'error'); return; }
    const validation = validateForm(PREFERENCE_FIELDS, preferences);
    if (Object.keys(validation).length) { setErrors(validation); notify('Please correct the highlighted preferences.', 'error'); return; }
    handleSave('preferences', () => saveSettings({ ...state.meta, preferences: { ...preferences, theme } }), 'Application preferences saved.');
  };

  const saveDashboardPreferences = () => handleSave('dashboard', () => savePreferences({ dashboard: { cards: dashboardCards, order: [...dashboardCards, ...state.meta.dashboard.order.filter((id) => !dashboardCards.includes(id))] } }), 'Dashboard preferences saved.');

  const handleTheme = async (value) => {
    setTheme(value);
    setPreferences((current) => ({ ...current, theme: value }));
    try { await savePreferences({ preferences: { theme: value } }); notify(`${value === 'dark' ? 'Dark' : 'Light'} mode enabled.`, 'success'); }
    catch (error) { notify(error.message || 'Could not save theme.', 'error'); }
  };

  const handlePasswordChange = async () => {
    const nextErrors = {};
    if (!passwordValues.currentPassword) nextErrors.currentPassword = 'Current password is required.';
    if (passwordValues.newPassword.length < 8) nextErrors.newPassword = 'Use at least 8 characters.';
    if (passwordValues.newPassword !== passwordValues.confirmPassword) nextErrors.confirmPassword = 'New passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const changed = await handleSave('password', () => changePassword(passwordValues.currentPassword, passwordValues.newPassword), 'Password changed successfully.');
    if (changed) setPasswordValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const openUserModal = (record = null) => {
    setUserModal({ mode: record ? 'edit' : 'create', record });
    setUserValues(formInitialValues(USER_FIELDS, record ? { ...record, password: '' } : { role: 'Trainer', active: true, password: '' }));
    setUserErrors({});
    setShowPasswords(false);
  };

  const handleUserSave = async () => {
    const fields = USER_FIELDS.map((field) => field.name === 'password' ? { ...field, required: userModal.mode === 'create' } : field);
    const validation = validateForm(fields, userValues, (values) => {
      const custom = {};
      if (values.password && (values.password.length < 8 || !/[A-Za-z]/.test(values.password) || !/\d/.test(values.password))) custom.password = 'Use at least 8 characters with a letter and number.';
      if (state.users.some((entry) => entry.email.toLowerCase() === values.email.toLowerCase() && entry.id !== userModal.record?.id)) custom.email = 'This email is already in use.';
      return custom;
    });
    setUserErrors(validation);
    if (Object.keys(validation).length) { notify('Please correct the highlighted user fields.', 'error'); return; }
    setSaving('user');
    try {
      const { password, ...userRecord } = userValues;
      await saveUser({ ...userRecord, id: userModal.record?.id }, password || undefined);
      notify(`User ${userModal.mode === 'create' ? 'created' : 'updated'} successfully.`, 'success');
      setUserModal(null);
    } catch (error) {
      notify(error.message || 'Unable to save user.', 'error');
    } finally {
      setSaving('');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setSaving('delete-user');
    try {
      await deleteUser(deleteTarget.id);
      notify('User deleted.', 'success');
      setDeleteTarget(null);
    } catch (error) {
      notify(error.message || 'Unable to delete user.', 'error');
    } finally {
      setSaving('');
    }
  };

  const handleReset = async () => {
    setSaving('reset');
    try {
      await resetDemoData();
      notify('Demo data reset. Sign in again with the demo credentials.', 'success');
      setResetOpen(false);
      window.setTimeout(() => window.location.assign('/login'), 600);
    } catch (error) {
      notify(error.message || 'Unable to reset demo data.', 'error');
    } finally {
      setSaving('');
    }
  };

  const exportSnapshot = () => {
    const safe = deepClone(state);
    delete safe.credentials;
    safe.users = safe.users.map(({ passwordHash, passwordSalt, passwordIterations, passwordAlgorithm, ...item }) => item);
    downloadFile('edutrack-data-snapshot.json', JSON.stringify(safe, null, 2), 'application/json;charset=utf-8;');
    notify('Sanitized data snapshot downloaded.', 'success');
  };

  return (
    <div className="settings-page entity-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Settings</span>
          <h2>Settings</h2>
          <p>Manage your institute, users, role access and workspace preferences.</p>
        </div>
        <Button variant="secondary" icon={Download} onClick={exportSnapshot}>Export Data Snapshot</Button>
      </div>

      <Card className={`integration-card ${connection.connected ? 'connected' : ''}`}>
        <div className="integration-icon">{connection.connected ? <Database size={20} /> : <Monitor size={20} />}</div>
        <div>
          <strong>{connection.label}</strong>
          <p>{connection.detail || (connection.connected ? 'JWT, hashed passwords and server-side role checks are active.' : 'No database or hosted authentication service is connected in this environment.')}</p>
        </div>
        <Badge tone={connection.connected ? 'success' : 'warning'} dot>{connection.connected ? 'Connected' : mode === 'database' ? 'Session required' : 'Local persistence'}</Badge>
      </Card>

      <Tabs
        tabs={[
          { value: 'profile', label: 'Profiles', icon: Building2 },
          { value: 'users', label: 'Users & trainers', icon: Users },
          { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
          { value: 'access', label: 'Access & data', icon: ShieldCheck },
        ]}
        value={tab}
        onChange={setTab}
        className="settings-tabs"
      />

      {tab === 'profile' && (
        <div className="settings-grid">
          <Card>
            <CardHeader title="Institute profile" subtitle="Used across records, exports and reports." action={!canChangeSettings && <Badge tone="neutral">Admin only</Badge>} />
            <DynamicForm fields={INSTITUTE_FIELDS.map((field) => ({ ...field, disabled: field.disabled || !canChangeSettings }))} values={institute} onChange={updateField(setInstitute)} errors={errors} />
            <div className="settings-actions"><Button variant="primary" onClick={saveInstitute} loading={saving === 'institute'} disabled={!canChangeSettings}>Save Institute Profile</Button></div>
          </Card>
          <Card>
            <CardHeader title="Your profile" subtitle={`Signed in as ${user?.role || 'user'}.`} />
            <div className="profile-summary"><Avatar name={user?.name} size="lg" /><div><strong>{user?.name}</strong><span>{user?.email}</span><Badge tone="info">{user?.role}</Badge></div></div>
            <DynamicForm fields={PROFILE_FIELDS} values={profile} onChange={updateField(setProfile)} errors={errors} />
            <div className="settings-actions"><Button variant="primary" onClick={saveProfileForm} loading={saving === 'profile'}>Save User Profile</Button></div>
          </Card>
          <Card className="full-span">
            <CardHeader title="Change password" subtitle="Passwords are stored only as salted password derivatives or a bcrypt hash on the server." action={<LockKeyhole size={18} />} />
            <div className="password-grid">
              {[
                ['currentPassword', 'Current password'],
                ['newPassword', 'New password'],
                ['confirmPassword', 'Confirm new password'],
              ].map(([name, label]) => (
                <div className="form-field" key={name}>
                  <label className="field-label" htmlFor={`pwd-${name}`}><span>{label}</span></label>
                  <div className="input-with-icon">
                    <KeyRound size={15} />
                    <input id={`pwd-${name}`} className={`form-control ${errors[name] ? 'has-error' : ''}`} type={showPasswords ? 'text' : 'password'} value={passwordValues[name]} autoComplete="new-password" onChange={(event) => { setPasswordValues((current) => ({ ...current, [name]: event.target.value })); setErrors((current) => ({ ...current, [name]: undefined })); }} />
                    <button type="button" className="password-toggle" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}>{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                  {errors[name] && <span className="field-error">{errors[name]}</span>}
                </div>
              ))}
            </div>
            <div className="settings-actions"><Button variant="primary" onClick={handlePasswordChange} loading={saving === 'password'}>Update Password</Button></div>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <Card padded={false}>
          <CardHeader
            title="User and trainer management"
            subtitle={`${state.users.length} accounts · ${state.users.filter((item) => item.role === 'Trainer').length} trainers`}
            action={<Button variant="primary" icon={Plus} onClick={() => openUserModal()} disabled={!canManageUsers}>Add User</Button>}
          />
          {!canManageUsers && <div className="form-alert info settings-alert"><ShieldCheck size={16} /> Only administrators can create, edit or delete user accounts.</div>}
          <DataTable
            columns={[
              { key: 'name', label: 'User', render: (item) => <div className="primary-cell"><Avatar name={item.name} size="sm" /><span><strong>{item.name}</strong><small>{item.email}</small></span></div> },
              { key: 'role', label: 'Role', render: (item) => <Badge tone={item.role === 'Admin' ? 'info' : item.role === 'Trainer' ? 'success' : 'neutral'}>{item.role}</Badge> },
              { key: 'phone', label: 'Phone' },
              { key: 'createdAt', label: 'Created', render: (item) => formatDate(item.createdAt) },
              { key: 'active', label: 'Account', render: (item) => <Badge tone={item.active === false ? 'danger' : 'success'} dot>{item.active === false ? 'Inactive' : 'Active'}</Badge> },
              {
                key: '_actions', label: '', sortable: false,
                render: (item) => <div className="row-actions">
                  <button type="button" className="icon-action" aria-label={`Edit ${item.name}`} disabled={!canManageUsers} onClick={() => openUserModal(item)}><Pencil size={15} /></button>
                  <button type="button" className="icon-action danger" aria-label={`Delete ${item.name}`} disabled={!canManageUsers || item.id === user?.id} onClick={() => setDeleteTarget(item)}><Trash2 size={15} /></button>
                </div>,
              },
            ]}
            rows={userPagination.rows}
            pagination={{ ...userPagination, onPage: setUserPage }}
            emptyTitle="No users"
            emptyDescription="Add an administrator, trainer or read-only user."
          />
        </Card>
      )}

      {tab === 'preferences' && (
        <div className="settings-grid">
          <Card>
            <CardHeader title="Theme preferences" subtitle="Applies immediately and persists in this browser." />
            <div className="theme-options">
              <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => handleTheme('light')}>
                <span className="theme-preview light"><Sun size={20} /></span>
                <span><strong>Light</strong><small>Clean white workspace</small></span>
                {theme === 'light' && <Check size={17} />}
              </button>
              <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => handleTheme('dark')}>
                <span className="theme-preview dark"><Moon size={20} /></span>
                <span><strong>Dark</strong><small>Reduced-light workspace</small></span>
                {theme === 'dark' && <Check size={17} />}
              </button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Dashboard preferences" subtitle="Choose which live metric cards appear." />
            <div className="dashboard-pref-list">
              {allMetrics.map((metric) => {
                const checked = dashboardCards.includes(metric.id);
                return (
                  <label key={metric.id} className={`dashboard-pref-item ${checked ? 'selected' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => setDashboardCards((items) => checked ? items.filter((id) => id !== metric.id) : [...items, metric.id])} />
                    <span><strong>{metric.label}</strong><small>{metric.description}</small></span>
                    <em>{metric.value}</em>
                  </label>
                );
              })}
            </div>
            <div className="settings-actions"><Button variant="primary" onClick={saveDashboardPreferences} loading={saving === 'dashboard'} disabled={!dashboardCards.length}>Save Dashboard Cards</Button></div>
          </Card>
          <Card className="full-span">
            <CardHeader title="Application preferences" subtitle="Shared defaults for tables, dates and assessments." action={!canChangeSettings && <Badge tone="neutral">Admin only</Badge>} />
            <DynamicForm fields={PREFERENCE_FIELDS.map((field) => ({ ...field, disabled: !canChangeSettings }))} values={preferences} onChange={updateField(setPreferences)} errors={errors} />
            <div className="settings-actions"><Button variant="primary" onClick={saveAppPreferences} loading={saving === 'preferences'} disabled={!canChangeSettings}>Save Application Preferences</Button></div>
          </Card>
        </div>
      )}

      {tab === 'access' && (
        <div className="settings-grid">
          <Card className="full-span">
            <CardHeader title="Roles and permissions" subtitle="Server-side authorization is applied to every database mutation." action={<Badge tone="info">RBAC</Badge>} />
            <div className="table-scroll">
              <table className="data-table permission-table">
                <thead><tr><th>Area</th><th>Admin</th><th>Trainer</th><th>Read-Only</th></tr></thead>
                <tbody>{PERMISSION_MATRIX.map((row) => <tr key={row.area}><td data-label="Area"><strong>{row.area}</strong></td><td data-label="Admin">{row.Admin}</td><td data-label="Trainer">{row.Trainer}</td><td data-label="Read-Only">{row['Read-Only']}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="permission-note"><LockKeyhole size={16} /><span>In PostgreSQL mode, an HTTP-only JWT session identifies the user and Express verifies role plus record scope before any write. Local demo mode reuses the same permission helper in the browser, but is explicitly not production-grade authentication.</span></div>
          </Card>
          <Card>
            <CardHeader title="Data portability" subtitle="Export a sanitized JSON snapshot of application records." />
            <div className="data-actions">
              <Button variant="secondary" icon={Download} onClick={exportSnapshot}>Download JSON Snapshot</Button>
              <p>Password hashes, salts and credentials are excluded from the snapshot.</p>
            </div>
            <div className="storage-meter">
              <div><span>Records in workspace</span><strong>{state.students.length + state.batches.length + state.attendance.length + state.assessments.length + state.tasks.length + state.groups.length + state.syllabi.length}</strong></div>
              <ProgressBar value={Math.min(100, Math.round((state.students.length / 30) * 100))} label="Demo dataset size" compact />
            </div>
          </Card>
          <Card>
            <CardHeader title="Demo data controls" subtitle="Available only in browser-persisted demo mode." />
            <div className="form-alert info"><Database size={16} /><span>{isDatabase ? 'A live PostgreSQL database is connected. Reset is disabled to protect real records.' : 'Sample records are stored in localStorage. Reset removes all changes made in this browser.'}</span></div>
            <div className="settings-actions">
              <Button variant="danger" icon={RefreshCcw} onClick={() => setResetOpen(true)} disabled={isDatabase || !canChangeSettings}>Reset Demo Data</Button>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(userModal)}
        onClose={() => setUserModal(null)}
        title={userModal?.mode === 'edit' ? 'Edit user' : 'Add user'}
        subtitle="Passwords are hashed before storage; never shown again."
        footer={<><Button variant="secondary" onClick={() => setUserModal(null)}>Cancel</Button><Button variant="primary" onClick={handleUserSave} loading={saving === 'user'}>Save User</Button></>}
      >
        <DynamicForm
          fields={USER_FIELDS.map((field) => ({
            ...field,
            ...(field.name === 'password' ? { required: userModal?.mode === 'create', type: showPasswords ? 'text' : 'password', help: userModal?.mode === 'edit' ? 'Leave blank to keep the current password.' : field.help } : {}),
          }))}
          values={userValues}
          onChange={(name, value) => { setUserValues((current) => ({ ...current, [name]: value })); setUserErrors((current) => ({ ...current, [name]: undefined })); }}
          errors={userErrors}
        />
        <button type="button" className="text-button compact" onClick={() => setShowPasswords((value) => !value)}>{showPasswords ? 'Hide' : 'Show'} password field</button>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        loading={saving === 'delete-user'}
        message={`Delete user “${deleteTarget?.name}”? Their account will no longer be able to sign in.`}
      />
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        loading={saving === 'reset'}
        title="Reset all demo data?"
        message="All browser-persisted changes will be replaced with the original sample dataset. You will be signed out."
        confirmLabel="Reset data"
      />
    </div>
  );
}
