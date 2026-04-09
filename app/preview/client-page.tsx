"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const TINA_BRANCH_KEY = "tinacms-current-branch";

export default function PreviewClientPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const branch = searchParams.get("branch");
    const uri = searchParams.get("uri");

    if (branch) {
      try {
        localStorage.setItem(TINA_BRANCH_KEY, JSON.stringify(branch));
      } catch (e) {
        console.warn("Unable to set branch in localStorage:", e);
      }

      try {
        document.cookie = `x-branch=${encodeURIComponent(branch)}; path=/; SameSite=Lax`;
      } catch (e) {
        console.warn("Unable to set x-branch cookie:", e);
      }
    }

    const collection = searchParams.get("collection");

    const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const basePath = rawBasePath ? `/${rawBasePath.replace(/\//g, "")}` : "";
    const destination =
      uri && collection
        ? `${basePath}/admin#/~/${collection}/${uri}`
        : `${basePath}/admin`;
    window.location.replace(destination);
  }, [searchParams]);

  return null;
}
