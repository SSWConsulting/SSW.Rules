"use server";

import { getCachedDiscussionData, DiscussionData } from "@/lib/services/github/discussions.service";

export async function getActivityData(): Promise<DiscussionData> {
  return getCachedDiscussionData();
}
