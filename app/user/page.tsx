import { Suspense } from "react";
import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import { fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import UserRulesClientPage from "./client-page";

export const revalidate = 300;

export default async function UserRulesPage() {
  const ruleCount = await fetchRuleCount();

  return (
    <Section>
      <Suspense fallback={null}>
        <UserRulesClientPage ruleCount={ruleCount} />
      </Suspense>
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Profile | SSW.Rules",
    alternates: {
      canonical: `${siteUrl}/rules/user`,
    },
  };
}
