import Link from "next/link";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import ArchivedReasonContent from "@/components/ArchivedReasonContent";
import Breadcrumbs from "@/components/Breadcrumbs";
import { CategoryEdit } from "@/components/CategoryEdit";
import RuleListWrapper from "@/components/rule-list/rule-list-wrapper";
import MarkdownComponentMapping from "@/components/tina-markdown/markdown-component-mapping";

interface ServerCategoryPageProps {
  category: any;
  path?: string;
  includeArchived: boolean;
  view: "titleOnly" | "blurb" | "all";
  page: number;
  perPage: number;
}

export default function ServerCategoryPage({ category, path, includeArchived, view, page, perPage }: ServerCategoryPageProps) {
  const title = category?.title ?? "";
  const breadCrumbTitle = category?.title.replace("Rules to Better", "") ?? "";
  const baseRules: any[] = Array.isArray(category?.index) ? category.index.flatMap((i: any) => (i?.rule ? [i.rule] : [])) : [];

  const activeRules = baseRules.filter((r) => r?.isArchived !== true);
  const archivedRules = baseRules.filter((r) => r?.isArchived === true);
  const finalRules = includeArchived ? [...activeRules, ...archivedRules] : activeRules;

  const sidebarRules = finalRules.map((r) => ({ guid: r.guid, uri: r.uri, title: r.title }));

  return (
    <div>
      <Breadcrumbs isCategory breadcrumbText={includeArchived ? `Archived Rules - ${breadCrumbTitle}` : breadCrumbTitle} />
      <div className="relative">
        <div className="w-full lg:w-2/3 bg-white pt-4 p-6 border border-[#CCC] rounded shadow-lg">
          {category?.isArchived && category?.archivedreason && (
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
                  <h3 className="text-sm font-semibold text-ssw-red m-0 mb-1">This category has been archived</h3>
                  <div className="text-sm text-ssw-red m-0">
                    <ArchivedReasonContent reason={category.archivedreason} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <h1 className="m-0 mb-4 text-3xl text-ssw-red font-bold">
              {includeArchived ? `Archived Rules - ${title}` : title}
              <span className="text-2xl text-gray-400 font-normal"> - {finalRules.length} Rules</span>
            </h1>
            <CategoryEdit path={path} />
          </div>

          <div className="text-md rule-content" data-tina-field={tinaField(category, "body")}>
            <TinaMarkdown content={category?.body} components={MarkdownComponentMapping} />
          </div>

          <RuleListWrapper
            categoryUri={path}
            rules={baseRules}
            initialView={view}
            initialPage={page}
            initialPerPage={perPage}
            includeArchived={includeArchived}
            showFilterControls={true}
          />
        </div>

        <div className="hidden lg:flex lg:flex-col lg:absolute lg:top-0 lg:right-0 lg:bottom-0 lg:w-1/3 pl-6">
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ol className="border-l-3 border-gray-300 pl-6">
              {sidebarRules.map((rule, index) => (
                <li key={`sidebar-${rule.guid}-${index}`} className="py-1 ml-4">
                  <Link href={`/${rule.uri}`} className="text-gray-700 hover:text-ssw-red">
                    {rule.title}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
