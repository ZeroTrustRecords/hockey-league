import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  LayoutDashboard, Users, Shield, Trophy, BarChart3, MessageSquare,
  Zap, FileText, Settings, LogOut, ChevronRight, Bell, Star,
  CalendarDays, MoreHorizontal, X, Lock, Eye, EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { to: '/players', icon: Users, label: 'Joueurs' },
  { to: '/teams', icon: Shield, label: 'Équipes' },
  { to: '/standings', icon: Trophy, label: 'Classement' },
  { to: '/stats', icon: BarChart3, label: 'Statistiques' },
  { to: '/schedule', icon: CalendarDays, label: 'Calendrier' },
  { to: '/playoffs', icon: Star, label: 'Éliminatoires' },
];

// ─── Inline login modal ───────────────────────────────────────────────────────
function LoginModal({ onClose }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(username, password);
      toast.success(`Connecté en tant que ${user.username}`);
      onClose();
    } catch {
      toast.error('Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <Lock size={18} className="text-blue-400" />
          </div>
          <div>
            <div className="text-white font-bold">Connexion administrateur</div>
            <div className="text-xs text-gray-500">Accès aux fonctions avancées</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nom d'utilisateur</label>
            <input
              className="input" autoFocus
              value={username} onChange={e => setUsername(e.target.value)}
              required placeholder="admin"
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="btn-primary w-full justify-center">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Desktop sidebar link ─────────────────────────────────────────────────────
function SidebarLink({ item, unreadCount }) {
  const location = useLocation();
  const isActive = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <NavLink to={item.to}
      className={isActive ? 'nav-link-active' : 'nav-link-inactive'}
      style={isActive
        ? { borderLeft: '3px solid #60a5fa', paddingLeft: 'calc(0.625rem - 3px)' }
        : { borderLeft: '3px solid transparent', paddingLeft: 'calc(0.625rem - 3px)' }}>
      <item.icon size={18} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && unreadCount > 0 && (
        <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {isActive && <ChevronRight size={14} className="opacity-60" />}
    </NavLink>
  );
}

// ─── Mobile bottom nav ────────────────────────────────────────────────────────
function BottomNav({ user, isAdmin, isMarqueur, unreadCount, onMoreOpen }) {
  const location = useLocation();

  const bottomItems = [
    { to: '/', icon: LayoutDashboard, label: 'Accueil', exact: true },
    { to: '/schedule', icon: CalendarDays, label: 'Calendrier' },
    { to: '/stats', icon: BarChart3, label: 'Stats' },
    // Messages only if logged in
    ...(user ? [{ to: '/messages', icon: MessageSquare, label: 'Messages', badge: true }] : []),
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-950 border-t border-gray-800 flex">
      {bottomItems.map(item => {
        const isActive = item.exact
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to);
        return (
          <NavLink key={item.to} to={item.to}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors relative ${isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
            <item.icon size={20} />
            <span>{item.label}</span>
            {item.badge && unreadCount > 0 && (
              <span className="absolute top-1.5 left-1/2 ml-2 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        );
      })}
      <button onClick={onMoreOpen}
        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
        <MoreHorizontal size={20} />
        <span>Plus</span>
      </button>
    </nav>
  );
}

// ─── Mobile "More" drawer ─────────────────────────────────────────────────────
function MoreDrawer({ user, isAdmin, isMarqueur, unreadCount, onClose, onLoginOpen }) {
  const location = useLocation();
  const { logout } = useAuth();

  const roleLabel = { admin: 'Administrateur', captain: 'Capitaine', marqueur: 'Marqueur', player: 'Joueur' };
  const roleColor  = { admin: 'text-yellow-400', captain: 'text-blue-400', marqueur: 'text-emerald-400', player: 'text-gray-400' };

  const items = [
    { to: '/players',   icon: Users,    label: 'Joueurs' },
    { to: '/teams',     icon: Shield,   label: 'Équipes' },
    { to: '/standings', icon: Trophy,   label: 'Classement' },
    { to: '/playoffs',  icon: Star,     label: 'Éliminatoires' },
    ...(user ? [{ to: '/messages', icon: MessageSquare, label: 'Messages', badge: true }] : []),
    ...(isAdmin || isMarqueur ? [{ to: '/gamesheet', icon: FileText, label: 'Feuille de match' }] : []),
    ...(isAdmin ? [
      { to: '/draft',  icon: Zap,      label: 'Repêchage' },
      { to: '/admin',  icon: Settings, label: 'Administration' },
    ] : []),
  ];

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-t-2xl border-t border-gray-700">

        {/* Header: user info (if logged in) OR login button (if not) */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}>
                {user.username[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-white">{user.username}</div>
                <div className={`text-xs ${roleColor[user.role] || 'text-gray-400'}`}>
                  {roleLabel[user.role] || user.role}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Navigation</div>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Nav grid */}
        <div className="p-4 grid grid-cols-3 gap-2">
          {items.map(item => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} onClick={onClose}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors relative ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}>
                <item.icon size={22} />
                <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                {item.badge && unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="px-4 pb-4 space-y-2">
          {user ? (
            <button onClick={() => { logout(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-800 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm font-medium">
              <LogOut size={16} /> Déconnexion
            </button>
          ) : (
            <button onClick={() => { onClose(); onLoginOpen(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600/20 transition-colors text-sm font-medium">
              <Lock size={16} /> Connexion administrateur
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function Layout() {
  const { user, logout, isAdmin, isMarqueur } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return; // Only fetch unread count when logged in
    const fetchUnread = () => {
      api.get('/messages/unread-count').then(res => setUnreadCount(res.data.count || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const roleLabel = { admin: 'Administrateur', captain: 'Capitaine', marqueur: 'Marqueur', player: 'Joueur' };
  const roleColor  = { admin: 'text-yellow-400', captain: 'text-blue-400', marqueur: 'text-emerald-400', player: 'text-gray-400' };

  // ── Desktop sidebar ─────────────────────────────────────────────────────────
  const sidebar = (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800" style={{ borderTop: '4px solid #3b82f6' }}>
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', boxShadow: '0 4px 14px 0 rgba(30, 64, 175, 0.5)' }}>
            🏒
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm leading-tight tracking-wide">LHMA</div>
            <div className="text-blue-400 text-xs font-medium uppercase tracking-wider">Ligue de Hockey</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <SidebarLink key={item.to} item={item} unreadCount={unreadCount} />
        ))}
        {/* Messages — logged-in only */}
        {user && (
          <SidebarLink item={{ to: '/messages', icon: MessageSquare, label: 'Messagerie', badge: true }} unreadCount={unreadCount} />
        )}
        {/* Admin/marqueur extras */}
        {(isAdmin || isMarqueur) && (
          <SidebarLink item={{ to: '/gamesheet', icon: FileText, label: 'Feuille de match' }} unreadCount={0} />
        )}
        {isAdmin && (
          <div className="pt-2 mt-2 border-t border-gray-800">
            <SidebarLink item={{ to: '/draft', icon: Zap, label: 'Repêchage' }} unreadCount={0} />
            <SidebarLink item={{ to: '/admin', icon: Settings, label: 'Administration' }} unreadCount={0} />
          </div>
        )}
      </nav>

      {/* Footer: user card if logged in, login button if not */}
      <div className="p-3 border-t border-gray-800">
        {user ? (
          <div className="flex items-center gap-3 p-2 rounded-lg"
            style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(17,24,39,0.8) 100%)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}>
              {user.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user.username}</div>
              <div className={`text-xs ${roleColor[user.role] || 'text-gray-400'}`}>
                {roleLabel[user.role] || user.role}
              </div>
            </div>
            <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Déconnexion">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => setLoginOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 border border-gray-800 hover:border-blue-500/30 transition-all">
            <Lock size={15} />
            <span>Connexion administrateur</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 flex-shrink-0 flex-col">
        {sidebar}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar — no hamburger */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏒</span>
            <span className="font-bold text-sm text-white">Ligue Hockey</span>
          </div>

          {user ? (
            /* Logged in: show bell */
            <div className="relative">
              <Bell size={20} className="text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
          ) : (
            /* Not logged in: small lock icon to open login modal */
            <button onClick={() => setLoginOpen(true)}
              className="p-2 text-gray-600 hover:text-blue-400 transition-colors"
              title="Connexion administrateur">
              <Lock size={18} />
            </button>
          )}
        </div>

        {/* Bottom nav (mobile) */}
        <BottomNav
          user={user} isAdmin={isAdmin} isMarqueur={isMarqueur}
          unreadCount={unreadCount} onMoreOpen={() => setMoreOpen(true)}
        />

        {/* More drawer (mobile) */}
        {moreOpen && (
          <MoreDrawer
            user={user} isAdmin={isAdmin} isMarqueur={isMarqueur}
            unreadCount={unreadCount}
            onClose={() => setMoreOpen(false)}
            onLoginOpen={() => setLoginOpen(true)}
          />
        )}

        {/* Login modal */}
        {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-0 max-w-7xl mx-auto animate-fade-in">
            <Outlet context={{ refreshUnread: () => api.get('/messages/unread-count').then(r => setUnreadCount(r.data.count || 0)) }} />
          </div>
        </main>
      </div>
    </div>
  );
}
