import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import ActivityRulesView from "@/components/ActivityRulesView";
import { fetchDiscussionData } from "@/lib/services/github/discussions.service";
import { fetchActivityLatestRules, fetchQuickLinks } from "@/lib/services/rules";
import { trackServerException } from "@/lib/server/appInsightsServer";
import { siteUrl } from "@/site-config";

export const revalidate = 21600; // 6 hours

export default async function Home() {
  try {
    const [activityData, latestRulesData, quickLinks] = await Promise.all([
      fetchDiscussionData().catch(() => null),
      fetchActivityLatestRules(50),
      fetchQuickLinks(),
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
        quickLinks={quickLinks}
      />
    );
  } catch (error) {
    // Re-throw redirect — Next.js uses a thrown error internally for redirect()
    if (isRedirectError(error)) {
      throw error;
    }

    // Log to Application Insights, then re-throw so error.tsx renders a
    // user-friendly error page
    trackServerException(error, { component: "HomePage" });
    throw error;
  }
}

export async function generateMetadata() {
  return {
    title: "SSW.Rules | Secret Ingredients for Quality Software (Open Source on GitHub)",
    alternates: {
      canonical: `${siteUrl}/`,
    },
  };
}
