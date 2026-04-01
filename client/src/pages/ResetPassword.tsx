import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '再設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-8 text-center">
          <p className="text-green-400">パスワードを再設定しました。</p>
          <Link to="/login" className="mt-4 inline-block text-amber-400 hover:underline">ログインへ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-8">
        <h1 className="mb-6 text-center text-xl font-bold text-amber-400">パスワード再設定</h1>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}
          <div>
            <label className="mb-1 block text-sm text-stone-400">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-400">認証コード</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              placeholder="メールに届いたコード"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-400">新しいパスワード（6文字以上）</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 py-2 font-medium text-stone-900 disabled:opacity-50"
          >
            {loading ? '送信中...' : '再設定'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-400">
          <Link to="/login" className="text-amber-400 hover:underline">ログインへ</Link>
        </p>
      </div>
    </div>
  );
}
