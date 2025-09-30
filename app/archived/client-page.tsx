'use client';

import React, { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import RuleCount from "@/components/RuleCount";
import LatestRulesCard from "@/components/LatestRulesCard";
import QuickLinksCard from "@/components/QuickLinksCard";
import WhyRulesCard from "@/components/WhyRulesCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import AboutSSWCard from "@/components/AboutSSWCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import HelpCard from "@/components/HelpCard";
import { Rule } from "@/models/Rule";
import ruleToCategories from "../../rule-to-categories.json";

export interface ArchivedClientPageProps {
  archivedRules: Rule[];
  topCategories: any[];
  latestRules?: any[];
  quickLinks?: any[];
}

export default function ArchivedClientPage(props: ArchivedClientPageProps) {
  const { archivedRules, topCategories, latestRules = [], quickLinks = [] } = props;

  // Group archived rules by subcategory
  const groupedArchivedData = useMemo(() => {
    const categoryRules: Record<string, Rule[]> = {};
    
    // Group archived rules by category
    archivedRules.forEach((rule) => {
      const ruleFilename = rule.uri.replace('/', '').replace('.html', '');
      const categories = ruleToCategories[ruleFilename as keyof typeof ruleToCategories] || [];
      
      if (categories.length === 0) {
        if (!categoryRules['uncategorized']) categoryRules['uncategorized'] = [];
        categoryRules['uncategorized'].push(rule);
      } else {
        categories.forEach(category => {
          if (!categoryRules[category]) categoryRules[category] = [];
          categoryRules[category].push(rule);
        });
      }
    });
    
    // Create organized subcategories with their rules
    const subcategoriesWithRules: Array<{
      category: any;
      rules: Rule[];
      count: number;
    }> = [];
    
    topCategories.forEach(topCategory => {
      topCategory.index?.forEach((item: any) => {
        if (!item.category) return;
        
        const filename = item.category._sys.filename;
        const rules = categoryRules[filename] || [];
        
        if (rules.length > 0) {
          subcategoriesWithRules.push({
            category: item.category,
            rules,
            count: rules.length
          });
        }
      });
    });
    
    return { subcategoriesWithRules, totalCount: archivedRules.length };
  }, [archivedRules, topCategories]);

  if (archivedRules.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-xl text-gray-600">No archived rules found.</p>
      </div>
    );
  }

  return (
    <div className="layout-two-columns">
      <div className="layout-main-section">
        <div className="h-[5.5rem]">
          <h2 className="m-0 mb-4 text-ssw-red font-bold">Archived Rules</h2>
        </div>

        {groupedArchivedData.subcategoriesWithRules.map((subcategoryData, index) => (
          <Card key={index} className="mb-4">
            <h2 className="m-0 mb-4 text-2xl max-sm:text-lg">
              <span>{subcategoryData.category.title}</span>
            </h2>

            <ol>
              {subcategoryData.rules.map((rule, ruleIndex) => (
                <li key={ruleIndex} className="mb-4">
                  <div className="flex justify-between">
                    <Link 
                      href={rule.uri} 
                      className="hover:text-ssw-red"
                    >
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
        <div className="h-[5.5rem]">
          <RuleCount count={groupedArchivedData.totalCount} label="Archived Rules" />
        </div>
        {latestRules.length > 0 && <LatestRulesCard rules={latestRules} />}
        {quickLinks.length > 0 && <QuickLinksCard links={quickLinks} />}
        <WhyRulesCard />
        <HelpImproveCard />
        <HelpCard />
        <AboutSSWCard />
        <JoinConversationCard />
      </div>
    </div>
  );
}