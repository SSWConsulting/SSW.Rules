'use client';
import { createContext, useContext, useMemo, useState } from 'react';

type AuthValue = {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const Ctx = createContext<AuthValue>({ user: null, isAuthenticated: false, isLoading: false });

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: any | null }) {
  const [user] = useState(initialUser);
  const value = useMemo(() => ({ user, isAuthenticated: !!user, isLoading: false }), [user]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
