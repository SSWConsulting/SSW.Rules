'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import client from '@/tina/__generated__/client';
import { RuleListItemHeader } from '@/components/rule-list';
import { normalizeName, toSlug } from '@/lib/utils';
import Breadcrumbs from '@/components/Breadcrumbs';

const ActionTypes = {
  BEFORE: 'before',
  AFTER: 'after',
};

export default function UserRulesClientPage() {
  const searchParams = useSearchParams();
  const [notFound, setNotFound] = useState(false);
  const [lastModifiedRules, setLastModifiedRules] = useState<any[]>([]);
  const [authoredRules, setAuthoredRules] = useState<any[]>([]);
  const [author, setAuthor] = useState<{
    fullName?: string;
    slug?: string;
    gitHubUrl?: string;
  }>({});
  
  const [previousPageCursor, setPreviousPageCursor] = useState<string[]>([]);
  const [nextPageCursor, setNextPageCursor] = useState('');
  const [tempCursor, setTempCursor] = useState('');
  const [hasNext, setHasNext] = useState(false);
  const [loadingLastModified, setLoadingLastModified] = useState(false);
  const [loadingAuthored, setLoadingAuthored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryStringRulesAuthor = searchParams.get('author') || '';

  const loadAuthorFromCrm = async (): Promise<string> => {
    try {
      const res = await fetch('/api/crm/employees');
      if (!res.ok) throw new Error('Failed to fetch CRM employees');
      const data = await res.json();
      const employees = Array.isArray(data?.value) ? data.value : [];

      const queryLower = queryStringRulesAuthor.toLowerCase();
      const match = employees.find((e: any) => (e?.gitHubUrl || '').toLowerCase().includes(queryLower));

      if (match) {
        setAuthor({
          fullName: match.fullName,
          slug: toSlug(match.fullName || queryStringRulesAuthor),
          gitHubUrl: match.gitHubUrl,
        });
        return match.fullName as string;
      } else {
        // Fallback to GitHub handle-based author if no CRM match
        setAuthor({
          fullName: normalizeName(queryStringRulesAuthor),
          slug: toSlug(queryStringRulesAuthor),
          gitHubUrl: `https://github.com/${queryStringRulesAuthor}`,
        });
        return normalizeName(queryStringRulesAuthor) || '';
      }
    } catch (err) {
      console.error('Error loading CRM author:', err);
      setAuthor({
        fullName: normalizeName(queryStringRulesAuthor),
        slug: toSlug(queryStringRulesAuthor),
        gitHubUrl: `https://github.com/${queryStringRulesAuthor}`,
      });
      return normalizeName(queryStringRulesAuthor) || '';
    }
  }

  const getLastModifiedRules = async (action?: string) => {
    try {
      setLoadingLastModified(true);
      
      let cursor: string | undefined;
      let direction: 'after' | 'before' = 'after';

      if (action === ActionTypes.BEFORE) {
        cursor = previousPageCursor[previousPageCursor.length - 1];
        direction = 'before';
      } else if (action === ActionTypes.AFTER) {
        cursor = nextPageCursor;
        direction = 'after';
      }

      const params = new URLSearchParams();
      params.set('author', queryStringRulesAuthor);
      if (cursor) params.set('cursor', cursor);
      params.set('direction', direction);

      const res = await fetch(`/api/github/rules/prs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch GitHub PR search');
      const prSearchData = await res.json();

      const resultList = prSearchData.search.nodes;
      const allRules = resultList
        .flatMap(pr => pr.files.nodes)
        .filter(file => file.path.endsWith('rule.mdx') || file.path.endsWith('rule.md'))
        .map(file => ({
          ...file,
          path: file.path.endsWith('rule.md') ? file.path.slice(0, -3) + '.mdx' : file.path,
        }));
        
      if(allRules.length === 0){
        return;
      }
      const uniqueRules = getUniqueRules(allRules);
      updateFilteredItems(uniqueRules);

      const { endCursor, startCursor, hasNextPage } = prSearchData.search.pageInfo;
      
      if (action === ActionTypes.AFTER) {
        setPreviousPageCursor([...previousPageCursor, nextPageCursor]);
      } else if (action === ActionTypes.BEFORE) {
        setPreviousPageCursor(prev => prev.slice(0, -1));
      }

      setNextPageCursor(endCursor || '');
      setTempCursor(startCursor || '');
      setHasNext(hasNextPage || false);

    } catch (error) {
      console.error('Failed to fetch GitHub data:', error);
      setError('Failed to fetch rules data. Please try again later.');
      setNotFound(true);
    } finally {
      setLoadingLastModified(false);
    }
  };

  const getUniqueRules = (files: any[]) => {
    const uniqueRulesMap = new Map();
    
    files.forEach(file => {
      const path = file.path;
      const ruleName = path.replace(/^rules\//, '').replace(/\/rule\.mdx$/, '');
      
      if (!uniqueRulesMap.has(ruleName) || 
          new Date(file.lastUpdated) > new Date(uniqueRulesMap.get(ruleName).lastUpdated)) {
        uniqueRulesMap.set(ruleName, file);
      }
    });

    return Array.from(uniqueRulesMap.values());
  }

  const updateFilteredItems = async (uniqueRules: any[]) => {
    try {
      const uris = Array.from(
        new Set(
          uniqueRules
            .map((b) => b.path.replace(/^rules\//, '').replace(/\/rule\.mdx$/, ''))
            .filter((g): g is string => Boolean(g))
        )
      );
          
      const res = await client.queries.rulesByUriQuery({ uris });
      const edges = res?.data?.ruleConnection?.edges ?? [];
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
          authors:
            fullRule.authors
              ?.map((a: any) => (a && a.title ? { title: a.title } : null))
              .filter((a: any): a is { title: string } => a !== null) || [],
        }));

        setLastModifiedRules(matchedRules);

      if (matchedRules.length !== uniqueRules.length) {
        const foundUris = new Set(matchedRules.map((r) => r.uri));
        const missingUris = uniqueRules
          .map((b) => b.path.replace(/^rules\//, '').replace(/\/rule\.mdx$/, ''))
          .filter((g) => !foundUris.has(g));
        console.warn(`Some bookmarked rules not found:`, missingUris);
      }
    } catch (ruleError) {
      console.error('Error fetching rule data:', ruleError);
      setLastModifiedRules([]);
    }
  };

  const getAuthoredRules = async (authorName: string) => {
    try {
      setLoadingAuthored(true);
      const res = await client.queries.rulesByAuthor({ authorTitle: authorName || '' });
      const edges = res?.data?.ruleConnection?.edges ?? [];
      const nodes = edges.map((e: any) => e?.node).filter(Boolean);
      const byGuid = new Map<string, any>(
        nodes.map((n: any) => [n.guid, n])
      );

      const authored = Array.from(byGuid.values()).map((fullRule: any) => ({
        guid: fullRule.guid,
        title: fullRule.title,
        uri: fullRule.uri,
        body: fullRule.body,
        authors:
          fullRule.authors
            ?.map((a: any) => (a && a.title ? { title: a.title } : null))
            .filter((a: any): a is { title: string } => a !== null) || [],
      }));

      setAuthoredRules(authored);
    } finally {
      setLoadingAuthored(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (queryStringRulesAuthor) {
        const [_, resolvedAuthorName] = await Promise.all([
          getLastModifiedRules(ActionTypes.AFTER),
          loadAuthorFromCrm(),
        ]);
        await getAuthoredRules(resolvedAuthorName as string);
      }
    })();
  }, [queryStringRulesAuthor]);

  if (!queryStringRulesAuthor) {
    return (
      <div className="w-full">
        {/* <Breadcrumb breadcrumbText="User Rules" /> */}
        <div className="container" id="rules">
          <div className="text-center py-8">
            <h2 className="text-ssw-red text-2xl mb-4">No Author Specified</h2>
            <p>Please provide an author parameter in the URL.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Breadcrumbs breadcrumbText={author?.fullName ? `${author.fullName}'s Rules` : 'User Rules'} />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            {author.fullName && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <h2 className="text-ssw-red">{author.fullName}&#39;s Rules</h2>

                <a
                  href={`https://ssw.com.au/people/${author.slug}/`}
                  className="underline unstyled hover:text-ssw-red"
                >
                  View people profile
                </a>
              </div>
            )}

            <hr className="mt-1 sm:mt-0" />

            <h3 className="text-ssw-red">
              Last Modified ({lastModifiedRules.length})
            </h3>

            <div className="rounded mb-12">
              {loadingLastModified && (
                <div className="py-4 text-sm text-gray-500">Loading last modified…</div>
              )}
              {!loadingLastModified && lastModifiedRules.length > 0 && (
                lastModifiedRules.map((rule) => (
                  <RuleListItemHeader key={rule.guid} rule={rule} index={0} />
                ))
              )}
            </div>

            <h3 className="text-ssw-red">
              Acknowledged ({authoredRules.length})
            </h3>

            <div className="rounded mb-12">
              {loadingAuthored && (
                <div className="py-4 text-sm text-gray-500">Loading authored…</div>
              )}
              {!loadingAuthored && authoredRules.length > 0 && (
                authoredRules.map((rule) => (
                  <RuleListItemHeader key={rule.guid} rule={rule} index={0} />
                ))
              )}
            </div>
          </div>
          <div className="w-full lg:w-1/4 px-4" id="sidebar">
            {/* <SideBar ruleTotalNumber={0} /> */}
          </div>
        </div>
      </div>
    </div>
  );
}