'use client';

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

interface LatestRuleClientPageProps {
  ruleCount: number;
  latestRulesByUpdated: LatestRule[];
  latestRulesByCreated: LatestRule[];
}

export default function LatestRuleClientPage({ ruleCount, latestRulesByUpdated, latestRulesByCreated }: LatestRuleClientPageProps) {

  return (
       <>
          <Breadcrumbs breadcrumbText="Latest Rules" />
          <div className="layout-two-columns">
            <div className="layout-main-section">
              <div className="h-[5rem]">
                <SearchBar />
              </div>
              
              <LatestRulesList 
                rulesByUpdated={latestRulesByUpdated}
                rulesByCreated={latestRulesByCreated}
                title="Latest Rules"
              />
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
