"use client";

import { Card } from "@/components/ui/card";
import { tinaField, useTina } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import Image from "next/image";
import {
  RiPencilLine,
  RiGithubLine,
  RiHistoryLine,
} from "react-icons/ri";
import Bookmark from "@/components/Bookmark";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { formatDateLong, timeAgo } from "@/lib/dateUtils";
import { getMarkdownComponentMapping } from "@/components/tina-markdown/markdown-component-mapping";
import HelpCard from "@/components/HelpCard";
import Acknowledgements from "@/components/Acknowledgements";
import { getAccessToken } from "@auth0/nextjs-auth0";
import { BookmarkService } from "@/lib/bookmarkService";
import Discussion from "@/components/Discussion";
import { useRouter } from "next/navigation";
import { ICON_SIZE } from "@/constants";
import { extractUsernameFromUrl } from "@/lib/services/github";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useAuth } from "@/components/auth/UserClientProvider";
import { useMarkHighlight } from "@/lib/useMarkHighlight";
import { IconLink } from "@/components/ui";
import RelatedRules from "@/components/RelatedRules";

export interface ClientRulePageProps {
  ruleQueryProps;
  ruleCategoriesMapping;
  relatedRulesMapping?: { uri: string; title: string }[];
}

export default function ClientRulePage(props: ClientRulePageProps) {
  const { ruleQueryProps } = props;
  const { user } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const router = useRouter();
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);
  const [isAdminPage, setIsAdminPage] = useState(false);
  
  // Remove any extra slashes from the base path
  const sanitizedBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\/+/, '');

  useEffect(() => {
    try {
      const isAdmin = window.top?.location?.pathname.includes('/admin') ?? false;
      setIsAdminPage(isAdmin);
    } catch {
      setIsAdminPage(false);
    }
  }, []);

  const ruleData = useTina({
    query: ruleQueryProps?.query,
    variables: ruleQueryProps?.variables,
    data: ruleQueryProps?.data,
  }).data;
  const rule = ruleData?.rule;

  const relativeTime = useMemo(() => {
    return rule?.lastUpdated ? timeAgo(rule?.lastUpdated) : "";
  }, [rule?.lastUpdated]);

  const historyTooltip = useMemo(() => {
    const created = rule?.created ? formatDateLong(rule?.created) : "Unknown";
    const updated = rule?.lastUpdated
      ? formatDateLong(rule?.lastUpdated)
      : "Unknown";
    return `Created ${created}\nLast Updated ${updated}`;
  }, [rule?.created, rule?.lastUpdated]);

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef, "ul li div");

  const fetchGitHubUsernameFromCrmName = async (lastUpdatedBy: string): Promise<string | null> => {
    if (!lastUpdatedBy) return null;
    if (authorUsername) return authorUsername;
    try {
      setIsLoadingUsername(true);
      const res = await fetch(`./api/crm/employees/${encodeURIComponent(lastUpdatedBy)}`);
      if (!res.ok) throw new Error('Failed to fetch CRM employee');
      const { employee } = await res.json();
      const username = extractUsernameFromUrl(employee?.gitHubUrl) || null;
      if (username) setAuthorUsername(username);
      return username;
    } catch (error) {
      console.error('Failed to fetch GitHub username:', error);
      return null;
    } finally {
      setIsLoadingUsername(false);
    }
  };

  const handleAuthorClick = async (lastUpdatedBy: string) => {
    const username = await fetchGitHubUsernameFromCrmName(lastUpdatedBy);
  
    if (username) {
      router.push(`./user?author=${encodeURIComponent(username)}`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const lastUpdatedBy = rule?.lastUpdatedBy;
      if (!lastUpdatedBy) return;
      try {
        await fetchGitHubUsernameFromCrmName(lastUpdatedBy);
        if (!isMounted) return;
      } catch {
        // Silently ignore prefetch errors; click fallback will handle
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [rule?.lastUpdatedBy]);
  
  useEffect(() => {
    (async () => {
      if (user?.sub && rule?.uri) {
        try {
          const accessToken = await getAccessToken();
          
          if (accessToken) {
            const result = await BookmarkService.getBookmarkStatus(rule.guid, user.sub, accessToken);
            if (!result.error) {
              setIsBookmarked(result.bookmarkStatus || false);
            }
          }
        } catch (error) {
          console.error('Error fetching bookmarks:', error);
        }
      }
    })();
  }, [user?.sub, rule?.guid]);

  const primaryCategory = useMemo(
    () => props.ruleCategoriesMapping?.[0],
    [props.ruleCategoriesMapping]
  );

  const breadcrumbCategories = useMemo(() => {
    if (!primaryCategory) return undefined;
    return [{ title: primaryCategory.title, link: `/${primaryCategory.uri}` }];
  }, [primaryCategory]);

  return (
    <>
      <Breadcrumbs categories={breadcrumbCategories} breadcrumbText="This rule" />
      <div className="layout-two-columns">
        <Card dropShadow className="layout-main-section p-6">
          <div className="flex border-b-2 pb-3">
            {rule?.thumbnail && rule.thumbnail.trim() !== "" && (
              <div className="w-[175px] h-[175px] relative mr-4">
                <Image
                  data-tina-field={tinaField(rule, "thumbnail")}
                  src={rule?.thumbnail}
                  alt="thumbnail image for the rule"
                  fill
                  className="object-cover object-center"
                />
              </div>
            )}
            <div className="flex flex-col flex-1 justify-between">
              <h1
                className="text-ssw-red text-4xl leading-[1.2] my-0 b-4 font-semibold"
                data-tina-field={tinaField(rule, "title")}
              >
                {rule?.title}
              </h1>
              <div className="flex justify-between">
                <p className="mt-4 text-sm font-light">
                  Updated by{" "}
                  {rule?.lastUpdatedBy ? (
                    authorUsername ? (
                      <Link href={`./user?author=${encodeURIComponent(authorUsername)}`}
                        className="font-semibold underline"
                        title={`View ${rule.lastUpdatedBy}'s rules`}
                      >
                        {rule.lastUpdatedBy}
                      </Link>
                    ) : (
                      <span onClick={() => handleAuthorClick(rule.lastUpdatedBy!)}
                        className="font-semibold"
                        title={`View ${rule.lastUpdatedBy}'s rules`}
                      >
                        {rule.lastUpdatedBy}
                      </span>
                    )
                  ) : (
                    <b>Unknown</b>
                  )}{" "}
                  {relativeTime}.{" "}
                  {/* TODO: update link when migration is done (path will be wrong as reules will be in public folder) */}
                  <a href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/main/rules/${rule?.uri}/rule.md`}
                    target="_blank" title={historyTooltip}
                    className="inline-flex items-center gap-1 font-semibold underline" >
                    See history <RiHistoryLine />
                  </a>
                </p>
                <div className="flex items-center gap-4 text-2xl">
                  {!isAdminPage && (
                    <>
                      <Bookmark
                        ruleGuid={rule?.guid || ''}
                        isBookmarked={isBookmarked}
                        onBookmarkToggle={(newStatus) => setIsBookmarked(newStatus)}
                      />
                      <IconLink
                        href={`/admin#/~/${sanitizedBasePath}/${rule?.uri}`}
                        title="Edit rule"
                        tooltipOpaque={true}
                        children={<RiPencilLine size={ICON_SIZE} />}
                      />
                      <IconLink
                        href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/main/rules/${rule?.uri}/rule.md`}
                        target="_blank"
                        title="View rule on GitHub"
                        tooltipOpaque={true}
                        children={<RiGithubLine size={ICON_SIZE} className="rule-icon" />}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          {rule?.isArchived && rule?.archivedreason && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-[var(--ssw-red)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[var(--ssw-red)] m-0 mb-1">
                    This rule has been archived
                  </h3>
                  <div className="text-sm text-[var(--ssw-red)] m-0">
                    <span className="font-medium">Archived Reason:</span>{' '}
                    <span 
                      dangerouslySetInnerHTML={{
                        __html: rule.archivedreason
                          ?.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[var(--ssw-red)] underline hover:opacity-80">$1</a>')
                          ?.replace(/https?:\/\/[^\s]+/g, '<a href="$&" class="text-[var(--ssw-red)] underline hover:opacity-80">$&</a>')
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div data-tina-field={tinaField(rule, "body")} className="mt-8" ref={contentRef}>
              <TinaMarkdown
                content={rule?.body}
                components={getMarkdownComponentMapping(true)}
              />
          </div>
          <div className="hidden md:block">
            <hr className="my-6 mx-0"/>
            <Discussion ruleGuid={rule?.guid || ''} />
          </div>
        </Card>
        <div className="layout-sidebar">
          <Card title="Categories">
            <div className="flex flex-wrap gap-4">
              {props.ruleCategoriesMapping &&
                props.ruleCategoriesMapping.map((category, index) => {
                  return (
                    <Link
                      key={index}
                      href={`/${category.uri}`}
                      className="border-2 no-underline border-ssw-red text-ssw-red py-1 px-2 rounded-xs font-semibold hover:text-white hover:bg-ssw-red transition-colors duration-200"
                    >
                      {category.title.replace(/^Rules to better\s*/i, '')}
                    </Link>
                  );
                })}
            </div>
          </Card>
          <Card title="Acknowledgements">
            <Acknowledgements authors={rule.authors} />
          </Card>
          <Card title="Related rules">
            <RelatedRules relatedUris={rule?.related as string[] | undefined} 
              initialMapping={props.relatedRulesMapping} />
          </Card>
          <HelpCard />
          <div className="block md:hidden">
            <Discussion ruleGuid={rule?.guid || ''} />
          </div>
        </div>
      </div>
    </>
  );
}
