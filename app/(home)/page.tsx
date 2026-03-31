import { redirect } from "next/navigation";
import { TinaActivityWrapper } from "@/app/(home)/TinaActivityWrapper";
import { fetchDiscussionData } from "@/lib/services/github/discussions.service";
import { fetchActivityLatestRules } from "@/lib/services/rules";
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
  const [activityData, latestRulesData, homePageData] = await Promise.all([
    fetchDiscussionData().catch(() => null),
    fetchActivityLatestRules(50),
    fetchHomepageData(),
  ]);

  if (!activityData) {
    redirect("/categories");
  }

  return (
    <TinaActivityWrapper
      rules={activityData.activityRules}
      total={activityData.activityRules.length}
      recentComments={activityData.recentComments}
      latestRulesData={latestRulesData}
      tinaQueryProps={homePageData as { query: string; variables: any; data: any }}
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
