"use client";

import { Card } from "@/components/ui/card";
import { LatestRule } from "@/models/LatestRule";
import Link from "next/link";
import SearchBar from "@/components/SearchBarWrapper";
import RuleCount from "@/components/RuleCount";
import LatestRulesCard from "@/components/LatestRulesCard";
import WhyRulesCard from "@/components/WhyRulesCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import AboutSSWCard from "@/components/AboutSSWCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import HelpCard from "@/components/HelpCard";
import QuickLinksCard from "@/components/QuickLinksCard";
import { QuickLink } from "@/types/quickLink";
import CategoryActionButtons from "@/components/CategoryActionButtons";
import { Rule } from "@/models/Rule";

export interface HomeClientPageProps {
  topCategories: any[];
  latestRules: LatestRule[];
  ruleCount: number;
  categoryRuleCounts: Record<string, number>;
  quickLinks: QuickLink[];
  archivedRules: Rule[];
}

export default function HomeClientPage(props: HomeClientPageProps) {
  const { topCategories, latestRules, ruleCount, categoryRuleCounts, quickLinks, archivedRules } = props;

  const getTopCategoryTotal = (subCategories: any[]) => {
    return subCategories.reduce((total, category) => {
      return total + (categoryRuleCounts[category._sys.filename] || 0);
    }, 0);
  };

  return (
    <>
      <SearchBar/>
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <div className="h-[3rem] max-sm:h-auto">
            <h1 className="m-0 mb-4 flex items-end max-sm:flex-col max-sm:items-start">
              <span className="text-ssw-red font-bold">{ruleCount.toLocaleString("en-US")}&nbsp;</span>
              <span className="text-gray-600 text-lg font-normal">Best Practices for Better Software & Better Teams</span>
            </h1>
          </div>

          {topCategories
            .filter((topCategory) =>
              topCategory.index &&
              topCategory.index.length > 0 &&
              topCategory.index.some((item: any) =>
                item.category &&
                categoryRuleCounts[item.category._sys.filename] > 0
              )
            )
            .map((topCategory, index) => (
            <Card key={index} className="mb-4">
              <h2 className="flex justify-between m-0 mb-4 text-2xl max-sm:text-lg">
                <span>{topCategory.title}</span>
                <span className="text-gray-500 text-lg">
                  {getTopCategoryTotal(
                    topCategory.index
                      ?.map((item: any) => item.category)
                      .filter(Boolean) || []
                  )}{" "}
                  Rules
                </span>
              </h2>

              <ol className="text-lg mb-0">
                {topCategory.index
                  ?.filter((item: any) =>
                    item.category &&
                    categoryRuleCounts[item.category._sys.filename] > 0
                  )
                  ?.map((item: any, subIndex: number) => (
                    <li key={subIndex} className="mb-4 last:mb-2">
                      <div className=" flex justify-between">
                        <Link href={`/${item.category._sys.filename}`}>
                          {item.category.title}
                        </Link>
                        <span className="text-gray-300">
                          {categoryRuleCounts[item.category._sys.filename] || 0}
                        </span>
                      </div>
                    </li>
                  ))}
              </ol>
            </Card>
          ))}
        </div>

        <div className="layout-sidebar mt-[3rem] max-sm:mt-0">
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
