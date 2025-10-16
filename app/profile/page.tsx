import { Section } from "@/components/layout/section";
import ProfileClientPage from "./client-page";
import { Suspense } from "react";

export const revalidate = 300;

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileClientPage />
    </Suspense>
  );
}
