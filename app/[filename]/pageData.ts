import { cache } from "react";
import {
  classifyTinaError,
  isRecordNotFound,
  tinaErrorMessage,
  tinaResponseErrorMessages,
  withTinaRetry,
  withTinaRetryAllowingErrors,
} from "@/lib/tina/tinaRequest";
import client from "@/tina/__generated__/client";
import { CategoryWithRulesQueryDocument } from "@/tina/__generated__/types";

// These loaders return null only when the record does not exist. Every other Tina error is retried and then
// thrown, and Next caches nothing for that render. The build then fails (staticGenerationRetryCount allows one
// attempt). At run time a background revalidation keeps the stale page, and a render with no usable cached page
// (for example after revalidatePath) returns a 500. A fallback rendered after a throttled request would be cached
// as NOT FOUND until the next deploy.

// TinaCloud returns throttling as a GraphQL error with HTTP 200. Next's data cache stores any 200 fetch response
// during a build and replays it for the same request body, so one throttled response would fail every retry and
// every later page that sends the same query. "no-store" keeps Tina responses out of that cache. The page stays
// static because of `dynamic = "force-static"`.
const tinaFetch = { fetchOptions: { cache: "no-store" as const } };

// Every rule folder and category file name uses only these characters. Another name cannot be a record, so it
// needs no Tina request, and Tina would reject it with "Invalid path".
const isPossibleFilename = (filename: string) => /^[A-Za-z0-9._-]+$/.test(filename);

export interface BrokenReferences {
  detected: boolean;
  paths: string[];
}

const getFullRelativePathFromFilename = async (filename: string): Promise<string | null> => {
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    let res;
    try {
      res = await withTinaRetry(`topCategoryWithIndexQuery after=${after}`, () => client.queries.topCategoryWithIndexQuery({ first: 50, after }, tinaFetch));
    } catch (error) {
      if (!isRecordNotFound(error)) throw error;
      // A top category that lists a missing category: the lookup cannot finish, so treat the page as a rule
      console.warn(`[getFullRelativePathFromFilename] topCategoryWithIndexQuery has a missing record, filename="${filename}":`, tinaErrorMessage(error));
      return null;
    }

    const topCategories = res?.data?.categoryConnection?.edges || [];
    for (const edge of topCategories) {
      const node = edge?.node;
      if (node?.__typename === "CategoryTop_category") {
        const topDir = node._sys.relativePath.replace("/index.mdx", "");

        for (const child of node.index || []) {
          if (child?.category?._sys?.filename === filename) {
            return `${topDir}/${filename}.mdx`;
          }
        }
      }
    }

    hasNextPage = !!res?.data?.categoryConnection?.pageInfo?.hasNextPage;
    after = res?.data?.categoryConnection?.pageInfo?.endCursor ?? null;
  }

  return null;
};

// React cache: the page and generateMetadata share one result for each render
export const getCategoryData = cache(async (filename: string) => {
  if (!isPossibleFilename(filename)) return null;
  const fullPath = await getFullRelativePathFromFilename(filename);
  if (!fullPath) return null;

  const query = String(CategoryWithRulesQueryDocument);
  const variables = { relativePath: fullPath };
  let res: any;
  try {
    // The client from `tinacms build` stores each response in a build cache keyed by the request body.
    // With the default "throw" policy a response with errors throws before it is stored, so a retry
    // sends a new request.
    res = await withTinaRetry(`categoryWithRulesQuery ${fullPath}`, () => (client as any).request({ query, variables }, tinaFetch));
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;

    // Some rules of the category are missing: errorPolicy "all" returns the category without them
    res = await withTinaRetryAllowingErrors(`categoryWithRulesQuery (with missing records) ${fullPath}`, query, (attemptQuery) =>
      (client as any).request({ query: attemptQuery, variables, errorPolicy: "all" }, tinaFetch)
    );
  }

  const errorMessages = tinaResponseErrorMessages(res);
  // A missing rule is the only error that may leave a gap in the list. Any other error could hide rules.
  const otherErrors = errorMessages.filter((m) => classifyTinaError(m) !== "not-found");
  if (otherErrors.length > 0) {
    throw new Error(`[getCategoryData] failed for filename="${filename}" relativePath="${fullPath}":\n${otherErrors.join("\n")}`);
  }
  if (errorMessages.length > 0) {
    console.warn(`[getCategoryData] Missing rule references in category relativePath="${fullPath}":\n${errorMessages.join("\n")}`);
  }

  // errorPolicy "all" returns { category: null } when the category file itself is missing
  if (!res?.data?.category) {
    console.error(`[getCategoryData] returned null for filename="${filename}" relativePath="${fullPath}" errors="${errorMessages.join(" | ")}"`);
    return null;
  }

  return { data: res.data, query, variables };
});

export const getRuleData = cache(async (filename: string) => {
  if (!isPossibleFilename(filename)) return null;
  const relativePath = `${filename}/rule.mdx`;

  let fullError: unknown;
  try {
    const full = await withTinaRetry(`ruleData ${relativePath}`, () => client.queries.ruleData({ relativePath }, tinaFetch));
    return { data: full.data, query: full.query, variables: full.variables, brokenReferences: null as BrokenReferences | null };
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
    fullError = error;
  }

  // "Unable to find record" from ruleData means the rule, one of its related rules or one of its categories is missing.
  // ruleDataBasic does not resolve related rules, so it separates a missing related rule from the other two cases.
  let basic;
  try {
    basic = await withTinaRetry(`ruleDataBasic ${relativePath}`, () => client.queries.ruleDataBasic({ relativePath }, tinaFetch));
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }

  const brokenPaths = Array.from(tinaErrorMessage(fullError).matchAll(/Unable to find record ([^\n]+)/g), (match) => match[1].trim());
  if (brokenPaths.length === 0) brokenPaths.push("unknown path");
  console.warn(`[getRuleData] broken related rule references for filename="${filename}", rendering without related rules: ${brokenPaths.join(", ")}`);

  return {
    data: { ...basic.data, rule: { ...basic.data.rule, related: [] } },
    query: basic.query,
    variables: basic.variables,
    brokenReferences: { detected: true, paths: brokenPaths } as BrokenReferences | null,
  };
});
