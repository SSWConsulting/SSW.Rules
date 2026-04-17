import { redirect } from "next/navigation";
import { TinaActivityWrapper } from "@/app/(home)/TinaActivityWrapper";
import { fetchDiscussionData } from "@/lib/services/github/discussions.service";
import { fetchActivityLatestRules, fetchHomepageData, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";

export const revalidate = 21600; // 6 hours

export default async function Home() {
  const [activityData, latestRulesResult, homePageData, ruleCount] = await Promise.all([
    fetchDiscussionData().catch(() => null),
    fetchActivityLatestRules(50),
    fetchHomepageData(),
    fetchRuleCount(),
  ]);

  if (!activityData) {
    redirect("/categories");
  }

  return (
    <TinaActivityWrapper
      rules={activityData.activityRules}
      total={activityData.activityRules.length}
      recentComments={activityData.recentComments}
      latestRulesData={latestRulesResult.rules}
      ruleCount={ruleCount}
      tinaQueryProps={homePageData as { query: string; variables: any; data: any }}
      activityRulesTinaProps={activityData.rulesByGuidTinaProps}
      latestRulesTinaProps={latestRulesResult.tinaProps}
    />
  );
}

export async function generateMetadata() {
  return {
    title: "SSW.Rules | Secret Ingredients for Quality Software (Open Source on GitHub)",
    alternates: {
      canonical: `${siteUrl}/`,
    },
  };
}
