import client from "@/tina/__generated__/client";
import ruleToCategories from "../../../rule-to-categories.json";

export async function fetchLatestRules(
  size: number = 5, 
  sortOption: "lastUpdated" | "created" = "lastUpdated"
) {
  const res = await client.queries.latestRulesQuery({
    size,
    sortOption,
  });

  return (
    res?.data?.ruleConnection?.edges
      ?.filter((edge: any) => edge && edge.node)
      .map((edge: any) => edge.node) || []
  );
}

export async function fetchRuleCount() {
  return Object.keys(ruleToCategories).length;
}