"use client";

import { useState } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecentCommentsCard from "@/components/RecentCommentsCard";
import RuleActivityCard from "@/components/RuleActivityCard";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";

const PAGE_SIZE = 5;

interface ActivityRulesClientPageProps {
  rules: ActivityRule[];
  total: number;
  recentComments: RecentComment[];
}

export default function ActivityRulesClientPage({ rules, total, recentComments }: ActivityRulesClientPageProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageRules = rules.slice(start, start + PAGE_SIZE);

  return (
    <>
      <Breadcrumbs breadcrumbText="Rules by Activity" />
      <h1 className="text-ssw-red font-bold mb-2">Rules by Activity</h1>
      <p className="text-gray-500 mb-6">Rules ranked by most recent comment activity.</p>
      <div className="layout-two-columns">
        <div className="layout-main-section min-w-0">
          {pageRules.map((rule, i) => (
            <RuleActivityCard key={rule.guid} rule={rule} rank={start + i + 1} />
          ))}

          {total === 0 && <p className="text-gray-500">No rules with comment activity found.</p>}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
              >
                ← Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded border text-sm ${p === page ? "bg-ssw-red text-white border-ssw-red" : "border-gray-300 hover:bg-gray-100"}`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="layout-sidebar min-w-0">
          <RecentCommentsCard comments={recentComments} />
        </div>
      </div>
    </>
  );
}

