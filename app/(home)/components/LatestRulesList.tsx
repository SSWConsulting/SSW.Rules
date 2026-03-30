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

type ApiResult = { path: string; authorName: string | null; date: string | null; sha: string | null } | { path: string; error: string };

type ApiResponse = {
  ok: boolean;
  mode: "updated" | "created";
  ref: string;
  results: ApiResult[];
};

export default function LatestRulesList({ rulesByUpdated, rulesByCreated, title }: LatestRulesListProps) {
  const [currentSort, setCurrentSort] = useState<"lastUpdated" | "created">("lastUpdated");

  const [authorNameByUri, setAuthorNameByUri] = useState<Record<string, string | null>>({});
  const [dateByUri, setDateByUri] = useState<Record<string, string | null>>({});
  const [loadedByUri, setLoadedByUri] = useState<Record<string, boolean>>({});

  const currentRules = currentSort === "lastUpdated" ? rulesByUpdated : rulesByCreated;

  const sortOptions = [
    { value: "lastUpdated", label: "Last Updated" },
    { value: "created", label: "Recently Created" },
  ];

  const { mode, paths, pathToUri, uris } = useMemo(() => {
    const mode: "updated" | "created" = currentSort === "lastUpdated" ? "updated" : "created";

    const pathToUri = new Map<string, string>();
    const uris = currentRules.slice(0, 50).map((rule) => rule.uri);

    const paths = currentRules
      .slice(0, 50)
      .map((rule) => (rule.uri ?? "").trim())
      .filter(Boolean)
      .map((trimmedUri) => {
        const p = `public/uploads/rules/${trimmedUri}/rule.mdx`.trim();
        pathToUri.set(p, trimmedUri);
        return p;
      });

    return { mode, paths, pathToUri, uris };
  }, [currentRules, currentSort]);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    async function run() {
      if (!paths.length) return;

      setLoadedByUri((prev) => {
        const next = { ...prev };
        for (const uri of uris) next[uri] = false;
        return next;
      });

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/github-history?mode=${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths }),
          signal: ac.signal,
        });

        const json = (await res.json()) as ApiResponse;
        if (!json.ok) {
          if (!cancelled) {
            setLoadedByUri((prev) => {
              const next = { ...prev };
              for (const uri of uris) next[uri] = true;
              return next;
            });
          }
          return;
        }
        if (cancelled) return;

        const authorUpdates: Record<string, string | null> = {};
        const dateUpdates: Record<string, string | null> = {};
        const loadedUpdates: Record<string, boolean> = {};

        for (const item of json.results) {
          const uri = pathToUri.get(item.path);
          if (!uri) continue;

          loadedUpdates[uri] = true;

          if ("error" in item) {
            authorUpdates[uri] = null;
            dateUpdates[uri] = null;
            continue;
          }

          authorUpdates[uri] = item.authorName ?? null;
          dateUpdates[uri] = item.date ?? null;
        }

        setAuthorNameByUri((prev) => ({ ...prev, ...authorUpdates }));
        setDateByUri((prev) => ({ ...prev, ...dateUpdates }));

        setLoadedByUri((prev) => {
          const next = { ...prev };
          for (const uri of uris) next[uri] = true;
          for (const [uri, val] of Object.entries(loadedUpdates)) next[uri] = val;
          return next;
        });
      } catch (error) {
        if (cancelled) return;
        if ((error as any)?.name === "AbortError") return;

        console.error("Error fetching GitHub history:", error);
        setLoadedByUri((prev) => {
          const next = { ...prev };
          for (const uri of uris) next[uri] = true;
          return next;
        });
      }
    }

    run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [mode, paths, pathToUri, uris]);

  function normalizeAuthorName(authorName: string | null): string | null {
    if (!authorName) return null;

    const trimmedName = authorName.trim();
    if (!trimmedName) return null;

    const nameWithoutBrackets = trimmedName.replace(/\s*\[[^\]]*\]/g, "").trim();

    const nicknameMatch = nameWithoutBrackets.match(/"([^"]+)"/);
    if (nicknameMatch) {
      const nickname = nicknameMatch[1].trim();
      if (nickname) return nickname;
    }

    return nameWithoutBrackets;
  }

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
        const uri = rule.uri.trim();

        const loaded = loadedByUri[uri] === true;
        const authorName = loaded ? normalizeAuthorName(authorNameByUri[uri] ?? null) : null;

        const displayDate = loaded ? (dateByUri[uri] ?? null) : null;

        return (
          <RuleCard
            key={rule.id}
            title={rule.title}
            slug={rule.uri}
            skeletonMeta={!loaded}
            lastUpdatedBy={authorName}
            lastUpdated={displayDate}
            authorUrl={authorName ? `https://ssw.com.au/people/${toSlug(authorName)}/` : null}
            index={index}
          />
        );
      })}
    </div>
  );
}
