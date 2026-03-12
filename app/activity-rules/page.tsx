import { Section } from "@/components/layout/section";
import { getCachedDiscussionData } from "@/lib/services/github/discussions.service";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";
import { siteUrl } from "@/site-config";
import ActivityRulesClientPage from "./client-page";

// force-dynamic ensures this page always renders at request time using runtime
// env vars (GH_APP_PRIVATE_KEY etc.), which are unavailable at next build time
// inside Docker. The 6-hour data cache is handled by unstable_cache in
// discussions.service.ts, so there is no performance penalty.
export const dynamic = "force-dynamic";

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

