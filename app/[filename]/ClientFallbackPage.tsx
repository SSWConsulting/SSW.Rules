"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import ServerCategoryPage from "@/app/[filename]/ServerCategoryPage";
import NotFound from "@/app/not-found";
import categoryTitleIndex from "@/category-uri-title-map.json";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";
import { Section } from "@/components/layout/section";
import { getSanitizedBasePath } from "@/lib/withBasePath";
import ruleToCategoryIndex from "@/rule-to-categories.json";
import { TinaRuleWrapper } from "./TinaRuleWrapper";

interface ClientFallbackPageProps {
  filename: string;
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ClientFallbackPage({ filename, searchParams }: ClientFallbackPageProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const { isAdmin: isAdminPage, isLoading: isAdminLoading } = useIsAdminPage();

  // Helper function to get base path for API calls
  const getBasePath = () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    // Remove trailing slash if present
    return basePath.replace(/\/+$/, "");
  };

  // Helper function to get full relative path from filename
  const getFullRelativePathFromFilename = async (filename: string): Promise<string | null> => {
    let hasNextPage = true;
    let after: string | null = null;
    const basePath = getBasePath();

    while (hasNextPage) {
      try {
        const params = new URLSearchParams({ first: "50" });
        if (after) {
          params.set("after", after);
        }

        const res = await fetch(`${basePath}/api/tina/top-categories?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          console.error("Error fetching top categories:", res.status);
          return null;
        }

        const result = await res.json();
        const topCategories = result?.data?.categoryConnection?.edges || [];

        for (const edge of topCategories) {
          const node = edge?.node;
          if (node?.__typename === "CategoryTop_category") {
            const topRelativePath = node._sys.relativePath;
            const topDir = topRelativePath.replace("/index.mdx", "");

            const children = node.index || [];
            for (const child of children) {
              // @ts-ignore
              if (child?.category?._sys?.filename === filename) {
                return `${topDir}/${filename}.mdx`;
              }
            }
          }
        }

        hasNextPage = result?.data?.categoryConnection?.pageInfo?.hasNextPage || false;
        after = result?.data?.categoryConnection?.pageInfo?.endCursor || null;
      } catch (error) {
        console.error("Error in getFullRelativePathFromFilename:", error);
        return null;
      }
    }

    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const basePath = getBasePath();

        // First, try to find the full relative path for category
        const fullPath = await getFullRelativePathFromFilename(filename);

        // Try category first
        if (fullPath) {
          try {
            const params = new URLSearchParams({ relativePath: fullPath });
            const categoryRes = await fetch(`${basePath}/api/tina/category?${params.toString()}`, {
              method: "GET",
              cache: "no-store",
            });

            if (categoryRes.ok) {
              const categoryResult = await categoryRes.json();

              if (categoryResult?.data?.category) {
                const includeArchived = String(searchParams.archived ?? "") === "true";
                const view = String(searchParams.view ?? "blurb") as "titleOnly" | "blurb" | "all";
                const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
                const perPage = Math.max(1, Math.min(50, parseInt(String(searchParams.perPage ?? "10"), 10) || 10));

                setData({
                  type: "category",
                  category: categoryResult.data.category,
                  path: fullPath,
                  includeArchived,
                  view,
                  page,
                  perPage,
                });
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error(`[ClientFallbackPage] fetch category failed for filename="${filename}":`, error);
          }
        }

        // Try rule data
        try {
          const params = new URLSearchParams({ relativePath: filename + "/rule.mdx" });
          const ruleRes = await fetch(`${basePath}/api/tina/rule?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
          });

          if (ruleRes.ok) {
            const ruleResult = await ruleRes.json();

            if (ruleResult?.data?.rule) {
              const ruleUri = ruleResult.data.rule.uri;
              const ruleCategories = ruleUri ? (ruleToCategoryIndex as Record<string, string[]>)[ruleUri] : undefined;

              const ruleCategoriesMapping =
                ruleCategories?.map((categoryUri: string) => {
                  return {
                    title: (categoryTitleIndex as any).categories[categoryUri],
                    uri: categoryUri,
                  };
                }) || [];

              const sanitizedBasePath = getSanitizedBasePath();

              const brokenReferences = ruleResult._brokenReferences
                ? {
                    detected: ruleResult._brokenReferences.detected,
                    paths: ruleResult._brokenReferences.paths,
                  }
                : null;

              setData({
                type: "rule",
                rule: ruleResult.data.rule,
                ruleCategoriesMapping,
                sanitizedBasePath,
                tinaQueryProps: {
                  data: ruleResult.data,
                  query: ruleResult.query,
                  variables: ruleResult.variables,
                },
                brokenReferences,
              });
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error(`[ClientFallbackPage] fetch rule failed for filename="${filename}":`, error);
        }

        // If we get here, nothing was found
        setIsNotFound(true);
        setLoading(false);
      } catch (error) {
        console.error("Error in client fallback fetch:", error);
        setIsNotFound(true);
        setLoading(false);
      }
    };

    fetchData();
  }, [filename, searchParams]);

  // Wait for admin check to complete before deciding whether to show 404
  if (isAdminLoading) {
    return (
      <Section>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ssw-red mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </Section>
    );
  }

  // If this is not an admin page, return a not found response. This is called only when the page
  // is not found in the actual branch. When a user is not in Tina mode and creates a new rule,
  // it should appear only in Tina mode and should not attempt to load on the live site.
  if (!isAdminPage) return notFound();

  if (loading) {
    return (
      <Section>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ssw-red mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </Section>
    );
  }

  if (isNotFound || !data) {
    return <NotFound />;
  }

  if (data.type === "category") {
    return (
      <Section>
        <ServerCategoryPage
          category={data.category}
          path={data.path}
          includeArchived={data.includeArchived}
          view={data.view}
          page={data.page}
          perPage={data.perPage}
        />
      </Section>
    );
  }

  if (data.type === "rule") {
    return (
      <Section>
        <TinaRuleWrapper
          tinaQueryProps={data.tinaQueryProps}
          serverRulePageProps={{
            rule: data.rule,
            ruleCategoriesMapping: data.ruleCategoriesMapping,
            sanitizedBasePath: data.sanitizedBasePath,
            brokenReferences: data.brokenReferences,
          }}
        />
      </Section>
    );
  }

  return null;
}
