import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const JA_LOCALE = 'ja-JP';

// Intl で日本語の曜日ラベルを取得（日〜土、0=日曜）
function getWeekdayLabels(): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const d = new Date(2024, 0, 7 + day); // 2024-01-07 は日曜
    return new Intl.DateTimeFormat(JA_LOCALE, { weekday: 'narrow' }).format(d);
  });
}

// 年月の表示用（例: 2026年2月）
function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(JA_LOCALE, { year: 'numeric', month: 'long' }).format(d);
}

export default function Calendar() {
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const weekDays = useMemo(() => getWeekdayLabels(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api(`/api/reservations/calendar?year=${year}&month=${month}`);
        if (!cancelled) setCounts(data.counts || {});
      } catch {
        if (!cancelled) setCounts({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [year, month]);

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month - 1 + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const totalCells = startPad + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  const goPrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isToday = (y: number, m: number, d: number) =>
    now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
  const isSunday = (cellIndex: number) => cellIndex % 7 === 0;
  const isSaturday = (cellIndex: number) => cellIndex % 7 === 6;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-amber-400 sm:text-2xl">練習予約</h1>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            onClick={goPrev}
            className="min-h-[44px] min-w-[44px] rounded border border-stone-600 bg-stone-800 px-3 py-2 text-stone-300 hover:bg-stone-700 active:opacity-80 sm:py-1"
          >
            前月
          </button>
          <span className="min-w-[120px] flex-1 text-center text-sm font-medium sm:min-w-[160px] sm:text-base">
            {formatMonthYear(year, month)}
          </span>
          <button
            type="button"
            onClick={goNext}
            className="min-h-[44px] min-w-[44px] rounded border border-stone-600 bg-stone-800 px-3 py-2 text-stone-300 hover:bg-stone-700 active:opacity-80 sm:py-1"
          >
            次月
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-700 bg-stone-900/50 sm:rounded-xl">
        <div className="grid grid-cols-7 border-b border-stone-700 bg-stone-800/50">
          {weekDays.map((d, idx) => (
            <div
              key={d}
              className={`py-1.5 text-center text-xs font-medium sm:py-2 sm:text-sm ${
                idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-stone-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: rows * 7 }, (_, i) => {
            const dayIndex = i - startPad + 1;
            const isEmpty = dayIndex < 1 || dayIndex > daysInMonth;
            const dateKey =
              !isEmpty
                ? `${year}-${String(month).padStart(2, '0')}-${String(dayIndex).padStart(2, '0')}`
                : '';
            const count = dateKey ? counts[dateKey] || 0 : 0;
            const today = !isEmpty && isToday(year, month, dayIndex);
            const sun = isSunday(i);
            const sat = isSaturday(i);
            return (
              <div
                key={i}
                className={`min-h-[56px] border-b border-r border-stone-700/70 p-0.5 last:border-r-0 sm:min-h-[72px] sm:p-1 md:min-h-[80px] ${
                  isEmpty ? 'bg-stone-900/30' : 'bg-stone-900/50 hover:bg-stone-800/50'
                }`}
              >
                {!isEmpty && (
                  <Link
                    to={`/day/${dateKey}`}
                    className={`flex h-full min-h-[52px] flex-col items-center justify-center rounded transition hover:bg-stone-700/50 active:bg-stone-700/70 sm:min-h-0 ${
                      today ? 'ring-1 ring-amber-400 bg-amber-500/10' : ''
                    } ${sun ? 'text-red-400' : sat ? 'text-blue-400' : 'text-stone-300'}`}
                  >
                    <span className="text-sm sm:text-base">{dayIndex}</span>
                    {count > 0 && (
                      <span className="mt-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500/80 px-1.5 text-[10px] font-bold text-stone-900 sm:mt-1 sm:h-6 sm:min-w-[24px] sm:px-2 sm:text-xs">
                        {count}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {loading && (
        <p className="mt-2 text-center text-sm text-stone-500">読み込み中...</p>
      )}
    </div>
  );
}
