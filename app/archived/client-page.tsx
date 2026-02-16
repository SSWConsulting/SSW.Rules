"use client";

import Link from "next/link";
import React, { useMemo } from "react";
import AboutSSWCard from "@/components/AboutSSWCard";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import LatestRulesCard from "@/components/LatestRulesCard";
import QuickLinksCard from "@/components/QuickLinksCard";
import SearchBar from "@/components/SearchBarWrapper";
import { Card } from "@/components/ui/card";
import WhyRulesCard from "@/components/WhyRulesCard";
import { Rule } from "@/models/Rule";

export interface ArchivedClientPageProps {
  archivedRules: Rule[];
  latestRules?: any[];
  quickLinks?: any[];
}

export default function ArchivedClientPage(props: ArchivedClientPageProps) {
  const { archivedRules, latestRules = [], quickLinks = [] } = props;

  const groupedArchivedData = useMemo(() => {
    const categoryRules: Record<string, Rule[]> = {};
    archivedRules.forEach((rule) => {
      const categoryPaths = (rule.categories ?? []).map((c) => c?.category?.title).filter((p): p is string => typeof p === "string" && p.length > 0);
      const keys = categoryPaths.length > 0 ? categoryPaths : ["Orphaned Rules"];

      for (const key of keys) {
        if (!categoryRules[key]) categoryRules[key] = [];
        categoryRules[key].push(rule);
      }
    });

    const subcategoriesWithRules = Object.entries(categoryRules)
      .map(([categoryPath, rules]) => ({
        categoryPath,
        rules,
        count: rules.length,
      }))
      .sort((a, b) => {
        if (a.categoryPath === "Orphaned Rules") return 1;
        if (b.categoryPath === "Orphaned Rules") return -1;
        return a.categoryPath.localeCompare(b.categoryPath);
      });

    return { subcategoriesWithRules, totalCount: subcategoriesWithRules.reduce((sum, s) => sum + s.rules.length, 0) };
  }, [archivedRules]);

  if (archivedRules.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-xl text-gray-600">No archived rules found.</p>
      </div>
    );
  }

  return (
    <>
      <SearchBar />
      <div className="max-sm:h-auto m-4">
        <h1 className="m-0 mb-4 flex items-end max-sm:flex-col max-sm:items-start">
          <span className="text-ssw-red font-bold">{groupedArchivedData.totalCount.toLocaleString("en-US")}&nbsp; Archived Rules</span>
        </h1>
      </div>
      <div className="layout-two-columns">
        <div className="layout-main-section">
          {groupedArchivedData.subcategoriesWithRules.map((subcategoryData, index) => (
            <Card key={index} className="mb-4">
              <h2 className="m-0 mb-4 text-2xl max-sm:text-lg">
                <span>{subcategoryData.categoryPath}</span>
              </h2>

              <ol>
                {subcategoryData.rules.map((rule, ruleIndex) => (
                  <li key={ruleIndex} className="mb-4">
                    <div className="flex justify-between">
                      <Link href={`/${rule.uri}`} className="hover:text-ssw-red">
                        {rule.title}
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>

        <div className="layout-sidebar">
          {latestRules.length > 0 && <LatestRulesCard rules={latestRules} />}
          {quickLinks.length > 0 && <QuickLinksCard links={quickLinks} />}
          <WhyRulesCard />
          <HelpImproveCard />
          <HelpCard />
          <AboutSSWCard />
          <JoinConversationCard />
        </div>
      </div>
    </>
  );
}
