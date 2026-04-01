import { useState, useEffect } from 'react';
import { api } from '../../api';

export default function AdminBands() {
  const [bands, setBands] = useState<{ id: string; name: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api('/api/bands');
      setBands(data.bands || []);
    } catch {
      setBands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newName.trim()) return;
    try {
      await api('/api/bands', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`バンド「${name}」を削除しますか？\n削除すると完全に非表示になります。`)) return;
    try {
      await api(`/api/bands/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-amber-400">バンド管理</h1>
      {error && (
        <p className="mb-4 rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>
      )}

      <div className="mb-8 rounded-xl border border-stone-700 bg-stone-900 p-6">
        <h2 className="mb-3 font-medium text-stone-200">バンドを追加</h2>
        <form onSubmit={create} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="バンド名"
            className="flex-1 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
          />
          <button
            type="submit"
            className="rounded bg-amber-500 px-4 py-2 font-medium text-stone-900 hover:bg-amber-400"
          >
            追加
          </button>
        </form>
      </div>

      <h2 className="mb-3 font-medium text-stone-200">登録バンド一覧</h2>
      {loading ? (
        <p className="text-stone-400">読み込み中...</p>
      ) : (
        <ul className="space-y-2">
          {bands.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-3"
            >
              <span className="font-medium text-white">{b.name}</span>
              <button
                type="button"
                onClick={() => remove(b.id, b.name)}
                className="rounded border border-red-800 px-3 py-1 text-sm text-red-300 hover:bg-red-900/30"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
