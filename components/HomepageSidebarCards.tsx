"use client";

import { useTina } from "tinacms/dist/react";
import AboutSSWCard from "@/components/AboutSSWCard";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import QuickLinksCard from "@/components/QuickLinksCard";
import WhyRulesCard from "@/components/WhyRulesCard";

interface HomepageSidebarCardsProps {
  tinaHomepageProps: { query: string; variables: any; data: any };
}

export default function HomepageSidebarCards({ tinaHomepageProps }: HomepageSidebarCardsProps) {
  const { data } = useTina({
    query: tinaHomepageProps.query,
    variables: tinaHomepageProps.variables,
    data: tinaHomepageProps.data,
  });

  const homepage = data?.homepage;

  return (
    <>
      <QuickLinksCard data={homepage?.quickLinks} />
      <WhyRulesCard data={homepage?.whyRules} />
      <HelpImproveCard data={homepage?.helpImprove} />
      <HelpCard data={homepage?.needHelp} />
      <AboutSSWCard data={homepage?.aboutSsw} />
      <JoinConversationCard data={homepage?.joinConversation} />
    </>
  );
}
