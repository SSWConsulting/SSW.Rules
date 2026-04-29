"use client";

import { getAccessToken } from "@auth0/nextjs-auth0";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FaAddressCard, FaUserCircle } from "react-icons/fa";
import { RiGithubFill } from "react-icons/ri";
import { useAuth } from "@/components/auth/UserClientProvider";
import Breadcrumbs from "@/components/Breadcrumbs";
import RadioButton from "@/components/radio-button/radio-button";
import RuleList from "@/components/rule-list";
import Spinner from "@/components/Spinner";
import Pagination from "@/components/ui/pagination";
import { BookmarkService } from "@/lib/bookmarkService";
import { BookmarkedRule, Rule, UserBookmarksResponse } from "@/types";
import { RuleListFilter } from "@/types/ruleListFilter";

const Tabs = {
  MODIFIED: "modified",
  AUTHORED: "authored",
  BOOKMARKED: "bookmarked",
} as const;

type TabKey = (typeof Tabs)[keyof typeof Tabs];

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function UserRulesClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(Tabs.AUTHORED);
  const queryStringRulesAuthor = searchParams.get("author") || "";

  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  const isOwnProfile = user?.nickname === queryStringRulesAuthor;
  const showBookmarks = isAuthenticated && isOwnProfile;

  const [sharedFilter, setSharedFilter] = useState<RuleListFilter>(RuleListFilter.Blurb);

  const [bookmarkedRules, setBookmarkedRules] = useState<BookmarkedRule[]>([]);
  const [bookmarkRules, setBookmarkRules] = useState<Rule[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

  // Last Modified
  const [lastModifiedRules, setLastModifiedRules] = useState<any[]>([]);
  const [loadingLastModified, setLoadingLastModified] = useState(false);
  const [currentPageLastModified, setCurrentPageLastModified] = useState(1);
  const [itemsPerPageLastModified, setItemsPerPageLastModified] = useState(20);

  // Authored
  const [authoredRules, setAuthoredRules] = useState<any[]>([]);
  const [author, setAuthor] = useState<{ fullName?: string; slug?: string; gitHubUrl?: string }>({});
  const [loadingAuthored, setLoadingAuthored] = useState(false);
  const [authoredFullyLoaded, setAuthoredFullyLoaded] = useState(false);
  const [loadingMoreAuthored, setLoadingMoreAuthored] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [authorFoundInCRM, setAuthorFoundInCRM] = useState<boolean | null>(null);
  const [currentPageAuthored, setCurrentPageAuthored] = useState(1);
  const [itemsPerPageAuthored, setItemsPerPageAuthored] = useState(20);
  const FETCH_PAGE_SIZE = 20;

  // Pagination helpers (must be before early returns)
  const totalPagesLastModified = itemsPerPageLastModified >= lastModifiedRules.length ? 1 : Math.ceil(lastModifiedRules.length / itemsPerPageLastModified);

  const paginatedLastModifiedRules = useMemo(() => {
    if (itemsPerPageLastModified >= lastModifiedRules.length) {
      return lastModifiedRules;
    }
    const startIndex = (currentPageLastModified - 1) * itemsPerPageLastModified;
    const endIndex = startIndex + itemsPerPageLastModified;
    return lastModifiedRules.slice(startIndex, endIndex);
  }, [lastModifiedRules, currentPageLastModified, itemsPerPageLastModified]);

  const totalPagesAuthored = itemsPerPageAuthored >= authoredRules.length ? 1 : Math.ceil(authoredRules.length / itemsPerPageAuthored);

  const paginatedAuthoredRules = useMemo(() => {
    if (itemsPerPageAuthored >= authoredRules.length) {
      return authoredRules;
    }
    const startIndex = (currentPageAuthored - 1) * itemsPerPageAuthored;
    const endIndex = startIndex + itemsPerPageAuthored;
    return authoredRules.slice(startIndex, endIndex);
  }, [authoredRules, currentPageAuthored, itemsPerPageAuthored]);

  const isInvalidUser = authorFoundInCRM === false && authoredFullyLoaded;

  const tabItems = [
    { key: Tabs.AUTHORED, label: authoredFullyLoaded ? `Authored (${authoredRules.length})` : "Authored" },
    { key: Tabs.MODIFIED, label: loadingLastModified ? "Last Modified" : `Last Modified (${lastModifiedRules.length})` },
    ...(showBookmarks ? [{ key: Tabs.BOOKMARKED, label: `Bookmarks (${bookmarkCount})` }] : []),
  ];

  const resolveAuthor = async (): Promise<string> => {
    const res = await fetch(`./api/crm/employees?query=${encodeURIComponent(queryStringRulesAuthor)}`);
    if (!res.ok) throw new Error("Failed to resolve author");
    const profile = await res.json();
    setAuthor(profile);
    setAuthorFoundInCRM(profile.found === true);
    return profile.fullName as string;
  };

  // Auto-redirect to own profile if logged in but no author param
  useEffect(() => {
    if (!authLoading && isAuthenticated && !queryStringRulesAuthor && user?.nickname) {
      router.replace(`/user?author=${user.nickname}`);
    }
  }, [authLoading, isAuthenticated, queryStringRulesAuthor, user?.nickname, router]);

  useEffect(() => {
    (async () => {
      if (queryStringRulesAuthor) {
        const lastModifiedPromise = loadAllLastModifiedRules();

        try {
          const resolvedAuthorName = await resolveAuthor();
          await Promise.all([loadAllAuthoredRules(resolvedAuthorName as string), lastModifiedPromise]);
        } catch (err) {
          console.error("Failed to resolve author from CRM:", err);
          await lastModifiedPromise;
        }
      }
    })();
  }, [queryStringRulesAuthor]);

  // Fetch bookmarks when viewing own profile
  useEffect(() => {
    if (showBookmarks && activeTab === Tabs.BOOKMARKED) {
      getBookmarkList();
    }
  }, [showBookmarks, activeTab, user]);

  async function getBookmarkList() {
    if (!user?.sub) {
      setIsLoadingBookmarks(false);
      return;
    }

    try {
      setIsLoadingBookmarks(true);
      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error("No access token available");
        setIsLoadingBookmarks(false);
        return;
      }

      const bookmarkResult: UserBookmarksResponse = await BookmarkService.getUserBookmarks(user.sub, accessToken);

      if (!bookmarkResult.error && bookmarkResult.bookmarkedRules) {
        setBookmarkedRules(bookmarkResult.bookmarkedRules);
        setBookmarkCount(bookmarkResult.bookmarkedRules.length);

        if (bookmarkResult.bookmarkedRules.length > 0) {
          try {
            const guids = Array.from(new Set(bookmarkResult.bookmarkedRules.map((b) => b.ruleGuid).filter((g): g is string => Boolean(g))));

            const res = await fetch(`${BASE_PATH}/api/rules/by-guid`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ guids }),
            });

            if (!res.ok) {
              throw new Error("Failed to fetch rules by GUID");
            }

            const { rules: fetchedRules } = await res.json();
            const byGuid = new Map<string, any>(fetchedRules.map((r: any) => [r.guid, r]));

            const matchedRules: any[] = guids
              .map((g) => byGuid.get(g))
              .filter(Boolean)
              .map((fullRule: any) => ({
                guid: fullRule.guid,
                title: fullRule.title,
                uri: fullRule.uri,
                body: fullRule.body,
                isBookmarked: true,
                authors: fullRule.authors || [],
              }));

            setBookmarkRules(matchedRules);

            if (matchedRules.length !== bookmarkResult.bookmarkedRules.length) {
              const foundGuids = new Set(matchedRules.map((r) => r.guid));
              const missingGuids = bookmarkResult.bookmarkedRules.map((b) => b.ruleGuid).filter((g) => !foundGuids.has(g));
              console.warn(`Some bookmarked rules not found:`, missingGuids);
            }
          } catch (ruleError) {
            console.error("Error fetching rule data:", ruleError);
            setBookmarkRules([]);
          }
        } else {
          setBookmarkRules([]);
        }
      } else {
        console.error("Failed to fetch bookmarks:", bookmarkResult.message);
        setBookmarkedRules([]);
        setBookmarkCount(0);
        setBookmarkRules([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setBookmarkedRules([]);
      setBookmarkCount(0);
      setBookmarkRules([]);
    } finally {
      setIsLoadingBookmarks(false);
    }
  }

  const handleBookmarkRemoved = async (ruleGuid: string) => {
    if (!user?.sub) {
      console.error("No user ID available");
      return;
    }

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error("No access token available");
        return;
      }

      const removeResult = await BookmarkService.removeBookmark({ ruleGuid, userId: user.sub }, accessToken);

      if (removeResult.error) {
        console.error("Failed to remove bookmark:", removeResult.message);
        return;
      }

      setBookmarkedRules((prevRules) => {
        const updatedRules = prevRules.filter((bookmark) => bookmark.ruleGuid !== ruleGuid);
        setBookmarkCount(updatedRules.length);
        return updatedRules;
      });

      setBookmarkRules((prevRules) => {
        return prevRules.filter((rule) => rule.guid !== ruleGuid);
      });
    } catch (error) {
      console.error("Error removing bookmark:", error);
    }
  };

  // Function to load last modified rules using the new API
  const loadAllLastModifiedRules = async () => {
    setLoadingLastModified(true);
    setLastModifiedRules([]);

    try {
      const res = await fetch(`/rules/api/rules/last-modified?username=${encodeURIComponent(queryStringRulesAuthor)}&limit=50`);

      if (!res.ok) {
        throw new Error(`Failed to fetch last modified rules: ${res.status}`);
      }

      const data = await res.json();

      const rules = (data.items || []).map((item: any) => ({
        title: item.title,
        uri: item.uri,
        lastUpdated: item.lastModifiedAt,
        body: item.body,
      }));

      setLastModifiedRules(rules);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch last modified rules:", err);
      setGithubError(message);
    } finally {
      setLoadingLastModified(false);
    }
  };

  // Fetch authored rules progressively:
  // - render once the first page returns
  // - keep fetching and appending in the background
  // - only enable pagination UI once all results are fetched
  const loadAllAuthoredRules = async (authorName: string) => {
    setLoadingAuthored(true);
    setLoadingMoreAuthored(false);
    setAuthoredFullyLoaded(false);
    setAuthoredRules([]);
    setCurrentPageAuthored(1);

    let cursor: string | null = null;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 100;
    const MAX_AUTHORED_RULES = 100;
    const allRulesFromTina: any[] = [];
    const seenKeys = new Set<string>();

    try {
      while (hasMore && pageCount < MAX_PAGES && allRulesFromTina.length < MAX_AUTHORED_RULES) {
        pageCount++;

        const params = new URLSearchParams();
        params.set("authorTitle", authorName || "");
        params.set("last", FETCH_PAGE_SIZE.toString());
        if (cursor) params.set("before", cursor);

        const tinaRes = await fetch(`./api/tina/rules-by-author?${params.toString()}`);
        if (!tinaRes.ok) {
          throw new Error(`Failed to fetch rules by author: ${tinaRes.status} ${tinaRes.statusText}`);
        }
        const res = await tinaRes.json();

        const edges = res?.data?.ruleConnection?.edges ?? [];
        const nodes = edges.map((e: any) => e?.node).filter(Boolean);

        const batch = nodes
          .map((fullRule: any) => ({
            guid: fullRule.guid,
            title: fullRule.title,
            uri: fullRule.uri,
            body: fullRule.body,
            authors: fullRule.authors?.map((a: any) => (a && a.title ? { title: a.title } : null)).filter((a: any): a is { title: string } => a !== null) || [],
            lastUpdated: fullRule.lastUpdated,
            lastUpdatedBy: fullRule.lastUpdatedBy,
          }))
          .filter((r: any) => {
            const key = r.guid || r.uri;
            if (!key) return true;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

        allRulesFromTina.push(...batch);
        if (allRulesFromTina.length > MAX_AUTHORED_RULES) {
          allRulesFromTina.length = MAX_AUTHORED_RULES;
        }

        setAuthoredRules([...allRulesFromTina]);
        if (pageCount === 1) {
          setLoadingAuthored(false);
        } else {
          setLoadingMoreAuthored(true);
        }

        const pageInfo = res?.data?.ruleConnection?.pageInfo;
        const newCursor = pageInfo?.startCursor ?? null;
        const hasMorePages = !!pageInfo?.hasPreviousPage;

        if (newCursor === cursor && cursor !== null) {
          break;
        }

        cursor = newCursor;
        hasMore = hasMorePages && newCursor !== null;
      }
    } catch (err) {
      console.error("Failed to fetch authored rules:", err);
    } finally {
      setAuthoredFullyLoaded(true);
      setLoadingMoreAuthored(false);
      setLoadingAuthored(false);
      setItemsPerPageAuthored(20);
      setCurrentPageAuthored(1);
    }
  };

  // Not logged in - show login prompt
  if (!authLoading && !isAuthenticated && !queryStringRulesAuthor) {
    return (
      <>
        <Breadcrumbs breadcrumbText="User Rules" />
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <p className="text-xl text-gray-600 mb-4">Sign in to view user profiles</p>
            <a
              href={`${BASE_PATH}/auth/login?returnTo=${encodeURIComponent(`/user`)}`}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-ssw-red rounded-md hover:bg-ssw-red/90"
            >
              <RiGithubFill size={18} className="mr-2" />
              Sign in with GitHub
            </a>
          </div>
        </div>
      </>
    );
  }

  // Loading state
  if (authLoading) {
    return (
      <>
        <Breadcrumbs breadcrumbText="User Rules" />
        <div className="flex items-center justify-center min-h-100">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  if (isInvalidUser) {
    return (
      <>
        <Breadcrumbs breadcrumbText="User Rules" />
        <div className="layout-two-columns">
          <div className="layout-main-section mt-6">
            <div className="min-w-full shadow-lg rounded mb-6">
              <section className="mb-4 rounded">
                <div className="flex flex-col gap-6 p-8 bg-[#f5f5f5] rounded-t">
                  <div className="flex gap-6 items-center">
                    <FaUserCircle size={100} className="text-gray-300" />
                    <div>
                      <h1 className="text-ssw-red">{queryStringRulesAuthor}</h1>
                      <p className="mt-2 text-gray-500">This user is invalid</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  const handleFilterChange = (e: { target: { value: string } }) => {
    setSharedFilter(e.target.value as RuleListFilter);
  };

  const TabHeader = () => (
    <div role="tablist" aria-label="User Rules Tabs" className="flex m-4 mx-6 divide-x divide-gray-200 rounded">
      {tabItems.map((t, i) => {
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
              i === 0 ? "rounded-l" : "",
              i === tabItems.length - 1 ? "rounded-r" : "",
              isActive ? "bg-ssw-red text-white shadow-sm border-0" : "bg-white hover:text-ssw-red border",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const handlePageChangeLastModified = (page: number) => {
    setCurrentPageLastModified(page);
  };

  const handleItemsPerPageChangeLastModified = (newItemsPerPage: number) => {
    setItemsPerPageLastModified(newItemsPerPage);
    setCurrentPageLastModified(1);
  };

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

          <div className="min-w-full shadow-lg rounded mb-6">
            <section className="mb-4 rounded">
              <div className="flex flex-col gap-6 p-8 bg-[#f5f5f5] rounded-t">
                <div className="flex gap-6 items-center">
                  <Image
                    src={`https://avatars.githubusercontent.com/${queryStringRulesAuthor}`}
                    alt={queryStringRulesAuthor || ""}
                    title={queryStringRulesAuthor}
                    width={100}
                    height={100}
                    className="rounded-full object-cover"
                  />
                  <div>
                    <h1 className="text-ssw-red">{author?.fullName || queryStringRulesAuthor}</h1>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <a
                        href={`https://github.com/${queryStringRulesAuthor}`}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center text-sm text-gray-700 hover:text-ssw-red transition-colors"
                      >
                        <RiGithubFill size={16} className="mr-1" />
                        GitHub Profile
                      </a>
                      {author?.slug && (
                        <a
                          href={`https://ssw.com.au/people/${author.slug}/`}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center text-sm text-gray-700 hover:text-ssw-red transition-colors"
                        >
                          <FaAddressCard size={16} className="mr-1" />
                          SSW People Profile
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <TabHeader />

              <div className="rounded-lg border border-gray-100 bg-white py-4 px-6">
                <div className="flex items-center py-2 mb-2">
                  <span className="mr-4 hidden sm:block">Show me</span>
                  <RadioButton
                    id="userFilterTitleOnly"
                    value={RuleListFilter.TitleOnly}
                    selectedOption={sharedFilter}
                    handleOptionChange={handleFilterChange}
                    labelText="Titles"
                    position="first"
                  />
                  <RadioButton
                    id="userFilterBlurb"
                    value={RuleListFilter.Blurb}
                    selectedOption={sharedFilter}
                    handleOptionChange={handleFilterChange}
                    labelText="Blurbs"
                    position="middle"
                  />
                  <RadioButton
                    id="userFilterAll"
                    value={RuleListFilter.All}
                    selectedOption={sharedFilter}
                    handleOptionChange={handleFilterChange}
                    labelText="Everything"
                    position="last"
                  />
                </div>

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
                          key={sharedFilter}
                          rules={paginatedLastModifiedRules}
                          showFilterControls={false}
                          showPagination={false}
                          initialFilter={sharedFilter}
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
                        <Spinner size="lg" text="Loading authored rules... this might take a minute." />
                      </div>
                    ) : authoredRules.length === 0 ? (
                      <div className="py-4 text-sm text-gray-500">No rules found.</div>
                    ) : (
                      <>
                        <RuleList
                          key={sharedFilter}
                          rules={paginatedAuthoredRules}
                          showFilterControls={false}
                          showPagination={false}
                          initialFilter={sharedFilter}
                          externalCurrentPage={currentPageAuthored}
                          externalItemsPerPage={itemsPerPageAuthored}
                        />
                        {!authoredFullyLoaded && loadingMoreAuthored && (
                          <div className="mt-4 text-center text-sm text-gray-500">Loading more authored rules...</div>
                        )}

                        {authoredFullyLoaded && (
                          <Pagination
                            currentPage={currentPageAuthored}
                            totalPages={totalPagesAuthored}
                            totalItems={authoredRules.length}
                            itemsPerPage={itemsPerPageAuthored}
                            onPageChange={handlePageChangeAuthored}
                            onItemsPerPageChange={handleItemsPerPageChangeAuthored}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {activeTab === Tabs.BOOKMARKED && showBookmarks && (
                  <>
                    {isLoadingBookmarks ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner size="lg" />
                      </div>
                    ) : (
                      <RuleList
                        key={sharedFilter}
                        rules={bookmarkRules}
                        type={"bookmark"}
                        noContentMessage="No bookmarks? Use them to save rules for later!"
                        showFilterControls={false}
                        initialFilter={sharedFilter}
                        onBookmarkRemoved={handleBookmarkRemoved}
                      />
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
