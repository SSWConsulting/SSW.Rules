"use client";

import Link from "next/link";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";

interface BrokenReferenceBannerProps {
  brokenPaths: string[];
  ruleUri: string;
}

export default function BrokenReferenceBanner({ brokenPaths, ruleUri }: BrokenReferenceBannerProps) {
  const { isAdmin } = useIsAdminPage();

  const adminUrl = `/rules/admin#/~/rules/${encodeURIComponent(ruleUri)}`;

  return (
    <div className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-800 m-0 mb-1">
            Broken Related Rule Reference{brokenPaths.length > 1 ? "s" : ""}
          </h3>
          <p className="text-sm text-amber-700 m-0 mb-2">
            This rule references {brokenPaths.length > 1 ? "rules that no longer exist" : "a rule that no longer exists"}:
          </p>
          <ul className="text-sm text-amber-600 list-disc list-inside mb-2 m-0 p-0">
            {brokenPaths.map((path, idx) => (
              <li key={idx} className="font-mono text-xs break-all">
                {path}
              </li>
            ))}
          </ul>
          {isAdmin ? (
            <p className="text-sm text-amber-700 m-0">
              Please edit the <strong>Related Rules</strong> field to remove or update the broken reference.
            </p>
          ) : (
            <p className="text-sm text-amber-700 m-0">
              <Link href={adminUrl} className="text-amber-800 underline hover:text-amber-900">
                Open in admin panel
              </Link>{" "}
              to fix this issue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
