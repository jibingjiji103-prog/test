import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

const HEALTH_RESPONSE = {
  status: 'ok',
  mode: 'unconfigured',
  database: null,
  message: 'No DATABASE_URL configured; frontend uses browser demo mode.',
};

function mockFetch() {
  return vi.fn(async (url) => {
    if (String(url).includes('/api/health')) {
      return new Response(JSON.stringify(HEALTH_RESPONSE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

const NAV_ROUTES = [
  ['Dashboard', '/dashboard'],
  ['Batches', '/batches'],
  ['Students', '/students'],
  ['Attendance', '/attendance'],
  ['Assessments', '/assessments'],
  ['Tasks', '/tasks'],
  ['Trainer Tasks', '/trainer-tasks'],
  ['Groups', '/groups'],
  ['Syllabi', '/syllabi'],
  ['Reports', '/reports'],
  ['Settings', '/settings'],
];

describe('EduTrack CRM browser smoke test', () => {
  let consoleErrors;
  let consoleSpy;
  let fetchSpy;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/');
    fetchSpy = mockFetch();
    vi.stubGlobal('fetch', fetchSpy);
    consoleErrors = [];
    consoleSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      consoleErrors.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' '));
    });
  });

  afterEach(() => {
    consoleSpy?.mockRestore();
    vi.unstubAllGlobals();
  });

  it('signs in, opens every route, persists a CRUD change and logs out', async () => {
    const user = userEvent.setup();
    const first = render(<App />);

    expect(await screen.findByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /welcome back, maya/i })).toBeInTheDocument();
    expect(screen.getByText('Total Admissions')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('Active Batches')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    for (const [label, path] of NAV_ROUTES) {
      await user.click(screen.getByRole('link', { name: label, exact: true }));
      await waitFor(() => expect(window.location.pathname).toBe(path));
      await waitFor(() => expect(screen.getAllByText(label, { exact: true }).length).toBeGreaterThan(0));
    }

    await user.click(screen.getByRole('link', { name: 'Batches', exact: true }));
    await waitFor(() => expect(window.location.pathname).toBe('/batches'));
    await user.click(screen.getByRole('button', { name: /add batch/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/batch name/i), { target: { value: 'Test Cloud Cohort' } });
    fireEvent.change(screen.getByLabelText(/course name/i), { target: { value: 'Cloud Native' } });
    fireEvent.change(screen.getByLabelText(/assigned trainer/i), { target: { value: 'USER-AARAV' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-12-15' } });
    await user.click(screen.getByRole('button', { name: /save record/i }));

    expect(await screen.findByText(/batch created successfully/i)).toBeInTheDocument();
    expect(await screen.findByText('Test Cloud Cohort')).toBeInTheDocument();

    first.unmount();
    window.history.pushState({}, '', '/');
    const second = render(<App />);
    expect(await screen.findByRole('heading', { name: /welcome back, maya/i })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Batches', exact: true }));
    await waitFor(() => expect(window.location.pathname).toBe('/batches'));
    fireEvent.change(await screen.findByPlaceholderText(/search batches/i), { target: { value: 'Test Cloud Cohort' } });
    expect(await screen.findByText('Test Cloud Cohort')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(await screen.findByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();

    const relevantErrors = consoleErrors.filter((message) => ![
      /width\(0\)/i,
      /height\(0\)/i,
      /not implemented: htmlcanvaselement/i,
      /cssstyleDeclaration/i,
    ].some((pattern) => pattern.test(message)));
    expect(relevantErrors).toEqual([]);
    second.unmount();
  }, 30000);

  it('changes the demo password and signs in with the new password', async () => {
    const user = userEvent.setup();
    const view = render(<App />);

    expect(await screen.findByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /welcome back, maya/i })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Settings', exact: true }));
    await waitFor(() => expect(window.location.pathname).toBe('/settings'));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Demo@12345' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewDemo@123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewDemo@123' } });
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/password changed successfully/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(await screen.findByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'admin@edutrack.demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'NewDemo@123' } });
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /welcome back, maya/i })).toBeInTheDocument();
    view.unmount();
  }, 30000);
});
