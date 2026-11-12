import { readFile } from "node:fs/promises";
import path from "node:path";
import client from "@/tina/__generated__/client";

// The content preparation (scripts/rule-folders.js) writes this file to the project root from the content checkout.
export const RULE_FOLDERS_FILE = "rule-folders.json";

export type RuleFoldersFile = { folders: string[]; problem: null } | { folders: null; problem: string };

const isFolderName = (value: unknown): value is string => typeof value === "string" && value.length > 0 && !value.includes("/");

/**
 * Reads the rule folder names from the file.
 *
 * `folders` is null when the file is missing or is not a non-empty list of folder names, and `problem` gives the cause.
 * A project that did not run the content preparation has no file.
 */
export async function readRuleFolders(filePath = path.join(process.cwd(), RULE_FOLDERS_FILE)): Promise<RuleFoldersFile> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    return { folders: null, problem: code === "ENOENT" ? "file not found" : `cannot read the file (${code ?? error})` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { folders: null, problem: "not valid JSON" };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return { folders: null, problem: "not a non-empty list" };
  if (!parsed.every(isFolderName)) return { folders: null, problem: "an entry is not a folder name" };

  return { folders: parsed, problem: null };
}

// A failed request ends the paging, and the list then has only the rules of the earlier pages.
async function queryRuleFolders(): Promise<string[]> {
  const folders = new Set<string>();
  let after: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const res = await client.queries.allRulesPaths({ first: 200, after }).catch((err: any) => {
      console.warn("allRuleFoldersQuery page fetch error:", err?.message || err);
      return null;
    });

    for (const edge of res?.data?.ruleConnection?.edges ?? []) {
      // e.g. "definition-of-done/rule.mdx" => "definition-of-done"
      const folder = edge?.node?._sys?.relativePath?.split("/")?.[0];
      if (folder) folders.add(folder);
    }

    const pageInfo = res?.data?.ruleConnection?.pageInfo;
    hasNext = !!pageInfo?.hasNextPage;
    after = pageInfo?.endCursor ?? null;
  }

  return Array.from(folders);
}

/**
 * The folder names of all rules, which are the URLs of the rule pages that the build prerenders.
 *
 * The list comes from the file, so the build does not page through all rules on TinaCloud. Without a valid file
 * (local development), the list comes from paged Tina requests. The log line shows which source a build used.
 */
export async function getRuleFolders(): Promise<string[]> {
  const file = await readRuleFolders();
  const folders = file.folders ?? (await queryRuleFolders());
  const source = file.folders ? RULE_FOLDERS_FILE : `Tina (${RULE_FOLDERS_FILE}: ${file.problem})`;

  console.log(`📋 generateStaticParams: rules=${folders.length} source=${source}`);
  return folders;
}
