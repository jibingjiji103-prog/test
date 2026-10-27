import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import Brand, { BrandMark } from '../components/layout/Brand';
import Button from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { DEMO_PASSWORD, demoAccounts } from '../data/seed';

export default function Login() {
  const { login, user, initializing, connection, mode, busy, notify } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState(mode === 'database' ? '' : 'admin@edutrack.demo');
  const [password, setPassword] = useState(mode === 'database' ? '' : DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode === 'database') {
      setEmail('');
      setPassword('');
      setErrors({});
    }
  }, [mode]);

  if (!initializing && user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const signedIn = await login(email, password);
      notify(`Welcome back, ${signedIn.name.split(' ')[0]}`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand-panel">
        <Brand />
        <div className="login-hero">
          <span className="eyebrow">Training institute operations, simplified</span>
          <h1>One calm workspace for every cohort.</h1>
          <p>Track admissions, attendance, assessments, trainer work and curriculum progress without losing the human details.</p>
          <div className="login-feature-list">
            <span><BrandMark size={24} /> Live institute overview</span>
            <span><ShieldCheck size={20} /> Role-aware access</span>
            <span><LockKeyhole size={20} /> Password-derived credentials</span>
          </div>
        </div>
        <div className="login-visual" aria-hidden="true">
          <div className="visual-card">
            <span>Active learners</span><strong>21</strong><small>+3 this month</small>
          </div>
          <div className="visual-card offset">
            <span>Batch health</span><strong>92%</strong><small>Attendance · Last 30 days</small>
          </div>
        </div>
        <p className="login-brand-footer">EduTrack CRM · Original demo product</p>
      </div>

      <div className="login-form-panel">
        <div className="login-form-wrap">
          <span className={`mode-banner ${connection.connected ? 'connected' : ''}`}>
            <span className="status-dot" />
            {initializing ? 'Checking services…' : connection.label}
            <small>{connection.detail || 'Secure server session'}</small>
          </span>
          <div className="login-heading">
            <h2>Sign in to your workspace</h2>
            <p>Use your institute account to continue.</p>
          </div>

          <form className="login-form" onSubmit={submit} noValidate>
            {errors.form && <div className="form-alert error" role="alert">{errors.form}</div>}
            <div className="form-field">
              <label className="field-label" htmlFor="login-email"><span>Email address</span></label>
              <div className="input-with-icon">
                <Mail size={16} />
                <input id="login-email" className={`form-control ${errors.email ? 'has-error' : ''}`} type="email" value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} placeholder="you@institute.com" />
              </div>
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
            <div className="form-field">
              <label className="field-label" htmlFor="login-password"><span>Password</span></label>
              <div className="input-with-icon">
                <LockKeyhole size={16} />
                <input id="login-password" className={`form-control ${errors.password ? 'has-error' : ''}`} type={showPassword ? 'text' : 'password'} value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>
            <Button type="submit" variant="primary" size="lg" className="login-submit" loading={submitting || busy} iconRight={ArrowRight}>Sign In</Button>
          </form>

          {mode !== 'database' && (
            <div className="demo-accounts">
              <div className="demo-accounts-head">
                <strong>Local demo accounts</strong>
                <span>Password: <code>{DEMO_PASSWORD}</code></span>
              </div>
              <div className="demo-account-grid">
                {demoAccounts.map((account) => (
                  <button type="button" key={account.email} className={email === account.email ? 'active' : ''} onClick={() => { setEmail(account.email); setPassword(DEMO_PASSWORD); setErrors({}); }}>
                    <strong>{account.label}</strong>
                    <small>{account.email}</small>
                  </button>
                ))}
              </div>
              <p className="demo-disclaimer">Demo mode stores salted password derivatives and sample records in this browser only. It is not production authentication.</p>
            </div>
          )}
          <p className="login-note">Protected routes · role-based permissions · persistent records</p>
        </div>
      </div>
    </div>
  );
}
