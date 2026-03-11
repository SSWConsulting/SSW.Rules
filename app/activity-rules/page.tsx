import { Section } from "@/components/layout/section";
import { getCachedDiscussionData } from "@/lib/services/github/discussions.service";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";
import { siteUrl } from "@/site-config";
import ActivityRulesClientPage from "./client-page";

export const revalidate = 21600; // 6 hours

export default async function ActivityRulesPage() {
  let activityRules: ActivityRule[] = [];
  let recentComments: RecentComment[] = [];

  try {
    ({ activityRules, recentComments } = await getCachedDiscussionData());
  } catch (error) {
    console.error("[activity-rules] Failed to fetch discussion data:", error);
  }

  return (
    <Section>
      <ActivityRulesClientPage rules={activityRules} total={activityRules.length} recentComments={recentComments} />
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Rules by Activity | SSW.Rules",
    alternates: {
      canonical: `${siteUrl}/activity-rules`,
    },
  };
}

