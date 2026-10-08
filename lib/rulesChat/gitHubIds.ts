import { getGitHubAppToken } from "@/lib/services/github/github.utils";

const GRAPHQL_URL = "https://api.github.com/graphql";
const USERS_PER_QUERY = 50;
// GitHub usernames: letters, digits and single hyphens, up to 39 characters. Anything else can't be put in a query.
const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

// Looks up the numeric account ID behind each GitHub username. A username is only a label: after a rename someone else
// can register it, while the ID stays with the account. Usernames GitHub doesn't know are left out.
export async function resolveGitHubIds(usernames: string[]): Promise<Set<number>> {
  const valid = [...new Set(usernames.map((name) => name.toLowerCase()))].filter((name) => USERNAME_PATTERN.test(name));
  const ids = new Set<number>();
  if (valid.length === 0) return ids;

  const token = await getGitHubAppToken();
  for (let start = 0; start < valid.length; start += USERS_PER_QUERY) {
    const batch = valid.slice(start, start + USERS_PER_QUERY);
    const query = `query { ${batch.map((name, index) => `u${index}: user(login: "${name}") { databaseId }`).join(" ")} }`;
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `bearer ${token}` },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`GitHub user lookup failed (${response.status}): ${await response.text()}`);
    // A username with no account comes back as null with a NOT_FOUND error, which is expected here.
    const { data } = (await response.json()) as { data?: Record<string, { databaseId?: number } | null> };
    for (const user of Object.values(data ?? {})) if (user?.databaseId) ids.add(user.databaseId);
  }
  return ids;
}

// Auth0's sub for a GitHub sign-in is "github|<numeric account ID>".
export function gitHubIdFromSub(sub: string | undefined): number | null {
  const match = sub?.match(/^github\|(\d+)$/);
  return match ? Number(match[1]) : null;
}
