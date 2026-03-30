import { redirect } from "next/navigation";
import ActivityRulesView from "@/app/(home)/components/ActivityRulesView";
import { fetchDiscussionData } from "@/lib/services/github/discussions.service";
import { fetchActivityLatestRules, fetchQuickLinks } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";

export const revalidate = 21600; // 6 hours

async function fetchHomepageData() {
  try {
    const res = await client.queries.homepage({
      relativePath: "index.json",
    });
    return {
      data: res.data,
      query: res.query,
      variables: res.variables,
    };
  } catch (error) {
    console.error("Failed to fetch homepage data from Tina CMS:", error);
    return {
      data: null,
      query: null,
      variables: {
        relativePath: "index.json",
      },
    };
  }
}

export default async function Home() {
  const [activityData, latestRulesData, quickLinks, homePageData] = await Promise.all([
    fetchDiscussionData().catch(() => null),
    fetchActivityLatestRules(50),
    fetchQuickLinks(),
    fetchHomepageData(),
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
      homepageData={homePageData}
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
