import Link from "next/link";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
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
  brokenReferences?: { detected: boolean; paths: string[] } | null;
}

export default function ServerCategoryPage({ category, path, includeArchived, view, page, perPage, brokenReferences }: ServerCategoryPageProps) {
  const title = category?.title ?? "";
  const breadCrumbTitle = (category?.title ?? "").replace("Rules to Better", "");
  const baseRules: any[] = Array.isArray(category?.index)
    ? category.index.flatMap((i: any) => (i?.rule && i.rule.uri && i.rule.title ? [i.rule] : []))
    : [];

  const activeRules = baseRules.filter((r) => r?.isArchived !== true);
  const archivedRules = baseRules.filter((r) => r?.isArchived === true);
  const finalRules = includeArchived ? [...activeRules, ...archivedRules] : activeRules;

  const sidebarRules = finalRules.map((r) => ({ guid: r.guid, uri: r.uri, title: r.title }));

  return (
    <div>
      <Breadcrumbs isCategory breadcrumbText={includeArchived ? `Archived Rules - ${breadCrumbTitle}` : breadCrumbTitle} />
      <div className="relative">
        <div className="w-full lg:w-2/3 bg-white pt-4 p-6 border border-[#CCC] rounded shadow-lg">
          <div className="flex justify-between">
            <h1 className="m-0 mb-4 text-3xl text-ssw-red font-bold">
              {includeArchived ? `Archived Rules - ${title}` : title}
              <span className="text-2xl text-gray-400 font-normal"> - {finalRules.length} Rules</span>
            </h1>
            <CategoryEdit path={path} />
          </div>

          {brokenReferences?.detected && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 rounded mb-4" role="alert">
              <p className="font-bold">⚠️ Some rules in this category could not be loaded</p>
              <p className="text-sm mt-1">
                The following rule references may have been renamed or removed:{" "}
                {brokenReferences.paths.map((p, i) => (
                  <code key={p} className="bg-amber-100 px-1 rounded text-xs">
                    {p}
                    {i < brokenReferences.paths.length - 1 ? ", " : ""}
                  </code>
                ))}
              </p>
            </div>
          )}

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
                <li key={`sidebar-${rule.guid ?? "unknown"}-${index}`} className="py-1 ml-4">
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
