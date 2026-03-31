"use client";

import { useTina } from "tinacms/dist/react";
import ActivityRulesView from "@/app/(home)/components/ActivityRulesView";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";

export type TinaActivityWrapperProps = {
  rules: ActivityRule[];
  total: number;
  recentComments: RecentComment[];
  latestRulesData: ActivityRule[];
  tinaQueryProps: { query: string; variables: any; data: any };
};

export function TinaActivityWrapper({ rules, total, recentComments, latestRulesData, tinaQueryProps }: TinaActivityWrapperProps) {
  const { data } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  return (
    <ActivityRulesView
      rules={rules}
      total={total}
      recentComments={recentComments}
      latestRulesData={latestRulesData}
      homepage={data.homepage}
    />
  );
}
