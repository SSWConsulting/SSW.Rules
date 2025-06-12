import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import RulesSearchClientPage from "./client-page";
import { Suspense } from "react";

export const revalidate = 300;

export default function RulesSearchPage() {
  return (
    <Layout>
      <Section>
        <Suspense fallback={null}>
          <RulesSearchClientPage />
        </Suspense>
      </Section>
    </Layout>
  );
}
