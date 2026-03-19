"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AboutSSWCard from "@/components/AboutSSWCard";
import ActivityRulesView from "@/components/ActivityRulesView";
import CategoryActionButtons from "@/components/CategoryActionButtons";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import LatestRulesCard from "@/components/LatestRulesCard";
import QuickLinksCard from "@/components/QuickLinksCard";
import RadioButton from "@/components/radio-button/radio-button";
import SearchBar from "@/components/SearchBarWrapper";
import { Card } from "@/components/ui/card";
import WhyRulesCard from "@/components/WhyRulesCard";
import { ActivityRule } from "@/models/ActivityRule";
import { LatestRule } from "@/models/LatestRule";
import { RecentComment } from "@/models/RecentComment";
import { QuickLink } from "@/types/quickLink";

type HomeView = "categories" | "activity";

export interface HomeClientPageProps {
  topCategories: any[];
  latestRules: LatestRule[];
  ruleCount: number;
  categoryRuleCounts: Record<string, number>;
  quickLinks: QuickLink[];
  activityRules: ActivityRule[];
  recentComments: RecentComment[];
}

export default function HomeClientPage(props: HomeClientPageProps) {
  const { topCategories, latestRules, ruleCount, categoryRuleCounts, quickLinks, activityRules, recentComments } = props;

  const searchParams = useSearchParams();

  // Initialise from URL once (covers direct links and back-navigation remounts).
  // After mount, React state is the source of truth for instant UI updates.
  const [view, setView] = useState<HomeView>(() =>
    searchParams.get("view") === "categories" ? "categories" : "activity"
  );

  const handleViewChange = (newView: HomeView) => setView(newView);

  // Keep the URL in sync as a non-blocking side effect.
  // window.history.replaceState does NOT trigger a navigation or a server fetch.
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const params = new URLSearchParams(window.location.search);
    if (view === "activity") {
      params.delete("view");
      params.delete("sort");
    } else {
      params.set("view", view);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${basePath}/?${qs}` : `${basePath}/`);
  }, [view]);

  const getTopCategoryTotal = (subCategories: any[]) => {
    return subCategories.reduce((total, category) => {
      return total + (categoryRuleCounts[category._sys.filename] || 0);
    }, 0);
  };

  return (
    <>
      <SearchBar />
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2 m-4">
        <h1 className="m-0 flex items-end max-sm:flex-col max-sm:items-start">
          <span className="text-ssw-red font-bold text-[2rem]">{ruleCount.toLocaleString("en-US")}&nbsp;</span>
          <span className="text-gray-600 text-lg font-normal">Best Practices for Better Software & Better Teams</span>
        </h1>
        <div className="flex items-center">
          <RadioButton
            id="view-activity"
            value="activity"
            selectedOption={view}
            handleOptionChange={(e) => handleViewChange(e.target.value as HomeView)}
            labelText="Activity View"
            position="first"
          />
          <RadioButton
            id="view-categories"
            value="categories"
            selectedOption={view}
            handleOptionChange={(e) => handleViewChange(e.target.value as HomeView)}
            labelText="Category View"
            position="last"
          />
        </div>
      </div>

      {view === "categories" && (
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
                            <div className=" flex justify-between">
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
      )}

      {view === "activity" && (
        <ActivityRulesView rules={activityRules} total={activityRules.length} recentComments={recentComments} />
      )}
    </>
  );
}
