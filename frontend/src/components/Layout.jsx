import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  LayoutDashboard, Users, Shield, Trophy, BarChart3, MessageSquare,
  Zap, FileText, Settings, Menu, X, LogOut, ChevronRight, Bell, Star, CalendarDays
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { to: '/players', icon: Users, label: 'Joueurs' },
  { to: '/teams', icon: Shield, label: 'Équipes' },
  { to: '/standings', icon: Trophy, label: 'Classement' },
  { to: '/stats', icon: BarChart3, label: 'Statistiques' },
  { to: '/schedule', icon: CalendarDays, label: 'Calendrier' },
  { to: '/messages', icon: MessageSquare, label: 'Messagerie', badge: true },
  { to: '/playoffs', icon: Star, label: 'Éliminatoires' },
];

function SidebarLink({ item, unreadCount, onClick }) {
  const location = useLocation();
  const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={isActive ? 'nav-link-active' : 'nav-link-inactive'}
      style={isActive ? { borderLeft: '3px solid #60a5fa', paddingLeft: 'calc(0.625rem - 3px)' } : { borderLeft: '3px solid transparent', paddingLeft: 'calc(0.625rem - 3px)' }}
    >
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

function BottomNav({ user, isAdmin, isMarqueur, unreadCount }) {
  const location = useLocation();
  const bottomItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/schedule', icon: CalendarDays, label: 'Calendrier' },
    { to: '/stats', icon: BarChart3, label: 'Stats' },
    ...(isAdmin || isMarqueur ? [{ to: '/gamesheet', icon: FileText, label: 'Feuille' }] : []),
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-950 border-t border-gray-800 flex">
      {bottomItems.map(item => {
        const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors ${isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const { user, logout, isAdmin, isMarqueur } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = () => {
      api.get('/messages/unread-count').then(res => setUnreadCount(res.data.count || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const roleLabel = { admin: 'Administrateur', captain: 'Capitaine', marqueur: 'Marqueur', player: 'Joueur' };
  const roleColor = { admin: 'text-yellow-400', captain: 'text-blue-400', marqueur: 'text-emerald-400', player: 'text-gray-400' };

  const sidebar = (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800" style={{ borderTop: '4px solid #3b82f6' }}>
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              boxShadow: '0 4px 14px 0 rgba(30, 64, 175, 0.5)',
            }}
          >
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
          <SidebarLink key={item.to} item={item} unreadCount={unreadCount} onClick={() => setSidebarOpen(false)} />
        ))}
        {(isAdmin || isMarqueur) && (
          <SidebarLink
            item={{ to: '/gamesheet', icon: FileText, label: 'Feuille de match' }}
            unreadCount={0}
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {isAdmin && (
          <div className="pt-2 mt-2 border-t border-gray-800">
            <SidebarLink
              item={{ to: '/draft', icon: Zap, label: 'Repêchage' }}
              unreadCount={0}
              onClick={() => setSidebarOpen(false)}
            />
            <SidebarLink
              item={{ to: '/admin', icon: Settings, label: 'Administration' }}
              unreadCount={0}
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-800">
        <div
          className="flex items-center gap-3 p-2 rounded-lg"
          style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(17,24,39,0.8) 100%)' }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.username}</div>
            <div className={`text-xs ${roleColor[user?.role] || 'text-gray-400'}`}>
              {roleLabel[user?.role] || user?.role}
            </div>
          </div>
          <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Déconnexion">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 flex-shrink-0 flex-col">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[85vw] max-w-xs flex flex-col z-50">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white p-2">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏒</span>
            <span className="font-bold text-sm text-white">Ligue Hockey</span>
          </div>
          <div className="relative">
            <Bell size={20} className="text-gray-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Navigation Bar (mobile only) */}
        <BottomNav user={user} isAdmin={isAdmin} isMarqueur={isMarqueur} unreadCount={unreadCount} />

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
