"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import Breadcrumbs from "@/components/Breadcrumbs";
import RuleList from "@/components/rule-list";
import Spinner from "@/components/Spinner";
import Pagination from "@/components/ui/pagination";
import { selectLatestRuleFilesByPath } from "@/utils/selectLatestRuleFilesByPath";

const Tabs = {
  MODIFIED: "modified",
  AUTHORED: "authored",
} as const;

type TabKey = (typeof Tabs)[keyof typeof Tabs];

export default function UserRulesClientPage({ ruleCount }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(Tabs.AUTHORED);
  const queryStringRulesAuthor = searchParams.get("author") || "";

  // Last Modified
  const [lastModifiedRules, setLastModifiedRules] = useState<any[]>([]);
  const [loadingLastModified, setLoadingLastModified] = useState(false);
  const [loadingMoreLastModified, setLoadingMoreLastModified] = useState(false);
  const [nextPageCursor, setNextPageCursor] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [currentPageLastModified, setCurrentPageLastModified] = useState(1);
  const [itemsPerPageLastModified, setItemsPerPageLastModified] = useState(20);

  // Acknowledged
  const [authoredRules, setAuthoredRules] = useState<any[]>([]);
  const [author, setAuthor] = useState<{ fullName?: string; slug?: string; gitHubUrl?: string }>({});
  const [loadingAuthored, setLoadingAuthored] = useState(false);
  const [authoredNextCursor, setAuthoredNextCursor] = useState<string | null>(null);
  const [authoredHasNext, setAuthoredHasNext] = useState(false);
  const [loadingMoreAuthored, setLoadingMoreAuthored] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [currentPageAuthored, setCurrentPageAuthored] = useState(1);
  const [itemsPerPageAuthored, setItemsPerPageAuthored] = useState(20);
  const FETCH_PAGE_SIZE = 10;

  const resolveAuthor = async (): Promise<{ slug: string; fullName: string }> => {
    const res = await fetch(`./api/crm/employees?query=${encodeURIComponent(queryStringRulesAuthor)}`);
    if (!res.ok) throw new Error("Failed to resolve author");
    const profile = await res.json();
    setAuthor(profile);
    return {
      slug: profile.slug || profile.fullName?.toLowerCase().replace(/\s+/g, "-") || "",
      fullName: profile.fullName || "",
    };
  };

  useEffect(() => {
    (async () => {
      if (queryStringRulesAuthor) {
        const resolvedAuthor = await resolveAuthor();
        const authorSlug = resolvedAuthor.slug;
        // Load BOTH in parallel for maximum speed
        await Promise.all([loadAllAuthoredRules(authorSlug), loadAllLastModifiedRules()]);
      }
    })();
  }, [queryStringRulesAuthor]);

  // Function to load ALL last modified rules (not just one page)
  const loadAllLastModifiedRules = async () => {
    setLoadingLastModified(true);
    setLastModifiedRules([]);
    let cursor = "";
    let previousCursor = "";
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 100; // Safety limit to prevent infinite loops
    const allRulesFromGithub: any[] = [];

    try {
      // Step 1: Fetch ALL pages from GitHub API (collect paths only)
      while (hasMore && pageCount < MAX_PAGES) {
        pageCount++;

        const params = new URLSearchParams();
        params.set("author", queryStringRulesAuthor);
        if (cursor) params.set("cursor", cursor);
        params.set("direction", "after");

        const url = `./api/github/rules/prs?${params.toString()}`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Failed to fetch GitHub PR search: ${res.status} ${res.statusText}`);
        }

        const prSearchData = await res.json();
        const resultList = prSearchData.search.nodes;

        const rules = resultList
          .flatMap((pr: any) => pr.files.nodes)
          .filter((file: any) => file.path.endsWith("rule.mdx") || file.path.endsWith("rule.md"))
          .map((file: any) => ({
            ...file,
            path: file.path.endsWith("rule.md") ? file.path.slice(0, -3) + ".mdx" : file.path,
          }));

        allRulesFromGithub.push(...rules);

        const { endCursor, hasNextPage } = prSearchData.search.pageInfo;
        const newCursor = endCursor || "";

        // Stop if cursor hasn't changed (prevents infinite loop)
        if (newCursor === previousCursor && previousCursor !== "") {
          break;
        }

        previousCursor = cursor;
        cursor = newCursor;
        hasMore = !!hasNextPage && newCursor !== "";
      }

      // Step 2: Process all rules at once with TinaCMS (ONE call instead of 50+)
      if (allRulesFromGithub.length > 0) {
        const uniqueRules = selectLatestRuleFilesByPath(allRulesFromGithub);
        const uris = Array.from(
          new Set(uniqueRules.map((b) => b.path.replace(/^rules\//, "").replace(/\/rule\.mdx$/, "")).filter((g): g is string => Boolean(g)))
        );

        const tinaRes = await fetch("./api/tina/rules-by-uri", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uris }),
        });
        if (!tinaRes.ok) {
          throw new Error(`Failed to fetch rules by URI: ${tinaRes.status} ${tinaRes.statusText}`);
        }
        const tinaData = await tinaRes.json();
        const edges = tinaData?.data?.ruleConnection?.edges ?? [];
        const byUri = new Map<string, any>(
          edges
            .map((e: any) => e?.node)
            .filter(Boolean)
            .map((n: any) => [n.uri, n])
        );

        const matchedRules: any[] = uris
          .map((g) => byUri.get(g))
          .filter(Boolean)
          .map((fullRule: any) => ({
            guid: fullRule.guid,
            title: fullRule.title,
            uri: fullRule.uri,
            body: fullRule.body,
            lastUpdated: fullRule.lastUpdated,
            lastUpdatedBy: fullRule.lastUpdatedBy,
            authors: Array.isArray(fullRule.authors) ? fullRule.authors.map((a: any) => a?.author).filter(Boolean) : [],
          }));

        // Sort by date (most recent first)
        const sortedRules = matchedRules.sort((a, b) => {
          const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
          const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
          return dateB - dateA; // Descending order (newest first)
        });

        setLastModifiedRules(sortedRules);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch GitHub data:", err);
      setGithubError(message);
    } finally {
      setLoadingLastModified(false);
    }
  };

  // Function to load ALL authored rules (not just one page) - WITH BATCHING
  const loadAllAuthoredRules = async (authorSlug: string) => {
    setLoadingAuthored(true);
    setAuthoredRules([]);
    let cursor: string | null = null;
    let previousCursor: string | null = null;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 100; // Safety limit to prevent infinite loops
    const allRulesFromTina: any[] = [];

    try {
      // Step 1: Fetch ALL pages from TinaCMS API (collect rules)
      while (hasMore && pageCount < MAX_PAGES) {
        pageCount++;

        const params = new URLSearchParams();
        params.set("authorSlug", authorSlug || "");
        params.set("first", FETCH_PAGE_SIZE.toString());
        if (cursor) params.set("after", cursor);

        const tinaRes = await fetch(`./api/tina/rules-by-author?${params.toString()}`);
        if (!tinaRes.ok) {
          throw new Error(`Failed to fetch rules by author: ${tinaRes.status} ${tinaRes.statusText}`);
        }
        const res = await tinaRes.json();

        const edges = res?.data?.ruleConnection?.edges ?? [];
        const nodes = edges.map((e: any) => e?.node).filter(Boolean);

        const batch = nodes.map((fullRule: any) => ({
          guid: fullRule.guid,
          title: fullRule.title,
          uri: fullRule.uri,
          body: fullRule.body,
          authors: Array.isArray(fullRule.authors) ? fullRule.authors.map((a: any) => a?.author).filter(Boolean) : [],
          lastUpdated: fullRule.lastUpdated,
          lastUpdatedBy: fullRule.lastUpdatedBy,
        }));

        allRulesFromTina.push(...batch);

        const pageInfo = res?.data?.ruleConnection?.pageInfo;
        const newCursor = pageInfo?.endCursor ?? null;
        const hasMorePages = !!pageInfo?.hasNextPage;

        // Stop if cursor hasn't changed (prevents infinite loop)
        if (newCursor === previousCursor && previousCursor !== null) {
          break;
        }

        previousCursor = cursor;
        cursor = newCursor;
        hasMore = hasMorePages && newCursor !== null;
      }

      // Step 2: Sort by date (most recent first) and set all at once
      const sortedRules = allRulesFromTina.sort((a, b) => {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateB - dateA; // Descending order (newest first)
      });

      setAuthoredRules(sortedRules);
    } catch (err) {
      console.error("Failed to fetch authored rules:", err);
    } finally {
      setLoadingAuthored(false);
    }
  };

  const TabHeader = () => (
    <div role="tablist" aria-label="User Rules Tabs" className="flex mt-2 mb-4 divide-x divide-gray-200 rounded">
      {[
        { key: Tabs.AUTHORED, label: `Authored (${authoredRules.length})` },
        { key: Tabs.MODIFIED, label: `Last Modified (${lastModifiedRules.length})` },
      ].map((t, i) => {
        const isActive = activeTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(t.key)}
            className={[
              "px-4 py-1 text-sm transition-colors hover:cursor-pointer",
              i === 0 ? "rounded-l" : "-ml-px",
              i === 1 ? "rounded-r" : "",
              isActive ? "bg-ssw-red text-white shadow-sm border-0" : "bg-white hover:text-ssw-red border",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  // Pagination helpers for Last Modified
  const totalPagesLastModified = itemsPerPageLastModified >= lastModifiedRules.length ? 1 : Math.ceil(lastModifiedRules.length / itemsPerPageLastModified);

  const paginatedLastModifiedRules = useMemo(() => {
    if (itemsPerPageLastModified >= lastModifiedRules.length) {
      return lastModifiedRules;
    }
    const startIndex = (currentPageLastModified - 1) * itemsPerPageLastModified;
    const endIndex = startIndex + itemsPerPageLastModified;
    return lastModifiedRules.slice(startIndex, endIndex);
  }, [lastModifiedRules, currentPageLastModified, itemsPerPageLastModified]);

  const handlePageChangeLastModified = (page: number) => {
    setCurrentPageLastModified(page);
  };

  const handleItemsPerPageChangeLastModified = (newItemsPerPage: number) => {
    setItemsPerPageLastModified(newItemsPerPage);
    setCurrentPageLastModified(1);
  };

  // Pagination helpers for Authored
  const totalPagesAuthored = itemsPerPageAuthored >= authoredRules.length ? 1 : Math.ceil(authoredRules.length / itemsPerPageAuthored);

  const paginatedAuthoredRules = useMemo(() => {
    if (itemsPerPageAuthored >= authoredRules.length) {
      return authoredRules;
    }
    const startIndex = (currentPageAuthored - 1) * itemsPerPageAuthored;
    const endIndex = startIndex + itemsPerPageAuthored;
    return authoredRules.slice(startIndex, endIndex);
  }, [authoredRules, currentPageAuthored, itemsPerPageAuthored]);

  const handlePageChangeAuthored = (page: number) => {
    setCurrentPageAuthored(page);
  };

  const handleItemsPerPageChangeAuthored = (newItemsPerPage: number) => {
    setItemsPerPageAuthored(newItemsPerPage);
    setCurrentPageAuthored(1);
  };

  return (
    <>
      <Breadcrumbs breadcrumbText={author?.fullName ? `${author.fullName}'s Rules` : "User Rules"} />

      <div className="layout-two-columns">
        <div className="layout-main-section mt-6">
          {githubError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
              <strong className="text-red-800">GitHub data error: </strong>
              <span className="text-sm text-red-700">{githubError}</span>
            </div>
          )}
          {author.fullName && (
            <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
              <h1 className="text-ssw-red mt-1.5">{author.fullName}'s Rules</h1>

              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://ssw.com.au/people/${author.slug}/`}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-800 border border-gray-400 rounded-md hover:border-ssw-red hover:text-ssw-red transition-colors leading-5"
              >
                <FaUserCircle className="w-4 h-4 mr-1" />
                View SSW People profile
              </a>
            </div>
          )}

          <TabHeader />

          <div className="rounded-lg border border-gray-100 bg-white p-4">
            {activeTab === Tabs.MODIFIED && (
              <>
                {lastModifiedRules.length === 0 && loadingLastModified ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="lg" text="Fetching data from GitHub... this might take a minute." />
                  </div>
                ) : lastModifiedRules.length === 0 ? (
                  <div className="py-4 text-sm text-gray-500">No rules found.</div>
                ) : (
                  <>
                    <RuleList
                      rules={paginatedLastModifiedRules}
                      showFilterControls={false}
                      showPagination={false}
                      externalCurrentPage={currentPageLastModified}
                      externalItemsPerPage={itemsPerPageLastModified}
                    />
                    <Pagination
                      currentPage={currentPageLastModified}
                      totalPages={totalPagesLastModified}
                      totalItems={lastModifiedRules.length}
                      itemsPerPage={itemsPerPageLastModified}
                      onPageChange={handlePageChangeLastModified}
                      onItemsPerPageChange={handleItemsPerPageChangeLastModified}
                    />
                  </>
                )}
              </>
            )}

            {activeTab === Tabs.AUTHORED && (
              <>
                {authoredRules.length === 0 && loadingAuthored ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="lg" text="Fetching data from GitHub... this might take a minute." />
                  </div>
                ) : authoredRules.length === 0 ? (
                  <div className="py-4 text-sm text-gray-500">No rules found.</div>
                ) : (
                  <>
                    <RuleList
                      rules={paginatedAuthoredRules}
                      showFilterControls={false}
                      showPagination={false}
                      externalCurrentPage={currentPageAuthored}
                      externalItemsPerPage={itemsPerPageAuthored}
                    />
                    <Pagination
                      currentPage={currentPageAuthored}
                      totalPages={totalPagesAuthored}
                      totalItems={authoredRules.length}
                      itemsPerPage={itemsPerPageAuthored}
                      onPageChange={handlePageChangeAuthored}
                      onItemsPerPageChange={handleItemsPerPageChangeAuthored}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
