"use client";

import { useEffect, useState } from "react";

export function useIsAdminPage(): { isAdmin: boolean; isLoading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const isAdminPath = window.top?.location?.pathname.includes("/admin") ?? false;
      setIsAdmin(isAdminPath);
    } catch {
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isAdmin, isLoading };
}
