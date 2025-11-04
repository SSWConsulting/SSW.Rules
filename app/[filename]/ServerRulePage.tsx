import { TinaMarkdown } from "tinacms/dist/rich-text";
import Image from "next/image";
import Link from "next/link";
import { formatDateLong, timeAgo } from "@/lib/dateUtils";
import { Card } from "@/components/ui/card";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getMarkdownComponentMapping } from "@/components/tina-markdown/markdown-component-mapping";
import Discussion from "@/components/Discussion";
import { RiHistoryLine } from "react-icons/ri";
import Acknowledgements from "@/components/Acknowledgements";
import HelpCard from "@/components/HelpCard";
import RelatedRules from "@/components/RelatedRules";
import RuleActionButtons from "@/components/RuleActionButtons";

export interface ServerRulePageProps {
  rule: any;
  ruleCategoriesMapping: { title: string; uri: string }[];
  sanitizedBasePath: string;
}

export type ServerRulePagePropsWithTinaProps = {
  serverRulePageProps: ServerRulePageProps;
  tinaProps: any;
}

export default function ServerRulePage({
  serverRulePageProps,
  tinaProps,
}: ServerRulePagePropsWithTinaProps) {
  const { data } = tinaProps;
  const rule = data?.rule;
  
  const {
    ruleCategoriesMapping,
    sanitizedBasePath,
  } = serverRulePageProps;

  const relativeTime = rule?.lastUpdated ? timeAgo(rule.lastUpdated) : "";
  const created = rule?.created ? formatDateLong(rule.created) : "Unknown";
  const updated = rule?.lastUpdated ? formatDateLong(rule.lastUpdated) : "Unknown";
  const historyTooltip = `Created ${created}\nLast Updated ${updated}`;

  const primaryCategory = ruleCategoriesMapping?.[0];
  const breadcrumbCategories = primaryCategory
    ? [{ title: primaryCategory.title, link: `/${primaryCategory.uri}` }]
    : undefined;

  return (
    <>
      <Breadcrumbs categories={breadcrumbCategories} breadcrumbText="This rule" />

      <div className="layout-two-columns">
        <Card dropShadow className="layout-main-section p-6">
          <div className="flex border-b-2">
            {rule?.thumbnail && (
              <div className="w-[175px] h-[175px] relative mr-4">
                <Image
                  src={rule.thumbnail}
                  alt="thumbnail image for the rule"
                  fill
                  className="object-cover object-center"
                />
              </div>
            )}
            <div className="flex flex-col flex-1 justify-between">
              <h1 className="text-ssw-red text-4xl leading-[1.2] my-0 b-4 font-semibold">
                {rule?.title}
              </h1>

              <div className="flex justify-between my-2 flex-col md:flex-row">
                <p className="mt-4 text-sm font-light">
                  Updated by <b>{rule?.lastUpdatedBy || "Unknown"}</b> {relativeTime}.{" "}
                  <a
                    href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/main/rules/${rule?.uri}/rule.md`}
                    target="_blank"
                    title={historyTooltip}
                    className="inline-flex items-center gap-1 font-semibold underline"
                  >
                    See history <RiHistoryLine />
                  </a>
                </p>
                <RuleActionButtons rule={rule} 
                  sanitizedBasePath={sanitizedBasePath} />
              </div>
            </div>
          </div>

          {rule?.isArchived && rule?.archivedreason && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <svg className="h-5 w-5 text-ssw-red" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-ssw-red m-0 mb-1">
                    This rule has been archived
                  </h3>
                  <div className="text-sm text-ssw-red m-0"
                    dangerouslySetInnerHTML={{
                      __html: rule.archivedreason
                        ?.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-ssw-red underline hover:opacity-80">$1</a>')
                        ?.replace(/https?:\/\/[^\s]+/g, '<a href="$&" class="text-ssw-red underline hover:opacity-80">$&</a>')
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <TinaMarkdown content={rule?.body} components={getMarkdownComponentMapping(true)} />
          </div>

          <div className="hidden md:block">
            <hr className="my-6 mx-0" />
            <Discussion ruleGuid={rule?.guid || ""} />
          </div>
        </Card>

        <div className="layout-sidebar">
          <Card title="Categories">
            <div className="flex flex-wrap gap-4">
              {ruleCategoriesMapping?.map((category) => (
                <Link
                  key={category.uri}
                  href={`/${category.uri}`}
                  className="border-2 no-underline border-ssw-red text-ssw-red py-1 px-2 rounded-xs font-semibold hover:text-white hover:bg-ssw-red transition-colors duration-200"
                >
                  {category.title.replace(/^Rules to better\s*/i, "")}
                </Link>
              ))}
            </div>
          </Card>
          <Card title="Acknowledgements">
            <Acknowledgements authors={rule.authors} />
          </Card>
          <Card title="Related rules">
            <RelatedRules relatedRules={rule.related} />
          </Card>
          <HelpCard />
          <div className="block md:hidden">
            <Discussion ruleGuid={rule.guid} />
          </div>
        </div>
      </div>
    </>
  );
}