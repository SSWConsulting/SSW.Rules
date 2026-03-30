"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface MenuContextType {
  menuGroups: any[] | null;
  isLoading: boolean;
  error: string | null;
}

const MenuContext = createContext<MenuContextType>({
  menuGroups: null,
  isLoading: true,
  error: null,
});

export const useMenu = () => useContext(MenuContext);

interface MenuProviderProps {
  children: React.ReactNode;
  initialMenuGroups?: any[] | null;
}

export function MenuProvider({ children, initialMenuGroups }: MenuProviderProps) {
  const [menuGroups, setMenuGroups] = useState<any[] | null>(initialMenuGroups || null);
  const [isLoading, setIsLoading] = useState(!initialMenuGroups);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if we don't have initial data
    if (!initialMenuGroups) {
      const fetchMenu = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const res = await fetch("./api/tina/megamenu");
          if (!res.ok) {
            throw new Error(`Failed to fetch megamenu: ${res.status} ${res.statusText}`);
          }
          const data = await res.json();
          setMenuGroups(data?.data?.megamenu?.menuGroups || null);
        } catch (err) {
          console.error("Failed to fetch menu:", err);
          setError(err instanceof Error ? err.message : "Failed to fetch menu");
        } finally {
          setIsLoading(false);
        }
      };

      fetchMenu();
    }
  }, [initialMenuGroups]);

  return <MenuContext.Provider value={{ menuGroups, isLoading, error }}>{children}</MenuContext.Provider>;
}
