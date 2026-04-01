import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, INSTRUMENTS } from '../api';

export default function Profile() {
  const { user, fetchUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [bandIds, setBandIds] = useState<string[]>([]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPath, setIconPath] = useState('');
  const [allBands, setAllBands] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setInstruments(user.instruments || []);
      setBandIds(user.bands?.map((b) => b.id) || []);
      setIconPath(user.iconPath || '');
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/bands');
        setAllBands(data.bands || []);
      } catch {
        setAllBands([]);
      }
    })();
  }, []);

  const toggleInstrument = (inst: string) => {
    setInstruments((prev) =>
      prev.includes(inst) ? prev.filter((x) => x !== inst) : [...prev, inst]
    );
  };

  const toggleBand = (id: string) => {
    setBandIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const uploadIcon = async (): Promise<string | null> => {
    if (!iconFile) return iconPath || null;
    const form = new FormData();
    form.append('icon', iconFile);
    const res = await fetch('/api/users/upload-icon', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'アップロード失敗');
    return data.iconPath;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (instruments.length === 0) {
      setError('担当楽器を1つ以上選択してください');
      return;
    }
    setLoading(true);
    try {
      let newIconPath = iconPath;
      if (iconFile) {
        const path = await uploadIcon();
        if (path) newIconPath = path;
      }
      await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          email,
          instruments,
          bandIds,
          iconPath: newIconPath,
        }),
      });
      await fetchUser();
      setMessage('プロフィールを更新しました');
      setIconFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0 max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-amber-400 sm:mb-6 sm:text-2xl">プロフィール編集</h1>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <p className="rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>
        )}
        {message && (
          <p className="rounded bg-green-900/50 px-3 py-2 text-sm text-green-200">{message}</p>
        )}
        <div>
          <label className="mb-1 block text-sm text-stone-400">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-400">学籍番号</label>
          <p className="rounded-lg border border-stone-700 bg-stone-800/50 px-3 py-2 text-stone-400">
            {user?.studentId}（変更不可）
          </p>
        </div>
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
          <label className="mb-1 block text-sm text-stone-400">担当楽器（複数可）</label>
          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((inst) => (
              <label
                key={inst}
                className="flex cursor-pointer items-center gap-2 rounded border border-stone-600 px-3 py-2 hover:bg-stone-800"
              >
                <input
                  type="checkbox"
                  checked={instruments.includes(inst)}
                  onChange={() => toggleInstrument(inst)}
                />
                <span>{inst}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-400">所属バンド（複数可）</label>
          <div className="flex flex-wrap gap-2">
            {allBands.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-2 rounded border border-stone-600 px-3 py-2 hover:bg-stone-800"
              >
                <input
                  type="checkbox"
                  checked={bandIds.includes(b.id)}
                  onChange={() => toggleBand(b.id)}
                />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-400">アイコン画像</label>
          <input
            type="file"
            accept=".png,.jpg,.jpeg"
            onChange={(e) => setIconFile(e.target.files?.[0] || null)}
            className="w-full text-stone-300 file:mr-2 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-1 file:text-stone-900"
          />
          {(iconFile || iconPath) && (
            <img
              src={iconFile ? URL.createObjectURL(iconFile) : iconPath}
              alt=""
              className="mt-2 h-20 w-20 rounded-full object-cover"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-stone-900 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </form>
    </div>
  );
}
