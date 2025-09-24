"use client";

import Link from "next/link";
import { LatestRule } from "@/models/LatestRule";
import { timeAgo } from "@/lib/dateUtils";
import { useState, useEffect } from "react";
import { CgSortAz } from "react-icons/cg";
import { RiTimeFill } from "react-icons/ri";
import { Card } from "./ui/card";
import Dropdown from "./ui/dropdown";

interface LatestRulesTableProps {
  rulesByUpdated: LatestRule[];
  rulesByCreated: LatestRule[];
  title?: string;
}

export default function LatestRulesTable({
  rulesByUpdated,
  rulesByCreated,
  title,
}: LatestRulesTableProps) {
  const [currentSort, setCurrentSort] = useState<"lastUpdated" | "created">(
    "lastUpdated"
  );

  const handleSortChange = (newSort: "lastUpdated" | "created") => {
    setCurrentSort(newSort);
  };

  const currentRules =
    currentSort === "lastUpdated" ? rulesByUpdated : rulesByCreated;

  // Map of ruleUri -> github username
  const [usernames, setUsernames] = useState<Record<string, string | null>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // Prefetch usernames for visible rules
  useEffect(() => {
    let isMounted = true;
    const urisToFetch = currentRules
      .map((r) => r.uri)
      .filter((u) => u && usernames[u] === undefined);

    if (urisToFetch.length === 0) return;

    (async () => {
      for (const uri of urisToFetch) {
        if (!uri) continue;
        try {
          if (!isMounted) return;
          setLoadingMap((m) => ({ ...m, [uri]: true }));
          const params = new URLSearchParams();
          params.set('ruleUri', uri);
          const res = await fetch(`/api/github/rules/authors?${params.toString()}`);
          if (!res.ok) throw new Error('Failed to fetch GitHub username');
          const { authors } = await res.json();
          // re-use existing helper in other file? simple heuristic: pick last modified
          const lastModified = authors && authors.length ? authors[authors.length - 1] : null;
          if (!isMounted) return;
          setUsernames((m) => ({ ...m, [uri]: lastModified }));
        } catch (e) {
          // ignore prefetch errors
          setUsernames((m) => ({ ...m, [uri]: null }));
        } finally {
          if (isMounted) setLoadingMap((m) => ({ ...m, [uri]: false }));
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentRules, usernames]);

  const openGithubProfile = async (uri: string) => {
    if (!uri) return;
    const username = usernames[uri];
    if (username) {
      window.open(`https://github.com/${username}`, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      setLoadingMap((m) => ({ ...m, [uri]: true }));
      const params = new URLSearchParams();
      params.set('ruleUri', uri);
      const res = await fetch(`/api/github/rules/authors?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch GitHub username');
      const { authors } = await res.json();
      const lastModified = authors && authors.length ? authors[authors.length - 1] : null;
      setUsernames((m) => ({ ...m, [uri]: lastModified }));
      if (lastModified) window.open(`https://github.com/${lastModified}`, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Failed to fetch GitHub username for latest rules:', e);
    } finally {
      setLoadingMap((m) => ({ ...m, [uri]: false }));
    }
  };

  const sortOptions = [
    { value: "lastUpdated", label: "Last Updated" },
    { value: "created", label: "Recently Created" },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        {title && <h3 className="m-0 text-ssw-red font-bold">{title}</h3>}
        <div className="flex items-center space-x-2">
          <CgSortAz className="inline" size={24} />
          <Dropdown
            options={sortOptions}
            value={currentSort}
            onChange={(value) =>
              handleSortChange(value as "lastUpdated" | "created")
            }
          />
        </div>
      </div>

      {currentRules.map((rule, index) => (
        <Card className="mb-4" key={rule.id}>
          <div className=" flex">
            <span className="text-gray-500 mr-2">#{index + 1}</span>
            <div className="flex flex-col">
              <Link href={`/${rule.uri}`} className="no-underline">
                <h2 className="m-0 mb-2 text-2xl max-sm:text-lg hover:text-ssw-red">
                  {rule.title}
                </h2>
              </Link>
              <h4 className="flex m-0 content-center text-lg text-gray-400">
                {rule.lastUpdatedBy ? (
                  <a
                    href={usernames[rule.uri] ? `https://github.com/${usernames[rule.uri]}` : '#'}
                    onClick={(e) => {
                      // Prevent parent handlers from intercepting the click
                      e.stopPropagation();
                      if (usernames[rule.uri]) {
                        // If we already have username, force-open the profile
                        e.preventDefault();
                        window.open(`https://github.com/${usernames[rule.uri]}`, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      // Otherwise prevent default and fetch then open
                      e.preventDefault();
                      if (!loadingMap[rule.uri]) openGithubProfile(rule.uri);
                    }}
                    className={`font-medium hover:text-ssw-red hover:underline ${loadingMap[rule.uri] ? 'opacity-50 cursor-not-allowed' : ''}`}
                    target={usernames[rule.uri] ? '_blank' : undefined}
                    rel={usernames[rule.uri] ? 'noopener noreferrer' : undefined}
                    title={usernames[rule.uri] ? `View ${usernames[rule.uri]}'s GitHub profile` : `View ${rule.lastUpdatedBy}'s rules`}
                  >
                    {loadingMap[rule.uri] ? 'Loading...' : (usernames[rule.uri] || rule.lastUpdatedBy)}
                  </a>
                ) : (
                  <span className="font-medium">Unknown</span>
                )}
                {rule.lastUpdated ? (
                  <div className="flex items-center ml-4 text-xs text-gray-400">
                    <RiTimeFill className="inline mr-1" />
                    <span>{timeAgo(rule.lastUpdated)}</span>
                  </div>
                ) : (
                  ""
                )}
              </h4>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
