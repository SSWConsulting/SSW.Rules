import Link from "next/link";
import AboutSSWCard from "@/components/AboutSSWCard";
import CategoryActionButtons from "@/components/CategoryActionButtons";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import LatestRulesCard from "@/components/LatestRulesCard";
import QuickLinksCard from "@/components/QuickLinksCard";
import { Card } from "@/components/ui/card";
import WhyRulesCard from "@/components/WhyRulesCard";
import { fetchCategoryRuleCounts, fetchLatestRules, fetchQuickLinks } from "@/lib/services/rules";
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

export default async function CategoriesPage() {
  const [topCategories, latestRules, categoryRuleCounts, quickLinks] = await Promise.all([
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchCategoryRuleCounts(),
    fetchQuickLinks(),
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
          <QuickLinksCard links={quickLinks} />
          <WhyRulesCard />
          <HelpImproveCard />
          <HelpCard />
          <AboutSSWCard />
          <JoinConversationCard />
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
