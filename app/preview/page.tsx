import { Suspense } from "react";
import PreviewClientPage from "./client-page";

export default function SetBranchPage() {
  return (
    <Suspense fallback={null}>
      <PreviewClientPage />
    </Suspense>
  );
}
