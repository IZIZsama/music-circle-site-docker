import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

type RankEntry = { user?: { id: string; name: string; iconPath: string }; band?: { id: string; name: string }; score: number };

export default function Ranking() {
  useAuth();
  const [period, setPeriod] = useState<'this_month' | 'last_30_days' | 'total'>('this_month');
  const [type] = useState<'user' | 'band'>('user');
  const [userRanking, setUserRanking] = useState<RankEntry[]>([]);
  const [bandRanking, setBandRanking] = useState<RankEntry[]>([]);
  const [myScore, setMyScore] = useState<RankEntry | null>(null);
  const [myBandScores, setMyBandScores] = useState<RankEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [u, b] = await Promise.all([
          api(`/api/ranking?period=${period}&type=user`),
          api(`/api/ranking?period=${period}&type=band`),
        ]);
        if (!cancelled) {
          setUserRanking(u.ranking || []);
          setMyScore(u.myScore || null);
          setMyRank(u.myRank || null);
          setBandRanking(b.ranking || []);
          setMyBandScores(b.myBandScores || []);
          setShowAll(u.showAll ?? false);
        }
      } catch {
        if (!cancelled) {
          setUserRanking([]);
          setBandRanking([]);
          setMyScore(null);
          setMyBandScores([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period, type]);

  const periodLabel = {
    this_month: '今月',
    last_30_days: '過去30日',
    total: '累計',
  };

  return (
    <div className="min-w-0">
      <h1 className="mb-4 text-xl font-bold text-amber-400 sm:mb-6 sm:text-2xl">スコア・ランキング</h1>
      <p className="mb-4 text-xs text-stone-400 sm:text-sm">30分 = 1ポイントで計算されます。</p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="w-full text-stone-500 text-sm sm:w-auto">表示期間:</span>
        {(['this_month', 'last_30_days', 'total'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`min-h-[40px] min-w-[44px] rounded px-3 py-2 text-sm sm:min-h-0 sm:min-w-0 sm:py-1 ${
              period === p
                ? 'bg-amber-500 text-stone-900'
                : 'border border-stone-600 text-stone-300 hover:bg-stone-800 active:opacity-80'
            }`}
          >
            {periodLabel[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-stone-400">読み込み中...</p>
      ) : (
        <>
          {/* 個人ランキング */}
          <section className="mb-8 sm:mb-10">
            <h2 className="mb-3 text-base font-medium text-stone-200 sm:text-lg">個人スコア</h2>
            {myScore != null && (
              <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-3 sm:px-4">
                <p className="text-xs text-stone-400 sm:text-sm">あなたのスコア</p>
                <p className="text-lg font-bold text-amber-400 sm:text-xl">
                  {myScore.score} pt
                  {myRank != null && (
                    <span className="ml-2 text-base font-normal text-stone-400">
                      （{myRank}位）
                    </span>
                  )}
                </p>
              </div>
            )}
            <ul className="space-y-2">
              {userRanking.map((entry, i) => (
                <li
                  key={entry.user?.id || i}
                  className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-900/50 px-3 py-3 sm:gap-4 sm:px-4"
                >
                  <span className="w-6 shrink-0 text-base font-bold text-amber-400/80 sm:w-8 sm:text-lg">{i + 1}</span>
                  {entry.user && (
                    <Link
                      to={`/user/${entry.user.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90 sm:gap-4"
                    >
                      <img
                        src={entry.user.iconPath || '/default-avatar.svg'}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-stone-600 sm:h-10 sm:w-10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/default-avatar.svg';
                        }}
                      />
                      <span className="truncate font-medium text-white text-sm sm:text-base">{entry.user.name}</span>
                    </Link>
                  )}
                  <span className="shrink-0 font-bold text-amber-400">{entry.score} pt</span>
                </li>
              ))}
            </ul>
            {!showAll && userRanking.length >= 3 && (
              <p className="mt-2 text-sm text-stone-500">※ メンバーはTOP3のみ表示。管理者は全件表示できます。</p>
            )}
          </section>

          {/* バンドランキング */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-stone-200">バンドスコア</h2>
            {myBandScores.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3">
                <p className="text-sm text-stone-400">あなたの所属バンド</p>
                <ul className="mt-1 space-y-1">
                  {myBandScores.map((entry, i) => (
                    <li key={entry.band?.id || i}>
                      <span className="font-medium text-amber-400">{entry.band?.name}</span>
                      <span className="ml-2 text-stone-400">{entry.score} pt</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="space-y-2">
              {bandRanking.map((entry, i) => (
                <li
                  key={entry.band?.id || i}
                  className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-900/50 px-3 py-3 sm:gap-4 sm:px-4"
                >
                  <span className="w-6 shrink-0 text-base font-bold text-amber-400/80 sm:w-8 sm:text-lg">{i + 1}</span>
                  {entry.band && (
                    <span className="min-w-0 flex-1 truncate font-medium text-white text-sm sm:text-base">{entry.band.name}</span>
                  )}
                  <span className="shrink-0 font-bold text-amber-400">{entry.score} pt</span>
                </li>
              ))}
            </ul>
            {!showAll && bandRanking.length >= 3 && (
              <p className="mt-2 text-sm text-stone-500">※ メンバーはTOP3のみ表示。</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
