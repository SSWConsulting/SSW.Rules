import { Section } from "@/components/layout/section";
import ProfileClientPage from "./client-page";
import { Suspense } from "react";
import { siteUrl } from "@/site-config";

export const revalidate = 300;

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileClientPage />
    </Suspense>
  );
}

export async function generateMetadata() {
  return {
    title: "Profile | SSW.Rules",
    alternates: {
      canonical: `${siteUrl}/profile/`,
    },
  };
}
