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

export interface ClientRulePageProps {
  ruleQueryProps;
  ruleCategoriesMapping;
}

export default function ClientRulePage(props: ClientRulePageProps) {
  const { ruleQueryProps } = props;
  const { user } = useUser();
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  const ruleData = useTina({
    query: ruleQueryProps?.query,
    variables: ruleQueryProps?.variables,
    data: ruleQueryProps?.data,
  }).data;
  const rule = ruleData?.rule;
  const iconSize = 32;

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

  return (
    <>
      <div className="flex gap-8">
        <Card dropShadow className="flex-2">
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
                  Updated by <b>{rule?.lastUpdatedBy}</b> {relativeTime}.{" "}
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
                  size={iconSize}
                  className="rule-icon"
                ></RiThumbUpLine>
                <span className="-ml-3">12</span>
                <RiThumbDownLine
                  size={iconSize}
                  className="rule-icon"
                ></RiThumbDownLine>
                <span className="-ml-3">3</span>
                <div className="flex-1"></div>
                <button>
                  <Link href={`./admin#/~/${rule?.uri}`}>
                    <RiPencilLine
                      size={iconSize}
                      className="rule-icon"
                    ></RiPencilLine>
                  </Link>
                </button>
                <Bookmark 
                  ruleId={rule?.guid || ''} 
                  isBookmarked={isBookmarked}
                  onBookmarkToggle={(ruleId, newStatus) => setIsBookmarked(newStatus)}
                  size={iconSize} 
                />
                <button>
                  <Link href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/main/rules/${rule?.uri}/rule.md`} target="_blank">
                    <RiGithubLine size={iconSize} className="rule-icon"></RiGithubLine>
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
          <hr className="my-6 mx-0"/>
          <Discussion ruleGuid={rule?.guid || ''} />
        </Card>
        <div className="flex flex-col flex-1 gap-8">
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
          <Card>Related rules</Card>
          <HelpCard />
        </div>
      </div>
    </>
  );
}
