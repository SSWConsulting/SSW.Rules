"use client";

import { useTina } from "tinacms/dist/react";
import ActivityRulesView from "@/components/ActivityRulesView";
import HomepageHeader from "@/components/HomepageHeader";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";

export type TinaActivityWrapperProps = {
  rules: ActivityRule[];
  total: number;
  recentComments: RecentComment[];
  latestRulesData: ActivityRule[];
  ruleCount: number;
  tinaQueryProps: { query: string; variables: any; data: any };
};

export function TinaActivityWrapper({ rules, total, recentComments, latestRulesData, ruleCount, tinaQueryProps }: TinaActivityWrapperProps) {
  const { data } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  const homepage = data?.homepage;

  return (
    <>
      <HomepageHeader homepage={homepage} ruleCount={ruleCount} />
      <ActivityRulesView rules={rules} total={total} recentComments={recentComments} latestRulesData={latestRulesData} homepage={homepage} />
    </>
  );
}
