'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import client from '@/tina/__generated__/client';
import Breadcrumbs from '@/components/Breadcrumbs';
import HelpCard from '@/components/HelpCard';
import RuleCount from '@/components/RuleCount';
import WhyRulesCard from '@/components/WhyRulesCard';
import HelpImproveCard from '@/components/HelpImproveCard';
import AboutSSWCard from '@/components/AboutSSWCard';
import JoinConversationCard from '@/components/JoinConversationCard';
import { appendNewRules } from '@/utils/appendNewRules';
import { selectLatestRuleFilesByPath } from '@/utils/selectLatestRuleFilesByPath';
import LoadMoreButton from '@/components/LoadMoreButton';
import RuleCard from '@/components/RuleCard';
import Spinner from '@/components/Spinner';
import { FaUserCircle } from 'react-icons/fa';

const Tabs = {
  LAST_MODIFIED: 'last-modified',
  Acknowledged: 'acknowledged',
} as const;

type TabKey = typeof Tabs[keyof typeof Tabs];

export default function UserRulesClientPage({ ruleCount }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(Tabs.LAST_MODIFIED);
  const queryStringRulesAuthor = searchParams.get('author') || '';

  // Last Modified
  const [lastModifiedRules, setLastModifiedRules] = useState<any[]>([]);
  const [loadingLastModified, setLoadingLastModified] = useState(false);
  const [loadingMoreLastModified, setLoadingMoreLastModified] = useState(false);
  const [nextPageCursor, setNextPageCursor] = useState('');
  const [hasNext, setHasNext] = useState(false);

  // Acknowledged
  const [authoredRules, setAuthoredRules] = useState<any[]>([]);
  const [author, setAuthor] = useState<{ fullName?: string; slug?: string; gitHubUrl?: string }>({});
  const [loadingAuthored, setLoadingAuthored] = useState(false);
  const AUTHORED_PAGE_SIZE = 10;
  const [authoredNextCursor, setAuthoredNextCursor] = useState<string | null>(null);
  const [authoredHasNext, setAuthoredHasNext] = useState(false);
  const [loadingMoreAuthored, setLoadingMoreAuthored] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  const resolveAuthor = async (): Promise<string> => {
    const res = await fetch(`./api/crm/employees?query=${encodeURIComponent(queryStringRulesAuthor)}`);
    if (!res.ok) throw new Error('Failed to resolve author');
    const profile = await res.json();
    setAuthor(profile);
    return profile.fullName as string;
  };

  const getLastModifiedRules = async (opts?: { append?: boolean }) => {
    const append = !!opts?.append;
    try {
      // clear previous GitHub errors when starting a fetch
      setGithubError(null);
      append ? setLoadingMoreLastModified(true) : setLoadingLastModified(true);
  
      const params = new URLSearchParams();
      params.set('author', queryStringRulesAuthor);
      if (append && nextPageCursor) params.set('cursor', nextPageCursor);
      params.set('direction', 'after');
  
      const url = `./api/github/rules/prs?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        let body = '';
        try {
          body = await res.text();
        } catch (e) {
          body = String(e);
        }
        throw new Error(`Failed to fetch GitHub PR search: ${res.status} ${res.statusText} - ${body}`);
      }
      const prSearchData = await res.json();
  
      const resultList = prSearchData.search.nodes;
      const allRules = resultList
        .flatMap((pr: any) => pr.files.nodes)
        .filter((file: any) => file.path.endsWith('rule.mdx') || file.path.endsWith('rule.md'))
        .map((file: any) => ({
          ...file,
          path: file.path.endsWith('rule.md') ? file.path.slice(0, -3) + '.mdx' : file.path,
        }));
  
      if (allRules.length === 0 && !append) {
        setLastModifiedRules([]);
      } else if (allRules.length > 0) {
        const uniqueRules = selectLatestRuleFilesByPath(allRules);
        await updateFilteredItems(uniqueRules, append);
      }
  
      const { endCursor, hasNextPage } = prSearchData.search.pageInfo;
      setNextPageCursor(endCursor || '');
      setHasNext(!!hasNextPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch GitHub data:', err);
      setGithubError(message);
    } finally {
      append ? setLoadingMoreLastModified(false) : setLoadingLastModified(false);
    }
  };
  
  const updateFilteredItems = async (uniqueRules: any[], append = false) => {
    try {
      const uris = Array.from(
        new Set(
          uniqueRules
            .map((b) => b.path.replace(/^rules\//, '').replace(/\/rule\.mdx$/, ''))
            .filter((g): g is string => Boolean(g)),
        ),
      );

      const res = await client.queries.rulesByUriQuery({ uris });
      const edges = res?.data?.ruleConnection?.edges ?? [];
      const byUri = new Map<string, any>(
        edges
          .map((e: any) => e?.node)
          .filter(Boolean)
          .map((n: any) => [n.uri, n]),
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
          authors:
            fullRule.authors
              ?.map((a: any) => (a && a.title ? { title: a.title } : null))
              .filter((a: any): a is { title: string } => a !== null) || [],
        }));

      setLastModifiedRules((prev) => (append ? appendNewRules(prev, matchedRules) : matchedRules));

      if (matchedRules.length !== uniqueRules.length) {
        const foundUris = new Set(matchedRules.map((r) => r.uri));
        const missingUris = uniqueRules
          .map((b) => b.path.replace(/^rules\//, '').replace(/\/rule\.mdx$/, ''))
          .filter((g) => !foundUris.has(g));
        console.warn(`Some bookmarked rules not found:`, missingUris);
      }
    } catch (ruleError) {
      console.error('Error fetching rule data:', ruleError);
      if (!append) setLastModifiedRules([])
    }
  };

  const getAuthoredRules = async (authorName: string, opts?: { append?: boolean }) => {
    const append = !!opts?.append;
    try {
      append ? setLoadingMoreAuthored(true) : setLoadingAuthored(true);
  
      const res = await client.queries.rulesByAuthor({
        authorTitle: authorName || '',
        first: AUTHORED_PAGE_SIZE,
        after: append ? authoredNextCursor : undefined,
      });
  
      const edges = res?.data?.ruleConnection?.edges ?? [];
      const nodes = edges.map((e: any) => e?.node).filter(Boolean);
  
      const pageInfo = res?.data?.ruleConnection?.pageInfo;
      const totalFetched = nodes.length;
      const hasMorePages = !!pageInfo?.hasNextPage;

      setAuthoredNextCursor(pageInfo?.endCursor ?? null);
      setAuthoredHasNext(hasMorePages && totalFetched === AUTHORED_PAGE_SIZE);
  
      const batch = nodes.map((fullRule: any) => ({
        guid: fullRule.guid,
        title: fullRule.title,
        uri: fullRule.uri,
        body: fullRule.body,
        authors:
          fullRule.authors
            ?.map((a: any) => (a && a.title ? { title: a.title } : null))
            .filter((a: any): a is { title: string } => a !== null) || [],
        lastUpdated: fullRule.lastUpdated,
        lastUpdatedBy: fullRule.lastUpdatedBy
      }));
  
      setAuthoredRules((prev) => (append ? appendNewRules(prev, batch) : batch));
    } finally {
      append ? setLoadingMoreAuthored(false) : setLoadingAuthored(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (queryStringRulesAuthor) {
        const [_, resolvedAuthorName] = await Promise.all([getLastModifiedRules(), resolveAuthor()]);
        await getAuthoredRules(resolvedAuthorName as string);
      }
    })();
  }, [queryStringRulesAuthor]);

  const handleLoadMoreLastModified = () => {
    if (loadingMoreLastModified || !hasNext) return;
    getLastModifiedRules({ append: true });
  };

  const handleLoadMoreAcknowledgment = () => {
    if (loadingMoreAuthored || !authoredHasNext) return;
    getAuthoredRules(author.fullName || '', { append: true });
  };

  const TabHeader = () => (
    <div role="tablist" aria-label="User Rules Tabs" className="flex mt-2 mb-4 divide-x divide-gray-200 rounded">
      {[
        { key: Tabs.LAST_MODIFIED, label: `Last Modified (${lastModifiedRules.length})` },
        { key: Tabs.Acknowledged, label: `Authored (${authoredRules.length})` },
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
              isActive
                ? "bg-ssw-red text-white shadow-sm border-0"
                : "bg-white hover:text-ssw-red border",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const renderList = (
    items: any[],
    {
      loadingInitial,
      loadingMore,
      hasNextPage,
      onLoadMore,
      emptyText = 'No results found.',
    }: {
      loadingInitial: boolean;
      loadingMore: boolean;
      hasNextPage: boolean;
      onLoadMore: () => void;
      emptyText?: string;
    },
  ) => {
    if (items.length === 0 && loadingInitial) {
      return <Spinner size="lg" className='center' />
    }
    if (items.length === 0) {
      return <div className="py-4 text-sm text-gray-500">{emptyText}</div>;
    }
    return (
      <>
        {items.map((rule, i) => (
          <RuleCard
            key={rule.guid ?? rule.uri}
            index={i}
            title={rule.title}
            slug={rule.uri}
            lastUpdatedBy={rule.lastUpdatedBy ?? null}
            lastUpdated={rule.lastUpdated ?? null}
            authorUrl={author.gitHubUrl ?? null}
          />
        ))}
        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <LoadMoreButton onClick={onLoadMore} disabled={loadingMore} loading={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load More'}
            </LoadMoreButton>
          </div>
        )}
      </>
    );
  };
  
  return (
    <>
      <Breadcrumbs breadcrumbText={author?.fullName ? `${author.fullName}'s Rules` : 'User Rules'} />

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
              <h2 className="text-ssw-red mt-1.5">{author.fullName}'s Rules</h2>
            
              <a
                target="_blank"
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
              {activeTab === Tabs.LAST_MODIFIED &&
                  renderList(lastModifiedRules, {
                  loadingInitial: loadingLastModified,
                  loadingMore: loadingMoreLastModified,
                  hasNextPage: hasNext,
                  onLoadMore: handleLoadMoreLastModified,
                })}

              {activeTab === Tabs.Acknowledged &&
                renderList(authoredRules, {
                  loadingInitial: loadingAuthored,
                  loadingMore: loadingMoreAuthored,
                  hasNextPage: authoredHasNext,
                  onLoadMore: handleLoadMoreAcknowledgment,
              })}
          </div>
        </div>

        <div className="layout-sidebar">
          <div className="h-[3.5rem]">
            {ruleCount && <RuleCount count={ruleCount} />}
          </div>
          <WhyRulesCard />
          <HelpImproveCard />
          <HelpCard />
          <AboutSSWCard />
          <JoinConversationCard />
        </div>
      </div>
    </>
  );
}
