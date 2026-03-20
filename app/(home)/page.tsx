import { redirect } from "next/navigation";
import ActivityRulesView from "@/components/ActivityRulesView";
import { fetchDiscussionData } from "@/lib/services/github/discussions.service";
import { siteUrl } from "@/site-config";

export const revalidate = 21600; // 6 hours

export default async function Home() {
  const activityData = await fetchDiscussionData().catch(() => null);

  if (!activityData) {
    redirect("/categories");
  }

  return (
    <ActivityRulesView
      rules={activityData.activityRules}
      total={activityData.activityRules.length}
      recentComments={activityData.recentComments}
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
