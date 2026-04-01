import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/login');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="sticky top-0 z-10 border-b border-stone-700 bg-stone-900/95 backdrop-blur safe-area-inset-top">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 px-3 sm:px-4">
          <Link to="/" className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-amber-400 transition hover:bg-stone-800 active:opacity-80" title="バンド練習 予約">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </Link>
          <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-0.5 sm:gap-1">
            <Link to="/" className="flex items-center justify-center rounded-lg p-2 text-stone-300 transition hover:bg-stone-800 hover:text-white active:opacity-80 min-[400px]:p-2.5" title="カレンダー">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
              </svg>
            </Link>
            <Link to="/ranking" className="flex items-center justify-center rounded-lg p-2 text-stone-300 transition hover:bg-stone-800 hover:text-white active:opacity-80 min-[400px]:p-2.5" title="ランキング">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true">
                <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
              </svg>
            </Link>
            <Link to="/profile" className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm transition hover:bg-stone-800 sm:gap-2 sm:px-2" title="プロフィール">
              <img
                src={user?.iconPath || '/default-avatar.svg'}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-1 ring-stone-600 sm:h-8 sm:w-8"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/default-avatar.svg';
                }}
              />
              <span className="hidden truncate text-stone-300 lg:inline lg:max-w-[120px]">{user?.name}</span>
            </Link>
            {user?.isAdmin && (
              <>
                <Link to="/admin/bands" className="hidden rounded-lg px-2 py-1.5 text-xs text-amber-400/80 transition hover:bg-stone-800 hover:text-amber-400 sm:inline-block sm:text-sm">バンド</Link>
                <Link to="/admin/circle-fees" className="rounded-lg px-2 py-1.5 text-xs text-amber-400/80 transition hover:bg-stone-800 hover:text-amber-400 sm:text-sm">会費</Link>
                <Link to="/admin/users" className="hidden rounded-lg px-2 py-1.5 text-xs text-amber-400/80 transition hover:bg-stone-800 hover:text-amber-400 sm:inline-block sm:text-sm">ユーザー</Link>
                <Link to="/admin/grant" className="hidden rounded-lg px-2 py-1.5 text-xs text-amber-400/80 transition hover:bg-stone-800 hover:text-amber-400 sm:inline-block sm:text-sm">管理者付与</Link>
              </>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center rounded-lg p-2 text-stone-400 transition hover:bg-stone-800 hover:text-white active:opacity-80 min-[400px]:p-2.5"
              title="ログアウト"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </svg>
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
