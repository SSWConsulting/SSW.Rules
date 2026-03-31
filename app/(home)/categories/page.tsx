import Link from "next/link";
import CategoryActionButtons from "@/app/(home)/components/CategoryActionButtons";
import LatestRulesCard from "@/app/(home)/components/LatestRulesCard";
import { Card } from "@/app/(home)/components/ui/card";
import HomepageSidebarCards from "@/app/(home)/components/HomepageSidebarCards";
import { fetchCategoryRuleCounts, fetchLatestRules } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";

export const revalidate = 21600; // 6 hours

async function fetchTopCategoriesWithSubcategories() {
  const result = await client.queries.mainCategoryQuery();

  if (!result?.data?.category || result.data.category.__typename !== "CategoryMain") {
    return [];
  }

  const topCategories = result.data.category.index?.map((item: any) => item?.top_category).filter(Boolean) || [];

  return topCategories;
}

async function fetchHomepageData() {
  try {
    const res = await client.queries.homepage({
      relativePath: "index.json",
    });
    return {
      data: res.data,
      query: res.query,
      variables: res.variables,
    };
  } catch (error) {
    // If the homepage document is missing or the Tina query fails, log and return a safe fallback
    console.error("Failed to fetch homepage data from Tina CMS:", error);
    return {
      data: null,
      query: null,
      variables: {
        relativePath: "index.json",
      },
    };
  }
}

export default async function CategoriesPage() {
  const [topCategories, latestRules, categoryRuleCounts, homePageData] = await Promise.all([
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchCategoryRuleCounts(),
    fetchHomepageData(),
  ]);

  const getTopCategoryTotal = (subCategories: any[]) =>
    subCategories.reduce((total, category) => total + (categoryRuleCounts[category._sys.filename] || 0), 0);

  return (
    <>
      <div className="layout-two-columns">
        <div className="layout-main-section">
          {topCategories
            .filter(
              (topCategory) =>
                topCategory.index &&
                topCategory.index.length > 0 &&
                topCategory.index.some((item: any) => item.category && categoryRuleCounts[item.category._sys.filename] > 0)
            )
            .map((topCategory, index) => (
              <Card key={index} className="mb-4">
                <h2 className="flex justify-between m-0 mb-4 text-2xl max-sm:text-lg">
                  <span>{topCategory.title}</span>
                  <span className="text-gray-500 text-lg">
                    {getTopCategoryTotal(topCategory.index?.map((item: any) => item.category).filter(Boolean) || [])} Rules
                  </span>
                </h2>
                <ol className="text-lg mb-0">
                  {topCategory.index
                    ?.filter((item: any) => item.category && categoryRuleCounts[item.category._sys.filename] > 0)
                    ?.map((item: any, subIndex: number) => (
                      <li key={subIndex} className="mb-4 last:mb-2">
                        <div className="flex justify-between">
                          <Link href={`/${item.category._sys.filename}`}>{item.category.title}</Link>
                          <span className="text-gray-300">{categoryRuleCounts[item.category._sys.filename] || 0}</span>
                        </div>
                      </li>
                    ))}
                </ol>
              </Card>
            ))}
        </div>
        <div className="layout-sidebar max-sm:mt-0">
          <LatestRulesCard rules={latestRules} />
          {homePageData.query && (
            <HomepageSidebarCards
              tinaHomepageProps={homePageData as { query: string; variables: any; data: any }}
            />
          )}
        </div>
      </div>
      <CategoryActionButtons />
    </>
  );
}

export async function generateMetadata() {
  return {
    title: "SSW.Rules | Categories",
    alternates: {
      canonical: `${siteUrl}/categories`,
    },
  };
}
