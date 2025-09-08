"use client";

import { embedComponents } from "@/components/embeds";
import { typographyComponents } from "@/components/typography-components";
import { Card } from "@/components/ui/card";
import { tinaField, useTina } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import Image from "next/image";
import {
  RiThumbUpLine,
  RiThumbDownLine,
  RiPencilLine,
  RiGithubLine,
  RiHistoryLine,
} from "react-icons/ri";
import Bookmark from "@/components/Bookmark";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { formatDateLong, timeAgo } from "@/lib/dateUtils";
import MarkdownComponentMapping from "@/components/tina-markdown/markdown-component-mapping";
import HelpCard from "@/components/HelpCard";
import Acknowledgements from "@/components/Acknowledgements";
import { useUser, getAccessToken } from "@auth0/nextjs-auth0";
import { BookmarkService } from "@/lib/bookmarkService";
import Discussion from "@/components/Discussion";
import { useRouter } from "next/navigation";
import { getRuleLastModifiedFromAuthors } from "@/lib/services/github";
import { ICON_SIZE } from "@/constants";
import Breadcrumbs from "@/components/Breadcrumbs";

export interface ClientRulePageProps {
  ruleQueryProps;
  ruleCategoriesMapping;
  relatedRulesMapping?: { uri: string; title: string }[];
}

export default function ClientRulePage(props: ClientRulePageProps) {
  const { ruleQueryProps } = props;
  const { user } = useUser();
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const relatedRules = props.relatedRulesMapping || [];

  const router = useRouter();
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);
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

  const openUserRule = async (ruleUri: string) => {
    if (!ruleUri) return;

    try {
      if (authorUsername) {
        router.push(`/user?author=${encodeURIComponent(authorUsername)}`);
        return;
      }
      setIsLoadingUsername(true);
      const params = new URLSearchParams();
      params.set('ruleUri', ruleUri);
      const res = await fetch(`/api/github/rules/authors?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch GitHub username');
      const { authors } = await res.json();
      const lastModified = getRuleLastModifiedFromAuthors(authors);
      if (lastModified) setAuthorUsername(lastModified);
      router.push(`/user?author=${encodeURIComponent(lastModified)}`);
    } catch (error) {
      console.error('Failed to fetch GitHub username:', error);
    } finally {
      setIsLoadingUsername(false);
    }
  };

  // Prefetch the GitHub username as soon as we know the rule URI
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const uri = rule?.uri;
      if (!uri) return;
      try {
        const params = new URLSearchParams();
        params.set('ruleUri', uri);
        const res = await fetch(`/api/github/rules/authors?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch GitHub username');
        const { authors } = await res.json();
        const lastModified = getRuleLastModifiedFromAuthors(authors);
        if (lastModified && isMounted) setAuthorUsername(lastModified);
      } catch {
        // Silently ignore prefetch errors; click fallback will handle
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [rule?.uri]);
  
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
        <Card dropShadow className="layout-main-section">
          <div className="flex border-b-2 pb-4">
            {rule?.thumbnail && (
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
              <div>
                <h1
                  className="text-ssw-red text-4xl leading-[1.2] my-0 b-4 font-semibold"
                  data-tina-field={tinaField(rule, "title")}
                >
                  {rule?.title}
                </h1>
                <p className="mt-4">
                  Updated by{" "}
                  {rule?.lastUpdatedBy ? (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (!isLoadingUsername) {
                          openUserRule(rule?.uri || '');
                        }
                      }}
                      className={`font-semibold hover:text-ssw-red hover:underline transition-colors duration-200 ${
                        isLoadingUsername ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={`View ${rule.lastUpdatedBy}'s rules`}
                    >
                      {isLoadingUsername ? 'Loading...' : rule.lastUpdatedBy}
                    </a>
                  ) : (
                    <b>Unknown</b>
                  )}{" "}
                  {relativeTime}.{" "}
                  {/* TODO: update link when migration is done (path will be wrong as reules will be in public folder) */}
                  <a
                    href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/main/rules/${rule?.uri}/rule.md`}
                    target="_blank"
                    className="inline-flex items-center gap-1"
                    title={historyTooltip}
                  >
                    See history <RiHistoryLine />
                  </a>
                </p>
              </div>
              <div className="flex align-center gap-4 text-2xl mt-4">
                <RiThumbUpLine
                  size={ICON_SIZE}
                  className="rule-icon"
                ></RiThumbUpLine>
                <span className="-ml-3">12</span>
                <RiThumbDownLine
                  size={ICON_SIZE}
                  className="rule-icon"
                ></RiThumbDownLine>
                <span className="-ml-3">3</span>
                <div className="flex-1"></div>
                <button>
                  <Link href={`./admin#/~/${rule?.uri}`}>
                    <RiPencilLine
                      size={ICON_SIZE}
                      className="rule-icon"
                    ></RiPencilLine>
                  </Link>
                </button>
                <Bookmark 
                  ruleGuid={rule?.guid || ''} 
                  isBookmarked={isBookmarked}
                  onBookmarkToggle={(newStatus) => setIsBookmarked(newStatus)}
                />
                <button>
                  <Link href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/main/rules/${rule?.uri}/rule.md`} target="_blank">
                    <RiGithubLine size={ICON_SIZE} className="rule-icon"></RiGithubLine>
                  </Link>
                </button>
              </div>
            </div>
          </div>
          <div data-tina-field={tinaField(rule, "body")} className="mt-8">
            <TinaMarkdown
              content={rule?.body}
              components={MarkdownComponentMapping}
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
                      className="border-2 no-underline border-ssw-red text-ssw-red p-2 rounded-xs font-semibold hover:text-white hover:bg-ssw-red transition-colors duration-200"
                    >
                      {category.title}
                    </Link>
                  );
                })}
            </div>
          </Card>
          <Card title="Acknowledgements">
            <Acknowledgements authors={rule.authors} />
          </Card>
          <Card title="Related rules">
            {relatedRules.length > 0 ? (
              <ul className="pl-4">
                {relatedRules.map((r) => (
                  <li key={r.uri} className="not-last:mb-2">
                    <Link
                      href={`/${r.uri}`}
                      className="no-underline">
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">No related rules.</div>
            )}
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
