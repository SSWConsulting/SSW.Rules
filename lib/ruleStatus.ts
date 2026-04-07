export type RuleStatus = "fresh" | "stale" | "rebuilding";

const STALE_THRESHOLD_MONTHS = 12;

export function getRuleStatus(lastUpdated: string | null | undefined, isBeingRebuilt?: boolean): RuleStatus | null {
  if (!lastUpdated) return null;

  const updatedDate = new Date(lastUpdated);
  if (isNaN(updatedDate.getTime())) return null;

  if (isBeingRebuilt) return "rebuilding";

  const now = new Date();
  const thresholdDate = new Date(now.getFullYear(), now.getMonth() - STALE_THRESHOLD_MONTHS, now.getDate());

  return updatedDate >= thresholdDate ? "fresh" : "stale";
}

export function getRuleStatusLabel(status: RuleStatus): string {
  switch (status) {
    case "fresh":
      return "Fresh";
    case "stale":
      return "Stale";
    case "rebuilding":
      return "Being Rebuilt";
  }
}

export function getRuleStatusDescription(lastUpdated: string | null | undefined, status: RuleStatus): string {
  if (!lastUpdated) return "";

  const updatedDate = new Date(lastUpdated);
  if (isNaN(updatedDate.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - updatedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);

  const timeAgoText = diffMonths < 1 ? `${diffDays} day${diffDays !== 1 ? "s" : ""} ago` : `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`;

  switch (status) {
    case "fresh":
      return `This rule was last updated ${timeAgoText}`;
    case "stale":
      return `This rule was last updated ${timeAgoText} and may be outdated`;
    case "rebuilding":
      return `This rule is currently being updated (open PR detected)`;
  }
}
