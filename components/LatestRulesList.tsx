"use client";

import { useEffect, useMemo, useState } from "react";
import { CgSortAz } from "react-icons/cg";
import { toSlug } from "@/lib/utils";
import { LatestRule } from "@/models/LatestRule";
import RuleCard from "./RuleCard";
import Dropdown from "./ui/dropdown";

interface LatestRulesListProps {
  rulesByUpdated: LatestRule[];
  rulesByCreated: LatestRule[];
  title?: string;
}

type ApiResponse = {
  ok: boolean;
  mode: "latest" | "creator";
  ref: string;
  results: Array<{ path: string; authorName: string | null; date: string | null; sha: string | null } | { path: string; error: string }>;
};

export default function LatestRulesList({ rulesByUpdated, rulesByCreated, title }: LatestRulesListProps) {
  const [currentSort, setCurrentSort] = useState<"lastUpdated" | "created">("lastUpdated");

  // uri -> authorName
  const [authorNameByUri, setAuthorNameByUri] = useState<Record<string, string | null>>({});

  const currentRules = currentSort === "lastUpdated" ? rulesByUpdated : rulesByCreated;

  const sortOptions = [
    { value: "lastUpdated", label: "Last Updated" },
    { value: "created", label: "Recently Created" },
  ];

  const { mode, paths, pathToUri } = useMemo(() => {
    const mode: "latest" | "creator" = currentSort === "lastUpdated" ? "latest" : "creator";

    const pathToUri = new Map<string, string>();
    const paths = currentRules.slice(0, 50).map((rule) => {
      const p = `public/uploads/rules/${rule.uri}/rule.mdx`;
      pathToUri.set(p, rule.uri);
      return p;
    });

    return { mode, paths, pathToUri };
  }, [currentRules, currentSort]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!paths.length) return;

      try {
        const res = await fetch(`/api/github-history?mode=${mode}&owner=SSWConsulting&repo=SSW.Rules.Content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paths,
          }),
        });

        const json = (await res.json()) as ApiResponse;
        if (!json.ok) return;
        if (cancelled) return;

        const updates: Record<string, string | null> = {};
        for (const item of json.results) {
          if ("error" in item) continue;
          const uri = pathToUri.get(item.path);
          if (!uri) continue;
          updates[uri] = item.authorName ?? null;
        }

        setAuthorNameByUri((prev) => ({ ...prev, ...updates }));
      } catch {}
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [mode, paths, pathToUri]);

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        {title && <h1 className="m-0 text-ssw-red font-bold">{title}</h1>}
        <div className="flex items-center space-x-2">
          <CgSortAz className="inline" size={24} />
          <Dropdown options={sortOptions} value={currentSort} onChange={(value) => setCurrentSort(value as "lastUpdated" | "created")} />
        </div>
      </div>

      {currentRules.map((rule, index) => {
        const authorName = authorNameByUri[rule.uri] ?? rule.lastUpdatedBy ?? null;
        return (
          <RuleCard
            key={rule.id}
            title={rule.title}
            slug={rule.uri}
            lastUpdatedBy={authorName}
            lastUpdated={rule.lastUpdated}
            authorUrl={authorName ? `https://ssw.com.au/people/${toSlug(authorName)}/` : null}
            index={index}
          />
        );
      })}
    </div>
  );
}
