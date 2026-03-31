"use client";

import { useTina } from "tinacms/dist/react";
import AboutSSWCard from "@/app/(home)/components/AboutSSWCard";
import HelpCard from "@/app/(home)/components/HelpCard";
import HelpImproveCard from "@/app/(home)/components/HelpImproveCard";
import JoinConversationCard from "@/app/(home)/components/JoinConversationCard";
import QuickLinksCard from "@/app/(home)/components/QuickLinksCard";
import WhyRulesCard from "@/app/(home)/components/WhyRulesCard";

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
