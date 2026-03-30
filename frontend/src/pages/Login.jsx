import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.05) 40px, rgba(255,255,255,0.05) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.05) 40px, rgba(255,255,255,0.05) 41px)' }}
        />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl text-4xl mb-4 shadow-xl shadow-blue-600/30">
            🏒
          </div>
          <h1 className="text-3xl font-bold text-white">LHMA</h1>
          <p className="text-gray-400 mt-1">Ligue de Hockey</p>
        </div>

        {/* Form */}
        <div className="card border-gray-700 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Connexion</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nom d'utilisateur</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input pl-9"
                  placeholder="admin"
                  autoFocus
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl text-xs text-gray-500">
          <p className="font-semibold text-gray-400 mb-2">Comptes de démo (mot de passe: <span className="text-blue-400">password123</span>)</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              ['admin', 'Administrateur'],
              ['cap_nordiques', 'Capitaine'],
              ['joueur_nordiques', 'Joueur'],
            ].map(([u, r]) => (
              <button key={u} onClick={() => { setUsername(u); setPassword('password123'); }}
                className="text-left p-2 rounded-lg hover:bg-gray-800 transition-colors">
                <span className="text-blue-400 font-mono">{u}</span>
                <span className="text-gray-600 ml-1">({r})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
