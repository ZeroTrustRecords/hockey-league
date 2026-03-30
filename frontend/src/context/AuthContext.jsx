import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('hockey_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hockey_token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { localStorage.removeItem('hockey_token'); localStorage.removeItem('hockey_user'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('hockey_token', res.data.token);
    localStorage.setItem('hockey_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('hockey_token');
    localStorage.removeItem('hockey_user');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isCaptain = user?.role === 'captain';
  const isAdminOrCaptain = isAdmin || isCaptain;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isCaptain, isAdminOrCaptain }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
