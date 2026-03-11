"use client";

import { useState } from "react";
import { FaComment } from "react-icons/fa";
import { RiTimeFill } from "react-icons/ri";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/dateUtils";
import { ActivityRule } from "@/models/ActivityRule";
import Link from "next/link";

const PAGE_SIZE = 5;

interface ActivityRulesClientPageProps {
  rules: ActivityRule[];
  total: number;
}

export default function ActivityRulesClientPage({ rules, total }: ActivityRulesClientPageProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageRules = rules.slice(start, start + PAGE_SIZE);

  return (
    <>
      <Breadcrumbs breadcrumbText="Rules by Activity" />
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <h1 className="text-ssw-red font-bold mb-4">Rules by Activity</h1>
          <p className="text-gray-500 mb-6">Rules ranked by most recent comment activity.</p>

          {pageRules.map((rule, i) => (
            <Card key={rule.guid} className="mb-4">
              <div className="flex">
                <span className="text-gray-400 mr-2">#{start + i + 1}</span>
                <div className="flex flex-col">
                  <Link href={`/${rule.uri}`} className="no-underline">
                    <h2 className="m-0 mb-2 text-2xl max-sm:text-lg hover:text-ssw-red">{rule.title}</h2>
                  </Link>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <RiTimeFill className="inline" />
                      Last comment {timeAgo(rule.lastCommentAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FaComment className="inline" />
                      {rule.commentCount} {rule.commentCount === 1 ? "comment" : "comments"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
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
      </div>
    </>
  );
}
