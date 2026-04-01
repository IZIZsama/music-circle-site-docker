import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

type UserProfileData = {
  id: string;
  name: string;
  studentId: string;
  iconPath: string;
  instruments: string[];
  bands: { id: string; name: string }[];
};

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api(`/api/users/${userId}`);
        setUser(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : '取得に失敗しました');
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <p className="text-stone-400">読み込み中...</p>;
  if (error || !user) {
    return (
      <div>
        <p className="rounded bg-red-900/50 px-3 py-2 text-red-200">{error || 'ユーザーが見つかりません'}</p>
        <Link to="/" className="mt-4 inline-block text-amber-400 hover:underline">← カレンダーへ</Link>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Link to="/" className="mb-4 inline-block text-amber-400 hover:underline active:opacity-80">← カレンダー</Link>
      <div className="rounded-xl border border-stone-700 bg-stone-900/50 p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <img
            src={user.iconPath || '/default-avatar.svg'}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-stone-600 sm:h-24 sm:w-24"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-avatar.svg';
            }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">{user.name}</h1>
            <p className="text-sm text-stone-400">学籍番号: {user.studentId}</p>
            {user.instruments.length > 0 && (
              <p className="mt-2 text-stone-300">
                担当楽器: {user.instruments.join(' / ')}
              </p>
            )}
            {user.bands.length > 0 && (
              <p className="mt-1 text-stone-300">
                所属バンド: {user.bands.map((b) => b.name).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
