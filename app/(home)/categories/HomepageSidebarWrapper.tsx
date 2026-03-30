"use client";

import { useTina } from "tinacms/dist/react";
import AboutSSWCard from "@/app/(home)/components/AboutSSWCard";
import HelpCard from "@/app/(home)/components/HelpCard";
import HelpImproveCard from "@/app/(home)/components/HelpImproveCard";
import JoinConversationCard from "@/app/(home)/components/JoinConversationCard";
import WhyRulesCard from "@/app/(home)/components/WhyRulesCard";

interface HomepageSidebarWrapperProps {
  tinaQueryProps: { query: string; variables: any; data: any };
}

export default function HomepageSidebarWrapper({ tinaQueryProps }: HomepageSidebarWrapperProps) {
  const { data } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  const homepage = data?.homepage;

  return (
    <>
      <WhyRulesCard data={homepage?.whyRules} />
      <HelpImproveCard data={homepage?.helpImprove} />
      <HelpCard data={homepage?.needHelp} />
      <AboutSSWCard data={homepage?.aboutSsw} />
      <JoinConversationCard data={homepage?.joinConversation} />
    </>
  );
}
