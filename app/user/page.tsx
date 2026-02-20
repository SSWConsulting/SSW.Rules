import { Suspense } from "react";
import { Section } from "@/components/layout/section";
import { siteUrl } from "@/site-config";
import UserRulesClientPage from "./client-page";

export const revalidate = 300;

export default async function UserRulesPage() {
  return (
    <Section>
      <Suspense fallback={null}>
        <UserRulesClientPage />
      </Suspense>
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "My Rules | SSW.Rules",
    alternates: {
      canonical: `${siteUrl}/user/`,
    },
  };
}
