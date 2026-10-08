import { unstable_cache } from "next/cache";
import { getRulesChatLimits } from "@/lib/rulesChat/config";
import { gitHubIdFromSub, resolveGitHubIds } from "@/lib/rulesChat/gitHubIds";
import { createDynamicsService } from "@/lib/services/dynamics";

type SessionUser = { sub?: string };

// "staff": a current SSW employee, with a high safety cap. "member": any other GitHub user, with a daily limit.
export type RulesChatTier = "staff" | "member";

const EMPLOYEE_LIST_TTL_SECONDS = 60 * 60;

function gitHubUsername(profileUrl: string): string {
  return profileUrl.trim().replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? "";
}

// Staff are matched on the GitHub account ID in Auth0's sub, not the username: if an employee renames their account
// and CRM still has the old URL, whoever registers the old name must not get the staff tier.
export function isEmployeeGitHubUser(user: SessionUser | null | undefined, employeeGitHubIds: ReadonlySet<number>): boolean {
  const id = gitHubIdFromSub(user?.sub);
  return id !== null && employeeGitHubIds.has(id);
}

// unstable_cache stores JSON, so the IDs are cached as an array.
const getCurrentEmployeeGitHubIds = unstable_cache(
  async () => {
    const employees = await createDynamicsService().getEmployees({ includeCurrent: true, includePast: false });
    const usernames = employees.map((employee) => gitHubUsername(employee.gitHubUrl)).filter(Boolean);
    return [...(await resolveGitHubIds(usernames))];
  },
  ["rules-chat-current-employee-github-ids"],
  { revalidate: EMPLOYEE_LIST_TTL_SECONDS }
);

// If CRM or GitHub can't be reached, nobody gets the staff tier until they can: staff then fall back to the member tier,
// like any other GitHub user, rather than everyone losing access.
async function employeeGitHubIdsOrNone(): Promise<ReadonlySet<number>> {
  try {
    return new Set(await getCurrentEmployeeGitHubIds());
  } catch (error) {
    console.error("[RulesChat] couldn't load the employees' GitHub IDs:", error);
    return new Set();
  }
}

// Read on every request, so The Rulekeeper can be switched off with an app setting and no rebuild.
function isRulesChatEnabled(): boolean {
  return process.env.RULES_CHAT_ENABLED === "true";
}

// Lets any signed-in developer use The Rulekeeper locally without CRM credentials. Only a development server honours it,
// so a production build ignores the setting even if it is set by mistake.
export function hasDevAccess(): boolean {
  return process.env.NODE_ENV === "development" && process.env.RULES_CHAT_DEV_ACCESS === "true";
}

export async function getRulesChatTier(user: SessionUser | null | undefined): Promise<RulesChatTier | null> {
  if (!isRulesChatEnabled()) return null;
  if (hasDevAccess() && user?.sub) return "staff";
  if (gitHubIdFromSub(user?.sub) === null) return null;
  if (isEmployeeGitHubUser(user, await employeeGitHubIdsOrNone())) return "staff";
  return getRulesChatLimits().memberDailyLimit > 0 ? "member" : null;
}
