import { useState } from 'react';
import { api } from '../../api';

type User = { id: string; name: string; studentId: string; email: string; iconPath: string; isAdmin: boolean };

export default function AdminGrant() {
  const [studentId, setStudentId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSelected(null);
    setConfirming(false);
    if (!studentId || studentId.length < 2) {
      setError('学籍番号を2桁以上入力してください');
      return;
    }
    setLoading(true);
    try {
      const data = await api(`/api/admin/users/search?studentId=${encodeURIComponent(studentId)}`);
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const grant = async () => {
    if (!selected) return;
    setError('');
    try {
      await api(`/api/admin/users/${selected.id}/grant-admin`, { method: 'POST' });
      setSelected(null);
      setConfirming(false);
      setUsers((prev) =>
        prev.map((u) => (u.id === selected.id ? { ...u, isAdmin: true } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '付与に失敗しました');
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-amber-400">管理者付与</h1>
      {error && (
        <p className="mb-4 rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>
      )}

      <form onSubmit={search} className="mb-6 flex gap-2">
        <input
          type="text"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="学籍番号で検索"
          className="w-48 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-amber-500 px-4 py-2 font-medium text-stone-900 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? '検索中...' : '検索'}
        </button>
      </form>

      {users.length > 0 && (
        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <img
                  src={u.iconPath || '/default-avatar.svg'}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-stone-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-avatar.svg';
                  }}
                />
                <div>
                  <p className="font-medium text-white">{u.name}</p>
                  <p className="text-sm text-stone-400">{u.studentId} · {u.email}</p>
                </div>
                {u.isAdmin && (
                  <span className="rounded bg-amber-500/30 px-2 py-0.5 text-xs text-amber-400">
                    管理者
                  </span>
                )}
              </div>
              {!u.isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    setConfirming(true);
                  }}
                  className="rounded border border-amber-500/50 px-3 py-1 text-sm text-amber-400 hover:bg-amber-500/20"
                >
                  管理者に任命
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirming && selected && (
        <div className="mt-6 rounded-xl border border-amber-500/50 bg-amber-500/10 p-6">
          <p className="mb-2 font-medium text-amber-400">このユーザーで間違いありませんか？</p>
          <div className="mb-4 flex items-center gap-4">
            <img
              src={selected.iconPath || '/default-avatar.svg'}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/default-avatar.svg';
              }}
            />
            <div>
              <p className="font-medium text-white">{selected.name}</p>
              <p className="text-sm text-stone-400">{selected.studentId}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={grant}
              className="rounded bg-amber-500 px-4 py-2 font-medium text-stone-900 hover:bg-amber-400"
            >
              確認して管理者権限を付与
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-stone-600 px-4 py-2 text-stone-300 hover:bg-stone-800"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
