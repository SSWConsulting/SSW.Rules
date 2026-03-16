import { redirect } from "next/navigation";

// The activity-rules experience has moved to the homepage as an alternative view.
export default function ActivityRulesPage() {
  redirect("/");
}
