import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, LOCATIONS } from '../api';

const LOCATION_LABELS: Record<string, string> = Object.fromEntries(LOCATIONS.map((l) => [l.value, l.label]));

type Reservation = {
  id: string;
  startAt: string;
  endAt: string;
  location: string;
  band: { id: string; name: string } | null;
  memo: string | null;
  user: { id: string; name: string; studentId: string; iconPath: string };
};

export default function DayDetail() {
  const { date } = useParams<{ date: string }>();
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [, setBands] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('ROOM_802_FRONT');
  const [bandId, setBandId] = useState('');
  const [showAllBands, setShowAllBands] = useState(false);
  const [memo, setMemo] = useState('');
  const [allBands, setAllBands] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!date) return;
    (async () => {
      setLoading(true);
      try {
        const [dayData, bandsRes] = await Promise.all([
          api(`/api/reservations/by-date?date=${date}`),
          api('/api/bands'),
        ]);
        setReservations(dayData.reservations || []);
        setBands(user?.bands || []);
        setAllBands(bandsRes.bands || []);
      } catch {
        setReservations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [date, user?.bands]);

  const myBandIds = (user?.bands || []).map((b) => b.id);
  const bandOptions = showAllBands ? allBands : allBands.filter((b) => myBandIds.includes(b.id));

  const resetForm = () => {
    setFormOpen(false);
    setEditId(null);
    setError('');
    setStartTime('');
    setEndTime('');
    setLocation('ROOM_802_FRONT');
    setBandId('');
    setMemo('');
  };

  const MINUTES_15 = ['00', '15', '30', '45'] as const;

  const roundTo15 = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const rounded = Math.round((m ?? 0) / 15) * 15;
    const minute = rounded === 60 ? 0 : rounded;
    let hour = rounded === 60 ? (h ?? 0) + 1 : (h ?? 0);
    if (hour >= 24) hour = 23; // 24時は23:45に
    const min = hour === 23 && rounded === 60 ? 45 : minute;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const isoToTime = (iso: string): string => {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes();
    const rounded = Math.round(m / 15) * 15;
    const minute = rounded === 60 ? 0 : rounded;
    const hour = rounded === 60 ? h + 1 : h;
    if (hour >= 24) return '23:45';
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const openCreate = () => {
    resetForm();
    setStartTime('09:00');
    setEndTime('10:00');
    setFormOpen(true);
  };

  const openEdit = (r: Reservation) => {
    setEditId(r.id);
    setStartTime(isoToTime(r.startAt));
    setEndTime(isoToTime(r.endAt));
    setLocation(r.location);
    setBandId(r.band?.id || '');
    setMemo(r.memo || '');
    setFormOpen(true);
    setError('');
  };

  const canEdit = (r: Reservation) => {
    if (user?.isAdmin) {
      const resDate = new Date(r.startAt);
      const limit = new Date(resDate.getFullYear(), resDate.getMonth() + 2, 0, 23, 59, 59);
      return new Date() <= limit;
    }
    return r.user.id === user?.id && new Date(r.startAt) >= new Date();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!date || !startTime || !endTime) {
      setError('開始・終了時刻を指定してください');
      return;
    }
    const startRounded = roundTo15(startTime);
    const endRounded = roundTo15(endTime);
    const startAtIso = `${date}T${startRounded}:00`;
    const endAtIso = `${date}T${endRounded}:00`;
    const start = new Date(startAtIso).getTime();
    const end = new Date(endAtIso).getTime();
    if (isNaN(start) || isNaN(end)) {
      setError('有効な開始・終了時刻を指定してください');
      return;
    }
    if (end <= start) {
      setError('終了時刻は開始時刻より後にしてください');
      return;
    }
    try {
      if (editId) {
        await api(`/api/reservations/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            startAt: new Date(startAtIso).toISOString(),
            endAt: new Date(endAtIso).toISOString(),
            location,
            bandId: bandId || null,
            memo: memo || null,
          }),
        });
      } else {
        await api('/api/reservations', {
          method: 'POST',
          body: JSON.stringify({
            startAt: new Date(startAtIso).toISOString(),
            endAt: new Date(endAtIso).toISOString(),
            location,
            bandId: bandId || null,
            memo: memo || null,
          }),
        });
      }
      const dayData = await api(`/api/reservations/by-date?date=${date}`);
      setReservations(dayData.reservations || []);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return;
    try {
      await api(`/api/reservations/${id}`, { method: 'DELETE' });
      const dayData = await api(`/api/reservations/by-date?date=${date}`);
      setReservations(dayData.reservations || []);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  if (!date) return <div>日付が指定されていません</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(date + 'T00:00:00');
  const isPastDate = selectedDate < today;
  const canAddReservation = user?.isAdmin || !isPastDate;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="text-amber-400 hover:underline active:opacity-80">← カレンダー</Link>
        <h1 className="truncate text-lg font-bold text-amber-400 sm:text-xl">{date} の予約</h1>
        {canAddReservation && (
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[44px] shrink-0 rounded bg-amber-500 px-4 py-2.5 text-sm font-medium text-stone-900 hover:bg-amber-400 active:opacity-90 sm:py-2"
          >
            新規予約
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-stone-400">読み込み中...</p>
      ) : (
        <ul className="space-y-3">
          {reservations.length === 0 && !formOpen && (
            <li className="rounded-lg border border-stone-700 bg-stone-900/50 p-4 text-center text-sm text-stone-500 sm:text-base">
              この日の予約はありません
            </li>
          )}
          {reservations.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-stone-700 bg-stone-900/50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
            >
              <Link
                to={`/user/${r.user.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:opacity-90 sm:gap-4"
              >
                <img
                  src={r.user.iconPath || '/default-avatar.svg'}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-stone-600 sm:h-10 sm:w-10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-avatar.svg';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white text-sm sm:text-base">
                    {formatTime(r.startAt)}–{formatTime(r.endAt)} · {LOCATION_LABELS[r.location]}
                  </p>
                  <p className="truncate text-xs text-stone-400 sm:text-sm">
                    {r.user.name}（{r.user.studentId}）
                    {r.band && ` · ${r.band.name}`}
                  </p>
                  {r.memo && <p className="truncate text-xs text-stone-500 sm:text-sm">{r.memo}</p>}
                </div>
              </Link>
              {canEdit(r) && (
                <div className="flex shrink-0 gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="min-h-[40px] min-w-[44px] rounded border border-stone-600 px-3 py-2 text-sm text-stone-300 hover:bg-stone-700 active:opacity-80"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => doDelete(r.id)}
                    className="min-h-[40px] min-w-[44px] rounded border border-red-800 px-3 py-2 text-sm text-red-300 hover:bg-red-900/30 active:opacity-80"
                  >
                    削除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <form
          onSubmit={submit}
          className="mt-6 rounded-xl border border-stone-700 bg-stone-900 p-4 sm:p-6"
        >
          <h2 className="mb-4 font-medium text-amber-400">
            {editId ? '予約を編集' : '新規予約'}
          </h2>
          {error && (
            <p className="mb-3 rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          {date && (
            <p className="mb-3 text-sm text-stone-400">
              日付: <span className="font-medium text-stone-200">{date}</span>（この日の予約です）
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-stone-400">開始時刻（15分刻み）</label>
              <div className="flex gap-2">
                <select
                  value={roundTo15(startTime).split(':')[0]}
                  onChange={(e) => {
                    const m = roundTo15(startTime).split(':')[1];
                    setStartTime(`${e.target.value.padStart(2, '0')}:${m}`);
                  }}
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')}>
                      {String(i).padStart(2, '0')}時
                    </option>
                  ))}
                </select>
                <select
                  value={roundTo15(startTime).split(':')[1]}
                  onChange={(e) => {
                    const h = roundTo15(startTime).split(':')[0];
                    setStartTime(`${h}:${e.target.value}`);
                  }}
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
                >
                  {MINUTES_15.map((m) => (
                    <option key={m} value={m}>{m}分</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-stone-400">終了時刻（15分刻み）</label>
              <div className="flex gap-2">
                <select
                  value={roundTo15(endTime).split(':')[0]}
                  onChange={(e) => {
                    const m = roundTo15(endTime).split(':')[1];
                    setEndTime(`${e.target.value.padStart(2, '0')}:${m}`);
                  }}
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')}>
                      {String(i).padStart(2, '0')}時
                    </option>
                  ))}
                </select>
                <select
                  value={roundTo15(endTime).split(':')[1]}
                  onChange={(e) => {
                    const h = roundTo15(endTime).split(':')[0];
                    setEndTime(`${h}:${e.target.value}`);
                  }}
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
                >
                  {MINUTES_15.map((m) => (
                    <option key={m} value={m}>{m}分</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-stone-400">場所</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
            >
              {LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-stone-400">バンド（任意）</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bandId}
                onChange={(e) => setBandId(e.target.value)}
                className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
              >
                <option value="">未選択（個人練習）</option>
                {bandOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAllBands((s) => !s)}
                className="text-sm text-amber-400 hover:underline"
              >
                {showAllBands ? '所属バンドのみ' : '見つからない → 全バンド表示'}
              </button>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-stone-400">メモ（任意）</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="submit"
              className="min-h-[44px] min-w-[120px] flex-1 rounded bg-amber-500 px-4 py-2.5 font-medium text-stone-900 hover:bg-amber-400 active:opacity-90 sm:flex-none sm:py-2"
            >
              {editId ? '更新' : '予約する'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[44px] min-w-[100px] flex-1 rounded border border-stone-600 px-4 py-2.5 text-stone-300 hover:bg-stone-800 active:opacity-80 sm:flex-none sm:py-2"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
