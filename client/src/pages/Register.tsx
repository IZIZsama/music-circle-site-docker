import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { INSTRUMENTS } from '../api';

/** Register page: form state and API response are typed for strict TS build */
type RegisterResponse = { error?: string; user?: { id: string; name: string; studentId: string; email: string; iconPath: string; isAdmin: boolean; instruments: string[]; bands: { id: string; name: string }[] } };

export default function Register() {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [, setIconPath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, fetchUser } = useAuth();

  const uploadIcon = async () => {
    if (!iconFile) return null;
    const form = new FormData();
    form.append('icon', iconFile);
    const res = await fetch('/api/users/upload-icon', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('サーバーに接続できません。バックエンド（API）が起動しているか確認してください。');
    }
    const payload = data as { error?: string; iconPath?: string };
    if (!res.ok) throw new Error(payload.error || 'アップロード失敗');
    return payload.iconPath;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (instruments.length === 0) {
      setError('担当楽器を1つ以上選択してください');
      return;
    }
    setLoading(true);
    try {
      let path = '';
      if (iconFile) {
        const uploaded = await uploadIcon();
        if (!uploaded) throw new Error('アイコンのアップロードに失敗しました');
        path = uploaded;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          studentId,
          email,
          password,
          instruments,
          iconPath: path,
        }),
      });
      const text = await res.text();
      let data: RegisterResponse = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError('サーバーに接続できません。バックエンド（API）が起動しているか確認してください。');
        return;
      }
      if (!res.ok) {
        setError(data.error || '登録に失敗しました');
        return;
      }
      if (data.user) setUser(data.user);
      await fetchUser();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleInstrument = (inst: string) => {
    setInstruments((prev) =>
      prev.includes(inst) ? prev.filter((x) => x !== inst) : [...prev, inst]
    );
  };

  return (
    <div className="min-h-screen bg-stone-950 px-4 py-6 sm:py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-4 shadow-xl sm:p-8">
        <h1 className="mb-2 text-center text-xl font-bold text-amber-400">新規登録</h1>
        <p className="mb-6 text-center text-sm text-stone-400">名前・学籍番号・メール・パスワード・担当楽器は必須です</p>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          <div>
            <label className="mb-1 block text-sm text-stone-400">名前 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-400">学籍番号 *</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-400">メールアドレス *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-400">パスワード（6文字以上）*</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-400">担当楽器 *（複数可）</label>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map((inst) => (
                <label key={inst} className="flex cursor-pointer items-center gap-2 rounded border border-stone-600 px-3 py-2 hover:bg-stone-800">
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
            <label className="mb-1 block text-sm text-stone-400">アイコン画像（任意・png/jpg, 10MB以下推奨）</label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setIconFile(f || null);
                setIconPath('');
              }}
              className="w-full text-stone-300 file:mr-2 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-1 file:text-stone-900"
            />
            {iconFile && (
              <img
                src={URL.createObjectURL(iconFile)}
                alt=""
                className="mt-2 h-20 w-20 rounded-full object-cover"
              />
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-lg bg-amber-500 py-3 font-medium text-stone-900 hover:bg-amber-400 active:opacity-90 disabled:opacity-50 sm:py-2"
          >
            {loading ? '登録中...' : '登録'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-400">
          <Link to="/login" className="text-amber-400 hover:underline">ログインへ</Link>
        </p>
      </div>
    </div>
  );
}
