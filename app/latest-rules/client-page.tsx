'use client';

import { useEffect, useState } from 'react';
import SearchBar from '@/components/SearchBar';
import RuleCount from '@/components/RuleCount';
import WhyRulesCard from '@/components/WhyRulesCard';
import HelpImproveCard from '@/components/HelpImproveCard';
import AboutSSWCard from '@/components/AboutSSWCard';
import JoinConversationCard from '@/components/JoinConversationCard';
import HelpCard from '@/components/HelpCard';
import LatestRulesList from '@/components/LatestRulesList';
import { LatestRule } from '@/models/LatestRule';
import Breadcrumbs from '@/components/Breadcrumbs';
import Spinner from '@/components/Spinner';
import client from '@/tina/__generated__/client';
import { findAuthorUrlForResult } from '@/lib/services/rules';

interface LatestRuleClientPageProps {
  ruleCount: number;
  initialSize: number;
}

export default function LatestRuleClientPage({ ruleCount, initialSize }: LatestRuleClientPageProps) {
  const [latestRulesByUpdated, setLatestRulesByUpdated] = useState<LatestRule[]>([]);
  const [latestRulesByCreated, setLatestRulesByCreated] = useState<LatestRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      setIsLoading(true);
      try {
        const [updatedRes, createdRes] = await Promise.all([
          client.queries.latestRulesQuery({ size: initialSize, sortOption: "lastUpdated", includeBody: true }),
          client.queries.latestRulesQuery({ size: initialSize, sortOption: "created", includeBody: true }),
        ]);

        const processRules = (res: any) => {
          const results = res?.data?.ruleConnection?.edges
            ?.filter((edge: any) => edge && edge.node)
            .map((edge: any) => edge.node) || [];

          return results.map((r: any) => ({
            ...r,
            authorUrl: findAuthorUrlForResult(r),
          }));
        };

        setLatestRulesByUpdated(processRules(updatedRes));
        setLatestRulesByCreated(processRules(createdRes));
      } catch (error) {
        console.error('Error fetching latest rules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRules();
  }, [initialSize]);

  return (
       <>
          <Breadcrumbs breadcrumbText="Latest Rules" />
          <div className="layout-two-columns">
            <div className="layout-main-section">
              <div className="h-[5rem]">
                <SearchBar />
              </div>

              {isLoading ? (
                <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
                  <Spinner size="xl" />
                  <p className="text-gray-500 text-lg">Loading latest rules...</p>
                </div>
              ) : (
                <LatestRulesList
                  rulesByUpdated={latestRulesByUpdated}
                  rulesByCreated={latestRulesByCreated}
                  title="Latest Rules"
                />
              )}
            </div>

            <div className="layout-sidebar">
              <div className="h-[3.5rem]">
                {ruleCount && <RuleCount count={ruleCount} />}
              </div>
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
