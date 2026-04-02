import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import PlayerProfile from './pages/PlayerProfile';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Standings from './pages/Standings';
import Stats from './pages/Stats';
import Messages from './pages/Messages';
import Draft from './pages/Draft';
import Playoffs from './pages/Playoffs';
import GameSheet from './pages/GameSheet';
import Schedule from './pages/Schedule';
import Admin from './pages/Admin';

// Only admin may access — silently redirects public users to home
function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

// Admin or marqueur only
function GamesheetRoute({ children }) {
  const { isAdmin, isMarqueur } = useAuth();
  if (!isAdmin && !isMarqueur) return <Navigate to="/" replace />;
  return children;
}

function MessagesRoute({ children }) {
  const { user, isMarqueur } = useAuth();
  if (!user || isMarqueur) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { loading } = useAuth();

  // Wait for token validation before rendering (prevents flash)
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="text-4xl mb-4">🏒</div>
        <div className="text-gray-400 text-sm animate-pulse">Chargement...</div>
      </div>
    </div>
  );

  return (
    <Routes>
      {/* All pages are public — no login required to browse */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="players" element={<Players />} />
        <Route path="players/:id" element={<PlayerProfile />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamDetail />} />
        <Route path="standings" element={<Standings />} />
        <Route path="stats" element={<Stats />} />
        <Route path="playoffs" element={<Playoffs />} />
        <Route path="schedule" element={<Schedule />} />
        {/* Messages requires login — handled inside the page */}
        <Route path="messages" element={<MessagesRoute><Messages /></MessagesRoute>} />
        {/* Admin-only routes */}
        <Route path="gamesheet" element={<GamesheetRoute><GameSheet /></GamesheetRoute>} />
        <Route path="gamesheet/:id" element={<GamesheetRoute><GameSheet /></GamesheetRoute>} />
        <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="draft" element={<AdminRoute><Draft /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
