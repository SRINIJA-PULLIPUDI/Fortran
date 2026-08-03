import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import PublicNav from './components/PublicNav';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProblemList from './pages/ProblemList';
import ProblemDetail from './pages/ProblemDetail';
import Profile from './pages/Profile';
import ContestList from './pages/ContestList';
import ContestDetail from './pages/ContestDetail';
import Leaderboard from './pages/Leaderboard';
import Submissions from './pages/Submissions';
import CreateContest from './pages/CreateContest';
import CreateProblem from './pages/CreateProblem';

// Pages that make sense both logged in (sidebar shell) and logged out
// (public top nav) -- problem list, contest list, leaderboard, profiles.
function FlexLayout({ children }) {
  const { user } = useAuth();
  if (user) return <AppShell>{children}</AppShell>;
  return (
    <>
      <PublicNav />
      <div>{children}</div>
    </>
  );
}

// Login/Register only make sense logged out -- bounce to the dashboard if
// there's already a session.
function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <>
      <PublicNav />
      <div>{children}</div>
    </>
  );
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

      <Route path="/problems" element={<FlexLayout><ProblemList /></FlexLayout>} />
      <Route path="/contests" element={<FlexLayout><ContestList /></FlexLayout>} />
      <Route path="/leaderboard" element={<FlexLayout><Leaderboard /></FlexLayout>} />
      <Route path="/profile/:userId" element={<FlexLayout><Profile /></FlexLayout>} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/problems/:code"
        element={
          <PrivateRoute>
            <AppShell>
              <ProblemDetail />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/contests/:id/problems/:code"
        element={
          <PrivateRoute>
            <AppShell>
              <ProblemDetail />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/contests/:id"
        element={
          <PrivateRoute>
            <AppShell>
              <ContestDetail />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/submissions"
        element={
          <PrivateRoute>
            <AppShell>
              <Submissions />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/new-contest"
        element={
          <AdminRoute>
            <AppShell>
              <CreateContest />
            </AppShell>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/new-problem"
        element={
          <AdminRoute>
            <AppShell>
              <CreateProblem />
            </AppShell>
          </AdminRoute>
        }
      />
    </Routes>
  );
}
