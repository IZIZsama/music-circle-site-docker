import React, { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: string;
  name: string;
  studentId: string;
  email: string;
  iconPath: string;
  isAdmin: boolean;
  instruments: string[];
  bands: { id: string; name: string }[];
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  fetchUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // 未ログイン時は 401（正常）。ブラウザのコンソールに赤で出るが動作上の問題はなし
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
