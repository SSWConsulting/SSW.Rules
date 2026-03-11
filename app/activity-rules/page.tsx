import { Section } from "@/components/layout/section";
import { getCachedActivityRules } from "@/lib/services/github/discussions.service";
import { siteUrl } from "@/site-config";
import ActivityRulesClientPage from "./client-page";

export const revalidate = 21600; // 6 hours

export default async function ActivityRulesPage() {
  let rules: Awaited<ReturnType<typeof getCachedActivityRules>> = [];

  try {
    rules = await getCachedActivityRules();
  } catch (error) {
    console.error("[activity-rules] Failed to fetch activity rules:", error);
  }

  return (
    <Section>
      <ActivityRulesClientPage rules={rules} total={rules.length} />
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
