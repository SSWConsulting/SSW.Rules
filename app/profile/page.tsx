import { Section } from "@/components/layout/section";
import { siteUrl } from "@/site-config";
import ProfileClientPage from "./client-page";

export const revalidate = 300;

export default function ProfilePage() {
  return (
    <Section>
      <ProfileClientPage />
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Profile | SSW.Rules",
    alternates: {
      canonical: `${siteUrl}/profile`,
    },
  };
}
