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
  RiBookmarkLine,
  RiGithubLine,
  RiHistoryLine,
} from "react-icons/ri";
import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { formatDateLong, timeAgo } from "@/lib/dateUtils";
import { extractCoAuthor } from "@/lib/utils";

export interface ClientRulePageProps {
  ruleQueryProps;
  ruleCategoriesMapping;
}

type AuthorInfo = {
  author: string;
  date: string;
} | null;

export default function ClientRulePage(props: ClientRulePageProps) {
  const { ruleQueryProps } = props;
  const [gitHubApiResponse, setGitHubApiResponse] = useState(null);
  const [author, setAuthor] = useState<AuthorInfo>(null);
  
  const ruleData = useTina({
    query: ruleQueryProps?.query,
    variables: ruleQueryProps?.variables,
    data: ruleQueryProps?.data,
  }).data;


  const rule = ruleData?.rule;

  useEffect(() => {
    const fetchApiData = async () => {
      try {
        // Get branch from environment variables with Vercel fallbacks
        const currentBranch = 
          process.env.NEXT_PUBLIC_TINA_BRANCH || 
          process.env.VERCEL_GIT_COMMIT_REF || 
          'main'; 
        
        const response = await fetch(
          `https://api.github.com/repos/SSWConsulting/SSW.Rules.Content/commits?sha=${currentBranch}&path=public/uploads/rules/${rule.uri}/rule.mdx&per_page=1`
        );
        const data = await response.json();
        
        if (data.length > 0) {
          const commit = data[0];
          
          if (commit.commit.author.name !== 'tina-cloud-app[bot]') {
            setAuthor({
              author: commit.commit.author.name, 
              date: timeAgo(commit.commit.author.date)
            });
          } else {
            const extractedCoAuthor = extractCoAuthor(commit.commit.message);
            setAuthor({
              author: extractedCoAuthor?.name,
              date: timeAgo(commit.commit.author.date)
            })
          }
        } else {
          console.warn("No commits found for the specified path.");
        }

        console.log("response", data);
      } catch (error) {
        console.error("Error fetching API data:", error);
      }
    };

    if (rule?.id) {
      fetchApiData();
    }
  }, [rule?.id]);

  const iconSize = 32;

  const relativeTime = useMemo(() => {
    return rule?.lastUpdated ? timeAgo(rule.lastUpdated) : "";
  }, [rule?.lastUpdated]);

  const historyTooltip = useMemo(() => {
    const created = rule?.created ? formatDateLong(rule.created) : "Unknown";
    const updated = rule?.lastUpdated
      ? formatDateLong(rule.lastUpdated)
      : "Unknown";
    return `Created ${created}\nLast Updated ${updated}`;
  }, [rule?.created, rule?.lastUpdated]);

  return (
    <>
      <div className="flex gap-8">
        <Card dropShadow className="flex-2">
          <div className="flex border-b-2 pb-4">
            {rule?.thumbnail && (
              <div className="w-[175px] h-[175px] relative mr-4">
                <Image
                  data-tina-field={tinaField(rule, "thumbnail")}
                  src={rule.thumbnail}
                  alt="thumbnail image for the rule"
                  fill
                  className="object-cover object-center"
                />
              </div>
            )}
            <div className="flex flex-col flex-1 justify-between">
              <div>
                <h1
                  className="text-[#CC4141] text-4xl leading-[1.2] my-0 b-4 font-semibold"
                  data-tina-field={tinaField(rule, "title")}
                >
                  {rule?.title}
                </h1>
                <p className="mt-4">
                  Updated by <b>{author?.author}</b> {author?.date}.{" "}
                  {/* TODO: update link when migration is done (path will be wrong as rules will be in public folder) */}
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
                <RiPencilLine
                  size={iconSize}
                  className="rule-icon"
                ></RiPencilLine>
                <RiBookmarkLine
                  size={iconSize}
                  className="rule-icon"
                ></RiBookmarkLine>
                <RiGithubLine
                  size={iconSize}
                  className="rule-icon"
                ></RiGithubLine>
              </div>
            </div>
          </div>
          <div data-tina-field={tinaField(rule, "body")} className="mt-8">
            <TinaMarkdown
              content={rule?.body}
              components={{
                ...embedComponents,
                ...typographyComponents,
              }}
            />
          </div>
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
                      className="border-2 no-underline border-[#CC4141] text-[#CC4141] p-2 rounded-sm font-semibold hover:text-white hover:bg-[#CC4141] transition-colors duration-200"
                    >
                      {category.title}
                    </Link>
                  );
                })}
            </div>
          </Card>
          <Card>acknowledgements</Card>
          <Card>related rules</Card>
        </div>
      </div>
    </>
  );
}