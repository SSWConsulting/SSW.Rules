'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type AnyUser = { sub?: string; name?: string; email?: string; picture?: string; nickname?: string };
type Ctx = { user: AnyUser | null; isLoading: boolean };
const Ctx = createContext<Ctx>({ user: null, isLoading: true });
export const useAuth = () => useContext(Ctx);

export default function UserClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AnyUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/auth/profile', { credentials: 'include' });
        if (alive && res.ok) setUser(await res.json());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const value = useMemo(() => ({ user, isLoading }), [user, isLoading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
