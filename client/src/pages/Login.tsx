import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, fetchUser } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'ログインに失敗しました');
        return;
      }
      setUser(data.user);
      await fetchUser();
      navigate('/');
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-6 safe-area-inset">
      <div className="w-full max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-xl sm:p-8">
        <h1 className="mb-6 text-center text-xl font-bold text-amber-400">バンド練習 予約管理</h1>
        <h2 className="mb-4 text-center text-stone-300">ログイン</h2>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          <div>
            <label className="mb-1 block text-sm text-stone-400">学籍番号 または メールアドレス</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="学籍番号 または メール"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-400">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="パスワード"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-lg bg-amber-500 py-3 font-medium text-stone-900 hover:bg-amber-400 active:opacity-90 disabled:opacity-50 sm:py-2"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-400">
          <Link to="/forgot-password" className="text-amber-400 hover:underline">パスワードを忘れた</Link>
          {' · '}
          <Link to="/register" className="text-amber-400 hover:underline">新規登録</Link>
        </p>
      </div>
    </div>
  );
}
