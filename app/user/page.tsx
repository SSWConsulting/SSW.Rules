import { Suspense } from "react";
import { Section } from "@/components/layout/section";
import { pageMetadata } from "@/lib/pageMetadata";
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
  return pageMetadata({ title: "Profile | SSW.Rules", path: "user" });
}
