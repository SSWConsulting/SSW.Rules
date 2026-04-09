import { Suspense } from "react";
import SetBranchClientPage from "./client-page";

export default function SetBranchPage() {
  return (
    <Suspense fallback={null}>
      <SetBranchClientPage />
    </Suspense>
  );
}
