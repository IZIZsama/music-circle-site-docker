import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

type FeeRow = {
  userId: string;
  name: string;
  studentId: string;
  springPaid: boolean;
  autumnPaid: boolean;
};

type FilterType = 'all' | 'springUnpaid' | 'autumnUnpaid' | 'anyUnpaid' | 'fullyPaid';

export default function AdminCircleFees() {
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y -= 1) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const loadRows = async (year: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/admin/circle-fees?fiscalYear=${year}`);
      setRows(data.checklist || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '一覧の取得に失敗しました');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows(fiscalYear);
  }, [fiscalYear]);

  const filteredRows = useMemo(() => {
    if (filter === 'springUnpaid') return rows.filter((row) => !row.springPaid);
    if (filter === 'autumnUnpaid') return rows.filter((row) => !row.autumnPaid);
    if (filter === 'anyUnpaid') return rows.filter((row) => !row.springPaid || !row.autumnPaid);
    if (filter === 'fullyPaid') return rows.filter((row) => row.springPaid && row.autumnPaid);
    return rows;
  }, [rows, filter]);

  const toggleTerm = async (userId: string, term: 'springPaid' | 'autumnPaid', value: boolean) => {
    const prevRows = rows;
    setRows((current) =>
      current.map((row) => (row.userId === userId ? { ...row, [term]: value } : row)),
    );
    setSavingId(`${userId}:${term}`);
    setError('');
    try {
      await api(`/api/admin/circle-fees/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fiscalYear, [term]: value }),
      });
    } catch (err) {
      setRows(prevRows);
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-amber-400">サークル費チェックリスト</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-stone-300">
            <span>絞り込み</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
            >
              <option value="all">全員</option>
              <option value="springUnpaid">前期未納</option>
              <option value="autumnUnpaid">後期未納</option>
              <option value="anyUnpaid">前期 or 後期未納</option>
              <option value="fullyPaid">前後期とも納入済み</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-300">
            <span>年度</span>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-white"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}

      {loading ? (
        <p className="text-stone-500">読み込み中...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-700 bg-stone-900/50">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-700 bg-stone-800/50">
                <th className="px-3 py-3 font-medium text-stone-400">名前</th>
                <th className="px-3 py-3 font-medium text-stone-400">{fiscalYear}年前期</th>
                <th className="px-3 py-3 font-medium text-stone-400">後期</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.userId} className="border-b border-stone-700/70 last:border-0">
                  <td className="px-3 py-2 text-white">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-stone-400">{row.studentId}</div>
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-stone-200">
                      <input
                        type="checkbox"
                        checked={row.springPaid}
                        disabled={savingId === `${row.userId}:springPaid`}
                        onChange={(e) => toggleTerm(row.userId, 'springPaid', e.target.checked)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span>{row.springPaid ? '済' : '未'}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-stone-200">
                      <input
                        type="checkbox"
                        checked={row.autumnPaid}
                        disabled={savingId === `${row.userId}:autumnPaid`}
                        onChange={(e) => toggleTerm(row.userId, 'autumnPaid', e.target.checked)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span>{row.autumnPaid ? '済' : '未'}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filteredRows.length === 0 && (
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-900/50 px-4 py-6 text-center text-stone-500">
          条件に一致するユーザーがいません
        </p>
      )}
    </div>
  );
}
