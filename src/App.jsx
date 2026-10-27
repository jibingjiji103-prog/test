import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Assessments from './pages/Assessments';
import Tasks from './pages/Tasks';
import TrainerTasks from './pages/TrainerTasks';
import Groups from './pages/Groups';
import Syllabi from './pages/Syllabi';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function LoadingScreen() {
  return (
    <div className="app-loading">
      <div className="loading-mark"><LoaderCircle className="spin" size={25} /></div>
      <strong>EduTrack CRM</strong>
      <span>Preparing your workspace…</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, initializing } = useApp();
  const location = useLocation();
  if (initializing) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function AppRoutes() {
  const { initializing, user } = useApp();
  const location = useLocation();
  useEffect(() => {
    document.title = location.pathname === '/login' ? 'Sign in · EduTrack CRM' : 'EduTrack CRM';
  }, [location.pathname]);
  if (initializing) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="batches" element={<Batches />} />
        <Route path="students" element={<Students />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="trainer-tasks" element={<TrainerTasks />} />
        <Route path="groups" element={<Groups />} />
        <Route path="syllabi" element={<Syllabi />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('EduTrack CRM runtime error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <span><AlertTriangle size={26} /></span>
          <h1>Something interrupted the workspace</h1>
          <p>{this.state.error.message || 'An unexpected runtime error occurred.'}</p>
          <button type="button" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
