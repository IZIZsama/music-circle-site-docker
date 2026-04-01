import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage('認証コードを送信しました。メールをご確認ください。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-8">
        <h1 className="mb-6 text-center text-xl font-bold text-amber-400">パスワードを忘れた</h1>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}
          {message && <p className="rounded bg-green-900/50 px-3 py-2 text-sm text-green-200">{message}</p>}
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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 py-2 font-medium text-stone-900 disabled:opacity-50"
          >
            {loading ? '送信中...' : '認証コードを送信'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-400">
          <Link to="/login" className="text-amber-400 hover:underline">ログインへ</Link>
        </p>
      </div>
    </div>
  );
}
