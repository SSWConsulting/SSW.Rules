"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const TINA_BRANCH_KEY = "tinacms-current-branch";

export default function SetBranchClientPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const branch = searchParams.get("branch");

    if (branch) {
      try {
        localStorage.setItem(TINA_BRANCH_KEY, JSON.stringify(branch));
      } catch (e) {
        console.warn("Unable to set branch in localStorage:", e);
      }
    }

    const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const basePath = rawBasePath ? `/${rawBasePath.replace(/\//g, "")}` : "";
    window.location.replace(`${basePath}/admin`);
  }, [searchParams]);

  return null;
}
