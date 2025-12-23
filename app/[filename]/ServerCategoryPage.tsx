import Link from "next/link";
import { RiGithubLine, RiPencilLine } from "react-icons/ri";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import Breadcrumbs from "@/components/Breadcrumbs";
import RuleList from "@/components/rule-list/rule-list";
import MarkdownComponentMapping from "@/components/tina-markdown/markdown-component-mapping";
import { IconLink } from "@/components/ui";
import { ICON_SIZE } from "@/constants";

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
          <div className="flex justify-between">
            <h1 className="m-0 mb-4 text-ssw-red font-bold">{includeArchived ? `Archived Rules - ${title}` : title}</h1>

            <div className="flex gap-2 justify-center items-start sm:items-center">
              <IconLink href={`admin/index.html#/collections/edit/category/${path?.slice(0, -4)}`} title="Edit category" tooltipOpaque={true}>
                <RiPencilLine size={ICON_SIZE} />
              </IconLink>
              <IconLink
                href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/${process.env.NEXT_PUBLIC_TINA_BRANCH}/categories/${path}`}
                target="_blank"
                title="View category on GitHub"
                tooltipOpaque={true}
              >
                <RiGithubLine size={ICON_SIZE} className="rule-icon" />
              </IconLink>
            </div>
          </div>

          <div className="text-md">
            <TinaMarkdown content={category?.body} components={MarkdownComponentMapping} />
          </div>

          <RuleList categoryUri={path} rules={finalRules} initialPage={page} initialPerPage={perPage} />
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
