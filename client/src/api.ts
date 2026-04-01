const base = '';

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(base + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const LOCATIONS = [
  { value: 'ROOM_802_FRONT', label: '802前方' },
  { value: 'ROOM_802_PERSONAL', label: '802個人' },
  { value: 'STUDIO', label: 'スタジオ練習' },
] as const;

export const INSTRUMENTS = ['Vo', 'Gt', 'Ba', 'Dr', 'Key', 'other'] as const;
