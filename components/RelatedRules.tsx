"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import client from "@/tina/__generated__/client";
import { useDebounceEffect } from "@/components/hooks/useDebounceEffect";

export type RelatedRule = { uri: string; title: string };

interface RelatedRulesProps {
  relatedUris?: string[];
  initialMapping?: RelatedRule[];
}

export default function RelatedRules({ relatedUris, initialMapping }: RelatedRulesProps) {
  const [rules, setRules] = useState<RelatedRule[]>(initialMapping || []);

  // Canonical key for URIs so effect only runs when set of URIs changes
  const urisKey = useMemo(() => {
    const clean = (relatedUris || []).filter((u): u is string => typeof u === "string" && u.length > 0);
    return JSON.stringify(Array.from(new Set(clean)).sort());
  }, [relatedUris]);

  useDebounceEffect(() => {
    (async () => {
      try {
        const uris = JSON.parse(urisKey) as string[];
        if (!uris.length) {
          if (rules.length) setRules([]);
          return;
        }
        const res = await client.queries.rulesByUriQuery({ uris });
        const edges = res?.data?.ruleConnection?.edges ?? [];
        const mapped: RelatedRule[] = edges
          .map((e: any) => e?.node)
          .filter(Boolean)
          .map((n: any) => ({ uri: n.uri as string, title: n.title as string }))
          .sort((a, b) => a.title.localeCompare(b.title));
        const sameLength = mapped.length === rules.length;
        const sameItems = sameLength && mapped.every((r, i) => r.uri === rules[i]?.uri && r.title === rules[i]?.title);
        if (!sameItems) setRules(mapped);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [urisKey], 2000);

  if (!rules || rules.length === 0) {
    return <div className="text-sm text-gray-500">No related rules.</div>;
  }

  return (
    <ul className="pl-4">
      {rules.map((r) => (
        <li key={r.uri} className="not-last:mb-2">
          <Link href={`/${r.uri}`} className="no-underline">
            {r.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}


