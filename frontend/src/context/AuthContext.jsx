import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('hockey_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearStoredAuth = () => {
    localStorage.removeItem('hockey_token');
    localStorage.removeItem('hockey_user');
    setUser(null);
  };

  const refreshBootstrap = async () => {
    const res = await api.get('/bootstrap/status');
    setBootstrap(res.data);
    return res.data;
  };

  useEffect(() => {
    const init = async () => {
      try {
        const status = await refreshBootstrap();
        const savedStartupId = localStorage.getItem('hockey_startup_id');
        if (savedStartupId !== status.startupId) {
          clearStoredAuth();
          localStorage.setItem('hockey_startup_id', status.startupId);
        }

        const token = localStorage.getItem('hockey_token');
        if (token) {
          const res = await api.get('/auth/me');
          setUser(res.data);
        }
      } catch {
        clearStoredAuth();
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('hockey_token', res.data.token);
    localStorage.setItem('hockey_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    await refreshBootstrap();
    return res.data.user;
  };

  const logout = () => {
    clearStoredAuth();
  };

  const isAdmin = user?.role === 'admin';
  const isCaptain = user?.role === 'captain';
  const isMarqueur = user?.role === 'marqueur';
  const isAdminOrCaptain = isAdmin || isCaptain;
  const canEditGamesheet = isAdmin || isCaptain || isMarqueur;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, bootstrap, refreshBootstrap, isAdmin, isCaptain, isMarqueur, isAdminOrCaptain, canEditGamesheet }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
