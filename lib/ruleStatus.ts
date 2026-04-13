export type RuleStatus = "fresh" | "stale" | "rebuilding";

/** If a webhook was received but the page hasn't regenerated within this window, consider it "rebuilding". Beyond this, it's "stale". */
const REBUILDING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Determine the ISR status of a rule page by comparing timestamps.
 *
 * @param pageGeneratedAt - When this static page was last rendered (baked into HTML at ISR time)
 * @param lastWebhookAt   - When the most recent TinaCMS webhook fired for this slug (from revalidation-store)
 * @param now             - Current time in ms (defaults to Date.now(), injectable for testing)
 */
export function getRuleStatus(pageGeneratedAt: number | undefined, lastWebhookAt: number | null, now: number = Date.now()): RuleStatus {
  // No webhook recorded → page is as fresh as it can be
  if (!lastWebhookAt) return "fresh";

  // Page was generated after the webhook → content is up to date
  if (pageGeneratedAt && pageGeneratedAt >= lastWebhookAt) return "fresh";

  // Webhook fired but page hasn't regenerated yet
  const elapsed = now - lastWebhookAt;
  return elapsed < REBUILDING_THRESHOLD_MS ? "rebuilding" : "stale";
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

export function getRuleStatusDescription(status: RuleStatus): string {
  switch (status) {
    case "fresh":
      return "This page is up to date with the latest content";
    case "stale":
      return "Content has changed but this page has not been regenerated yet";
    case "rebuilding":
      return "Content has changed and the page is being regenerated";
  }
}
