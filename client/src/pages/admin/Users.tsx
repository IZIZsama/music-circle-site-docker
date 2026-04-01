import { useState, useEffect } from 'react';
import { api } from '../../api';

type UserRow = { id: string; name: string; studentId: string; iconPath: string; email?: string; isAdmin?: boolean };

export default function AdminUsers() {
  const [userList, setUserList] = useState<UserRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [preview, setPreview] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUserList = async () => {
    try {
      const data = await api('/api/admin/users');
      setUserList(data.users || []);
    } catch {
      setUserList([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadUserList();
  }, []);

  const loadPreview = async () => {
    if (!prefix || prefix.length < 2) {
      setError('学籍番号の上2桁以上を入力してください');
      return;
    }
    setError('');
    try {
      const data = await api(`/api/admin/users/bulk-preview?prefix=${encodeURIComponent(prefix)}`);
      setPreview(data.users || []);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました');
      setPreview([]);
    }
  };

  const doBulkDelete = async () => {
    if (preview.length === 0) return;
    setDeleting(true);
    setError('');
    try {
      await api('/api/admin/users/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ userIds: preview.map((u) => u.id) }),
      });
      setPreview([]);
      setPrefix('');
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '一括削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const deleteOne = async (id: string, name: string) => {
    if (!confirm(`「${name}」を退会（削除）しますか？\n予約もすべて削除されます。`)) return;
    setError('');
    try {
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      setPreview((prev) => prev.filter((u) => u.id !== id));
      setUserList((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-amber-400">ユーザー管理（退会処理）</h1>
      {error && (
        <p className="mb-4 rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-medium text-stone-200">ユーザー一覧</h2>
        <p className="mb-3 text-sm text-stone-400">一覧から退会（削除）できます。</p>
        {listLoading ? (
          <p className="text-stone-500">読み込み中...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-700 bg-stone-900/50">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-700 bg-stone-800/50">
                  <th className="px-3 py-3 font-medium text-stone-400">アイコン</th>
                  <th className="px-3 py-3 font-medium text-stone-400">名前</th>
                  <th className="px-3 py-3 font-medium text-stone-400">学籍番号</th>
                  <th className="hidden px-3 py-3 font-medium text-stone-400 sm:table-cell">メール</th>
                  <th className="px-3 py-3 font-medium text-stone-400">管理者</th>
                  <th className="px-3 py-3 font-medium text-stone-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {userList.map((u) => (
                  <tr key={u.id} className="border-b border-stone-700/70 last:border-0">
                    <td className="px-3 py-2">
                      <img
                        src={u.iconPath || '/default-avatar.svg'}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/default-avatar.svg';
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-white">{u.name}</td>
                    <td className="px-3 py-2 text-stone-300">{u.studentId}</td>
                    <td className="hidden truncate px-3 py-2 text-stone-400 sm:table-cell sm:max-w-[180px]">{u.email}</td>
                    <td className="px-3 py-2">
                      {u.isAdmin ? (
                        <span className="rounded bg-amber-500/30 px-2 py-0.5 text-xs text-amber-400">管理者</span>
                      ) : (
                        <span className="text-stone-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => deleteOne(u.id, u.name)}
                        className="rounded border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-900/30"
                      >
                        退会
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!listLoading && userList.length === 0 && (
          <p className="rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-6 text-center text-stone-500">ユーザーがいません</p>
        )}
      </section>

      <div className="mb-8 rounded-xl border border-stone-700 bg-stone-900 p-6">
        <h2 className="mb-3 font-medium text-stone-200">学籍番号の上2桁で一括削除</h2>
        <p className="mb-3 text-sm text-stone-400">
          学籍番号の先頭2桁以上を指定すると、該当するユーザーを一覧表示します。確認後に一括削除できます。
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="例: 24"
            className="w-32 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
          />
          <button
            type="button"
            onClick={loadPreview}
            className="rounded bg-stone-600 px-4 py-2 text-white hover:bg-stone-500"
          >
            対象を表示
          </button>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-6">
          <h2 className="mb-2 font-medium text-amber-400">削除対象ユーザー（{preview.length}件）</h2>
          <p className="mb-4 text-sm text-stone-400">
            以下のユーザーを退会（物理削除）します。予約も連動して削除されます。
          </p>
          <ul className="mb-4 space-y-2">
            {preview.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={u.iconPath || '/default-avatar.svg'}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-avatar.svg';
                    }}
                  />
                  <span className="font-medium text-white">{u.name}</span>
                  <span className="text-sm text-stone-400">{u.studentId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteOne(u.id, u.name)}
                  className="text-sm text-red-400 hover:underline"
                >
                  単体削除
                </button>
              </li>
            ))}
          </ul>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded border border-red-700 bg-red-900/50 px-4 py-2 text-red-200 hover:bg-red-900/70"
            >
              上記 {preview.length} 件を一括削除する
            </button>
          ) : (
            <div>
              <p className="mb-2 text-amber-400">本当に一括削除しますか？</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={doBulkDelete}
                  disabled={deleting}
                  className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? '削除中...' : '確認して削除'}
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
      )}
    </div>
  );
}
