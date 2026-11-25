"use client";

import { usePathname } from "next/navigation";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";
import NotFoundContent from "@/components/NotFoundContent";
import ClientFallbackPage from "./ClientFallbackPage";

/** The [filename] segment of a path such as "/hard-tasks-first", or null for any other path. */
export function filenameFromPath(pathname: string | null): string | null {
  const match = pathname?.match(/^\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * A rule or category that exists only on an editor's Tina branch is not on the server, so the server returns a 404.
 * Inside the Tina editor, this loads the page from the branch in the browser. Everyone else gets the 404 page, which is
 * also what the server HTML holds.
 */
export default function NotFoundOrBranchPreview() {
  const filename = filenameFromPath(usePathname());
  const { isAdmin, isLoading } = useIsAdminPage();

  if (filename && isAdmin && !isLoading) {
    return <ClientFallbackPage filename={filename} />;
  }

  return <NotFoundContent />;
}
