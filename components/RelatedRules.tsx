"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import client from "@/tina/__generated__/client";
import redirects from "@/redirects.json";
import { useDebounceEffect } from "@/components/hooks/useDebounceEffect";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";

export type RelatedRule = { uri: string; title: string };

interface RelatedRulesProps {
  relatedUris?: string[];
  initialMapping?: RelatedRule[];
}

const RelatedRules = ({ relatedUris, initialMapping }: RelatedRulesProps) => {
  const [rules, setRules] = useState<RelatedRule[]>(initialMapping || []);
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

  const getRulesByUris = async (uris: string[]): Promise<RelatedRule[]> => {
    const directQuery = await client.queries.rulesByUriQuery({ uris: uris });
    const directEdges = directQuery?.data?.ruleConnection?.edges ?? [];
    return directEdges.map((edge: any) => edge?.node)
      .filter((node: any) => !!node && typeof node.uri === "string" && typeof node.title === "string")
      .map((node: any) => ({ uri: node.uri as string, title: node.title as string }));
  };

  useDebounceEffect(() => {
    const loadRelatedRules = async () => {
      try {
        const requestedUris = JSON.parse(urisKey) as string[];

        // No inputs: clear state and finish
        if (!requestedUris.length) {
          if (rules.length) setRules([]);
          setConfirmedNotFound([]);
          return;
        }

        const directMatches: RelatedRule[] = await getRulesByUris(requestedUris);
        const matchedUris = new Set(directMatches.map((r) => r.uri));
        const unmatchedUris = requestedUris.filter((u) => !matchedUris.has(u));

        // 2) For only unmatched requests, resolve redirects and fetch their targets
        const redirectMap: Record<string, string> = {};
        for (const uri of unmatchedUris) {
          const target = (redirects as Record<string, string>)[uri];
          if (typeof target === "string" && target.length > 0) redirectMap[uri] = target;
        }
        const redirectTargets = Array.from(new Set(Object.values(redirectMap)));
        let redirectMatches: RelatedRule[] = [];
        if (redirectTargets.length > 0) {
          redirectMatches = await getRulesByUris(redirectTargets);
          for (const r of redirectMatches) matchedUris.add(r.uri);
        }

        // 3) Add redirect matches to the current matches (avoid duplicates)
        const directUris = new Set(directMatches.map((r) => r.uri));
        const addedRedirects = redirectMatches.filter((r) => !directUris.has(r.uri));
        const nextMatches = addedRedirects.length ? [...directMatches, ...addedRedirects] : directMatches;
        if (!areRuleListsEqual(nextMatches, rules)) setRules(nextMatches);

        // 4) Set not found uris if not on admin page
        if (isAdminPage) {
          const fulfilledRequests = new Set<string>();
          for (const req of requestedUris) {
            const redirectTarget = redirectMap[req];
            if (matchedUris.has(req) || (redirectTarget && matchedUris.has(redirectTarget))) {
              fulfilledRequests.add(req);
            }
          }
          const finalUnmatched = requestedUris.filter((u) => !fulfilledRequests.has(u));
          setConfirmedNotFound(finalUnmatched);
        } else if (confirmedNotFound.length) {
          setConfirmedNotFound([]);
        }
      } catch (error) {
        console.error(error);
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
