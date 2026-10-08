import { unstable_cache } from "next/cache";
import { getRulesChatLimits } from "@/lib/rulesChat/config";
import { createDynamicsService } from "@/lib/services/dynamics";

type SessionUser = { sub?: string; nickname?: string };

// "staff": a current SSW employee, with a high safety cap. "member": any other GitHub user, with a daily limit.
export type RulesChatTier = "staff" | "member";

const EMPLOYEE_LIST_TTL_SECONDS = 60 * 60;

function gitHubUsername(profileUrl: string): string {
  return profileUrl.trim().replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? "";
}

// Only a GitHub sign-in proves the nickname is that person's GitHub username.
function isGitHubUser(user: SessionUser | null | undefined): user is SessionUser & { sub: string; nickname: string } {
  return Boolean(user?.nickname && user.sub?.startsWith("github|"));
}

// The whole username must match: a substring match would let "ant" in as "AntPolkanov".
export function isEmployeeGitHubUser(user: SessionUser | null | undefined, employeeGitHubUrls: string[]): boolean {
  if (!isGitHubUser(user)) return false;
  const nickname = user.nickname.toLowerCase();
  return employeeGitHubUrls.some((url) => gitHubUsername(url) === nickname);
}

const getCurrentEmployeeGitHubUrls = unstable_cache(
  async () => {
    const employees = await createDynamicsService().getEmployees({ includeCurrent: true, includePast: false });
    return employees.map((employee) => employee.gitHubUrl).filter(Boolean);
  },
  ["rules-chat-current-employee-github-urls"],
  { revalidate: EMPLOYEE_LIST_TTL_SECONDS }
);

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
  if (!isGitHubUser(user)) return null;
  if (isEmployeeGitHubUser(user, await getCurrentEmployeeGitHubUrls())) return "staff";
  return getRulesChatLimits().memberDailyLimit > 0 ? "member" : null;
}
