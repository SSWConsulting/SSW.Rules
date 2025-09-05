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

const Tabs = {
  LAST_MODIFIED: 'last-modified',
  ACKNOWLEDGMENT: 'acknowledgment',
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

  // Acknowledgment
  const [authoredRules, setAuthoredRules] = useState<any[]>([]);
  const [author, setAuthor] = useState<{ fullName?: string; slug?: string; gitHubUrl?: string }>({});
  const [loadingAuthored, setLoadingAuthored] = useState(false);
  const AUTHORED_PAGE_SIZE = 10;
  const [authoredNextCursor, setAuthoredNextCursor] = useState<string | null>(null);
  const [authoredHasNext, setAuthoredHasNext] = useState(false);
  const [loadingMoreAuthored, setLoadingMoreAuthored] = useState(false);

  const resolveAuthor = async (): Promise<string> => {
    const res = await fetch(`/api/crm/employees?query=${encodeURIComponent(queryStringRulesAuthor)}`);
    if (!res.ok) throw new Error('Failed to resolve author');
    const profile = await res.json();
    setAuthor(profile);
    return profile.fullName as string;
  };

  const getLastModifiedRules = async (opts?: { append?: boolean }) => {
    const append = !!opts?.append;
    try {
      append ? setLoadingMoreLastModified(true) : setLoadingLastModified(true);
  
      const params = new URLSearchParams();
      params.set('author', queryStringRulesAuthor);
      if (append && nextPageCursor) params.set('cursor', nextPageCursor);
      params.set('direction', 'after');
  
      const res = await fetch(`/api/github/rules/prs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch GitHub PR search');
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
      console.error('Failed to fetch GitHub data:', err);
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
      setAuthoredNextCursor(pageInfo?.endCursor ?? null);
      setAuthoredHasNext(!!pageInfo?.hasNextPage);
  
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
        const [_, resolvedAuthorName] = await Promise.all([getLastModifiedRules({ append: true }), resolveAuthor()]);
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
    <div role="tablist" aria-label="User Rules Tabs" className="flex items-center gap-2 mt-2 mb-4">
      {[
        { key: Tabs.LAST_MODIFIED, label: `Last Modified (${lastModifiedRules.length})` },
        { key: Tabs.ACKNOWLEDGMENT, label: `Acknowledgment (${authoredRules.length})` },
      ].map((t) => {
        const isActive = activeTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(t.key)}
            className={[
              'group px-4 py-1 text-sm border rounded cursor-pointer hover:text-white transition-colors',
              'hover:bg-ssw-red/100 hover:text-white hover:cursor-pointer',
              isActive
                ? 'bg-ssw-red text-white shadow-sm'
                : 'bg-white hover:text-ssw-red',
            ].join(' ')}
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
      return <div className="py-4 text-sm text-gray-500">Loading…</div>;
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
        <div className="layout-main-section">
          {author.fullName && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <h2 className="text-ssw-red">{author.fullName}&#39;s Rules</h2>
              <a href={`https://ssw.com.au/people/${author.slug}/`} className="underline unstyled hover:text-ssw-red">
                View people profile
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

              {activeTab === Tabs.ACKNOWLEDGMENT &&
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
