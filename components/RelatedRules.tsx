"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import client from "@/tina/__generated__/client";
import { useDebounceEffect } from "@/components/hooks/useDebounceEffect";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";

export type RelatedRule = { uri: string; title: string };

interface RelatedRulesProps {
  relatedUris?: string[];
  initialMapping?: RelatedRule[];
}

const RelatedRules = ({ relatedUris, initialMapping }: RelatedRulesProps) => {
  const [rules, setRules] = useState<RelatedRule[]>(initialMapping || []);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [confirmedNotFound, setConfirmedNotFound] = useState<string[]>([]);
  const isAdminPage = useIsAdminPage();

  // Canonical key for URIs so effect only runs when set of URIs changes
  const urisKey = useMemo(() => {
    const clean = (relatedUris || []).filter((u): u is string => typeof u === "string" && u.length > 0);
    return JSON.stringify(Array.from(new Set(clean)));
  }, [relatedUris]);

  const urisList = useMemo(() => {
    try {
      return JSON.parse(urisKey) as string[];
    } catch {
      return [];
    }
  }, [urisKey]);

  // Utility: shallow equality of ordered rule lists by uri+title
  const areRuleListsEqual = (a: RelatedRule[], b: RelatedRule[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i]?.uri !== b[i]?.uri || a[i]?.title !== b[i]?.title) return false;
    }
    return true;
  };

  useDebounceEffect(() => {
    const loadRelatedRules = async () => {
      try {
        const requestedUris = JSON.parse(urisKey) as string[];

        // No inputs: clear state and finish
        if (!requestedUris.length) {
          if (rules.length) setRules([]);
          setConfirmedNotFound([]);
          setResolvedKey(urisKey);
          return;
        }

        // Fetch direct matches for the requested URIs
        const queryResult = await client.queries.rulesByUriQuery({ uris: requestedUris });
        const connectionEdges = queryResult?.data?.ruleConnection?.edges ?? [];
        const directMatches: RelatedRule[] = connectionEdges
          .map((edge: any) => edge?.node)
          .filter(Boolean)
          .map((node: any) => ({ uri: node.uri as string, title: node.title as string }))
          .sort((a, b) => a.title.localeCompare(b.title));

        if (!areRuleListsEqual(directMatches, rules)) setRules(directMatches);

        const matchedUris = new Set(directMatches.map((r) => r.uri));
        const unmatchedUris = requestedUris.filter((u) => !matchedUris.has(u));

        // TODO: Check redirects for each rule to resolve more inputs
        setConfirmedNotFound((prev) => {
          const next = new Set(prev);
          for (const uri of Array.from(next)) {
            if (!requestedUris.includes(uri) || matchedUris.has(uri)) next.delete(uri);
          }
          for (const uri of unmatchedUris) next.add(uri);
          return Array.from(next);
        });

        setResolvedKey(urisKey);
      } catch (error) {
        console.error(error);
        setResolvedKey(urisKey);
      }
    };

    loadRelatedRules();
  }, [urisKey], 2000);

  const notFoundUris = useMemo(() => {
    if (!urisList.length) return [];
    return confirmedNotFound.filter((u) => urisList.includes(u));
  }, [urisList, confirmedNotFound]);

  if (!urisList || urisList.length === 0) {
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
      {isAdminPage && notFoundUris.map((u) => (
        <li key={`nf:${u}`} className="not-last:mb-2 text-gray-600">
          ❌ Not Found! <span>{u}</span>
        </li>
      ))}
    </ul>
  );
}

export default RelatedRules;
