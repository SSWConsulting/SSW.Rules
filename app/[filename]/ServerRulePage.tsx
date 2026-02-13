import Image from "next/image";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import type { BrokenReferences } from "@/app/[filename]/page";
import ArchivedReasonContent from "@/components/ArchivedReasonContent";
import AuthorsCard from "@/components/AuthorsCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import BrokenReferenceBanner from "@/components/BrokenReferenceBanner";
import CategoriesCard from "@/components/CategoriesCard";
import Discussion from "@/components/Discussion";
import HelpCard from "@/components/HelpCard";
import { useAdminBackBlock } from "@/components/hooks/useAdminBackBlock";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";
import GitHubMetadata from "@/components/last-updated-by";
import RelatedRulesCard from "@/components/RelatedRulesCard";
import RuleActionButtons from "@/components/RuleActionButtons";
import { YouTubeShorts } from "@/components/shared/Youtube";
import { getMarkdownComponentMapping } from "@/components/tina-markdown/markdown-component-mapping";
import { Card } from "@/components/ui/card";

export interface ServerRulePageProps {
  rule: any;
  brokenReferences?: BrokenReferences | null;
}

export type ServerRulePagePropsWithTinaProps = {
  serverRulePageProps: ServerRulePageProps;
  tinaProps: any;
};

export default function ServerRulePage({ serverRulePageProps, tinaProps }: ServerRulePagePropsWithTinaProps) {
  const { data } = tinaProps;
  const rule = data?.rule;
  const { isAdmin: isAdminPage, isLoading: isAdminLoading } = useIsAdminPage();

  const { brokenReferences } = serverRulePageProps;
  const primaryCategory = rule.categories?.[0]?.category;
  const primaryCategoryUri = primaryCategory?.uri;
  const breadcrumbCategories =
    typeof primaryCategoryUri === "string" && primaryCategoryUri.trim().length > 0
      ? [{ title: primaryCategory.title, link: `/${primaryCategoryUri}` }]
      : undefined;

  useAdminBackBlock({ isAdminPage });

  return (
    <>
      <Breadcrumbs categories={breadcrumbCategories} breadcrumbText="This rule" />

      {brokenReferences?.detected && <BrokenReferenceBanner brokenPaths={brokenReferences.paths} ruleUri={rule?.uri || ""} />}

      <div className="layout-two-columns">
        <Card dropShadow className="layout-main-section p-6">
          {rule?.isArchived && rule?.archivedreason && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <svg className="h-5 w-5 text-ssw-red" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-ssw-red m-0 mb-1">This rule has been archived</h3>
                  <div className="text-sm text-ssw-red m-0">
                    <ArchivedReasonContent reason={rule.archivedreason} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex border-b-2">
            {rule?.thumbnail && (
              <div className="w-[175px] h-[175px] relative mr-4">
                <Image src={rule.thumbnail} alt="thumbnail image for the rule" fill className="object-cover object-center" />
              </div>
            )}
            <div className="flex flex-col flex-1 justify-between">
              <h1 className="text-ssw-red text-4xl leading-[1.2] my-0 b-4 font-semibold" data-tina-field={tinaField(rule, "title")}>
                {rule?.title}
              </h1>

              <div className="flex justify-between my-2 flex-col md:flex-row">
                <GitHubMetadata owner="SSWConsulting" repo="SSW.Rules.Content" path={rule?.id} className="mt-2" />
                <RuleActionButtons rule={rule} />
              </div>
            </div>
          </div>

          <div className="mt-8 rule-content" data-tina-field={tinaField(rule, "body")}>
            <TinaMarkdown content={rule?.body} components={getMarkdownComponentMapping(true)} />
          </div>

          <div className="hidden md:block">
            <hr className="my-6 mx-0" />
            <Discussion ruleGuid={rule?.guid || ""} />
          </div>
        </Card>

        <div className="layout-sidebar">
          {rule?.sidebarVideo && (
            <Card>
              <YouTubeShorts url={rule.sidebarVideo} />
            </Card>
          )}
          <CategoriesCard categories={rule?.categories} />
          <AuthorsCard authors={rule.authors} />
          <RelatedRulesCard relatedRules={rule.related} />
          <HelpCard />
          <div className="block md:hidden">
            <Discussion ruleGuid={rule.guid} />
          </div>
        </div>
      </div>
    </>
  );
}
