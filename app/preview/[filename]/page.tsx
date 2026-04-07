import { notFound } from "next/navigation";
import type { BrokenReferences } from "@/app/[filename]/page";
import ServerCategoryPage from "@/app/[filename]/ServerCategoryPage";
import ServerRulePage from "@/app/[filename]/ServerRulePage";
import categoryTitleIndex from "@/category-uri-title-map.json";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import { CategoryWithRulesQueryDocument } from "@/tina/__generated__/types";
import { getFetchOptions } from "@/utils/tina/get-branch";

export const dynamic = "force-dynamic";

const VALID_BRANCH_PATTERN = /^[a-zA-Z0-9._\-/]+$/;

const getFullRelativePathFromFilename = async (filename: string, branch: string) => {
  const fetchOptions = await getFetchOptions(branch);
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    let res;
    try {
      res = await client.queries.topCategoryWithIndexQuery({ first: 50, after }, fetchOptions);
    } catch {
      return null;
    }

    const topCategories = res?.data?.categoryConnection?.edges || [];
    for (const edge of topCategories) {
      const node = edge?.node;
      if (node?.__typename === "CategoryTop_category") {
        const topRelativePath = node._sys.relativePath;
        const topDir = topRelativePath.replace("/index.mdx", "");
        const children = node.index || [];
        for (const child of children) {
          if (child?.category?._sys?.filename === filename) {
            return `${topDir}/${filename}.mdx`;
          }
        }
      }
    }

    hasNextPage = !!res?.data?.categoryConnection?.pageInfo?.hasNextPage;
    after = res?.data?.categoryConnection?.pageInfo?.endCursor ?? null;
  }

  return null;
};

const getCategoryData = async (filename: string, branch: string) => {
  const fullPath = await getFullRelativePathFromFilename(filename, branch);
  if (!fullPath) return null;

  const fetchOptions = await getFetchOptions(branch);

  try {
    const res: any = await (client as any).request({
      query: String(CategoryWithRulesQueryDocument),
      variables: { relativePath: fullPath },
      errorPolicy: "all",
      ...fetchOptions,
    });

    if (!res?.data) return null;

    return {
      data: res.data,
      query: String(CategoryWithRulesQueryDocument),
      variables: { relativePath: fullPath },
    };
  } catch {
    return null;
  }
};

const getRuleData = async (filename: string, branch: string) => {
  const fetchOptions = await getFetchOptions(branch);
  const relativePath = filename + "/rule.mdx";

  try {
    const basicProps = await client.queries.ruleDataBasic({ relativePath }, fetchOptions);

    try {
      const fullProps = await client.queries.ruleData({ relativePath }, fetchOptions);

      return {
        data: fullProps.data,
        query: fullProps.query,
        variables: fullProps.variables,
        brokenReferences: null as BrokenReferences | null,
      };
    } catch (relatedError) {
      const errorMessage = relatedError instanceof Error ? relatedError.message : String(relatedError);
      const brokenPathMatches = errorMessage.matchAll(/Unable to find record ([^\n]+)/g);
      const brokenPaths = Array.from(brokenPathMatches, (match) => match[1].trim());
      if (brokenPaths.length === 0) {
        brokenPaths.push("unknown path");
      }

      return {
        data: {
          ...basicProps.data,
          rule: {
            ...basicProps.data.rule,
            related: [],
          },
        },
        query: basicProps.query,
        variables: basicProps.variables,
        brokenReferences: {
          detected: true,
          paths: brokenPaths,
        } as BrokenReferences,
      };
    }
  } catch {
    return null;
  }
};

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ filename: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { filename } = await params;
  const sp = await searchParams;
  const branch = typeof sp.branch === "string" ? sp.branch : "";

  if (!branch || !VALID_BRANCH_PATTERN.test(branch)) {
    notFound();
  }

  const isCategory = !!(categoryTitleIndex as any).categories?.[filename];

  if (isCategory) {
    const category = await getCategoryData(filename, branch);
    if (!category?.data) {
      notFound();
    }

    const includeArchived = String(sp.archived ?? "") === "true";
    const view = String(sp.view ?? "blurb") as "titleOnly" | "blurb" | "all";
    const page = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
    const perPage = parseInt(String(sp.perPage ?? "20"), 10) || 20;

    return (
      <Section>
        <ServerCategoryPage
          category={category.data.category}
          path={category.variables?.relativePath}
          includeArchived={includeArchived}
          view={view}
          page={page}
          perPage={perPage}
        />
      </Section>
    );
  }

  const rule = await getRuleData(filename, branch);
  if (!rule?.data) {
    notFound();
  }

  return (
    <Section>
      <ServerRulePage
        tinaProps={{ data: rule.data }}
        serverRulePageProps={{
          rule: rule.data.rule,
          brokenReferences: rule.brokenReferences,
        }}
      />
    </Section>
  );
}
