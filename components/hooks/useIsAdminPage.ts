"use client";

import { useEffect, useState } from "react";

export function useIsAdminPage(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const isAdminPath = window.top?.location?.pathname.includes("/admin") ?? false;
      setIsAdmin(isAdminPath);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  return isAdmin;
}