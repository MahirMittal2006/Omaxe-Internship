import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { deleteAdminUser, fetchAdminUsers, resetAdminUserPassword, updateAdminUser } from '../utils/api';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ username: '', fullName: '', password: '', role: 'user' });
  const [passwordDrafts, setPasswordDrafts] = useState({});

  useEffect(() => {
    fetchAdminUsers()
      .then(setUsers)
      .catch((err) => setError(err.message || 'Failed to load users.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggleAccess = async (targetUser) => {
    setError('');
    setStatus('');
    try {
      const updated = await updateAdminUser(targetUser.id, { isActive: !targetUser.is_active });
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setStatus(`${updated.full_name} access updated.`);
    } catch (err) {
      setError(err.message || 'Failed to update access.');
    }
  };

  const handleDelete = async (targetUser) => {
    if (!window.confirm(`Delete ${targetUser.full_name}?`)) {
      return;
    }

    setError('');
    setStatus('');
    try {
      await deleteAdminUser(targetUser.id);
      setUsers((current) => current.filter((item) => item.id !== targetUser.id));
      setStatus(`${targetUser.full_name} removed.`);
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  const handleResetPassword = async (targetUser) => {
    const nextPassword = passwordDrafts[targetUser.id];
    if (!nextPassword || nextPassword.length < 6) {
      setError('Enter a new password with at least 6 characters.');
      return;
    }

    setError('');
    setStatus('');
    try {
      await resetAdminUserPassword(targetUser.id, nextPassword);
      setPasswordDrafts((current) => ({ ...current, [targetUser.id]: '' }));
      setStatus(`Password reset for ${targetUser.full_name}. Share the new password securely.`);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('claude-wrapper-token')}`,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create user.');
      }

      setUsers((current) => [payload.user, ...current]);
      setForm({ username: '', fullName: '', password: '', role: 'user' });
      setStatus(`Created account for ${payload.user.full_name}.`);
    } catch (err) {
      setError(err.message || 'Failed to create user.');
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <header className="glass border-b border-surface-800/50 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin Access Control</h1>
          <p className="text-sm text-surface-400">Manage who can sign in to Omaxe DMS AI</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-sm transition-colors"
          >
            Back to Chat
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
            <p className="text-xs text-surface-500">admin</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Users</h2>
              <p className="text-sm text-surface-400">Disable access or remove accounts as needed.</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="grid gap-3 md:grid-cols-4 mb-6">
            <input
              value={form.fullName}
              onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
              placeholder="Full name"
              className="rounded-xl bg-surface-900/80 border border-surface-700/50 px-4 py-3 text-sm"
            />
            <input
              value={form.username}
              onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
              placeholder="Username"
              className="rounded-xl bg-surface-900/80 border border-surface-700/50 px-4 py-3 text-sm"
            />
            <input
              value={form.password}
              onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
              placeholder="Password"
              type="password"
              className="rounded-xl bg-surface-900/80 border border-surface-700/50 px-4 py-3 text-sm"
            />
            <div className="flex gap-3">
              <select
                value={form.role}
                onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
                className="flex-1 rounded-xl bg-surface-900/80 border border-surface-700/50 px-4 py-3 text-sm"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <button className="px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-sm">
                Add
              </button>
            </div>
          </form>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {status && !error && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {status}
            </div>
          )}

          {isLoading ? (
            <p className="text-surface-400">Loading users...</p>
          ) : (
            <div className="space-y-3">
              {users.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-surface-800 bg-surface-900/60 px-4 py-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{item.full_name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${item.role === 'admin' ? 'bg-brand-500/20 text-brand-200' : 'bg-surface-700 text-surface-300'}`}>
                        {item.role}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${item.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {item.is_active ? 'active' : 'disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-surface-400 mt-1">@{item.username}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAccess(item)}
                      type="button"
                      disabled={item.username === user?.username}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      {item.is_active ? 'Disable access' : 'Enable access'}
                    </button>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={passwordDrafts[item.id] || ''}
                        onChange={(e) => setPasswordDrafts((current) => ({ ...current, [item.id]: e.target.value }))}
                        placeholder="New password"
                        className="w-40 rounded-xl bg-surface-900/80 border border-surface-700/50 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => handleResetPassword(item)}
                        type="button"
                        disabled={item.username === user?.username}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                      >
                        Reset password
                      </button>
                    </div>
                    <button
                      onClick={() => handleDelete(item)}
                      type="button"
                      disabled={item.username === user?.username || item.role === 'admin'}
                      className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
