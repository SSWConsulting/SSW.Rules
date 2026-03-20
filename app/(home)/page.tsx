import { redirect } from "next/navigation";
import ActivityRulesView from "@/components/ActivityRulesView";
import { fetchDiscussionData } from "@/lib/services/github/discussions.service";
import { fetchActivityLatestRules } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";

export const revalidate = 21600; // 6 hours

export default async function Home() {
  const [activityData, latestRulesData] = await Promise.all([
    fetchDiscussionData().catch(() => null),
    fetchActivityLatestRules(200),
  ]);

  if (!activityData) {
    redirect("/categories");
  }

  return (
    <ActivityRulesView
      rules={activityData.activityRules}
      total={activityData.activityRules.length}
      recentComments={activityData.recentComments}
      latestRulesData={latestRulesData}
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
