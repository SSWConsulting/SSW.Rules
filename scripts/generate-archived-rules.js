const fs = require("node:fs");
const path = require("node:path");

try {
  const dotenv = require("dotenv");
  const projectRoot = path.resolve(__dirname, "..");
  for (const envFile of [".env.local", ".env"]) {
    const fullPath = path.join(projectRoot, envFile);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath });
    }
  }
} catch {
  // dotenv is optional in CI where env vars are already set
}

const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "archived-rules.json");

const getBranch = () =>
  process.env.NEXT_PUBLIC_TINA_BRANCH || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || process.env.HEAD || "main";

const getCandidateUrls = () => {
  if (process.env.NODE_ENV === "development") {
    return ["http://localhost:4001/graphql"];
  }

  const clientId = process.env.NEXT_PUBLIC_TINA_CLIENT_ID;
  const branch = getBranch();
  if (!clientId || !branch) return [];

  const encodedBranch = encodeURIComponent(branch);
  return [
    `https://content.tinajs.io/2.1/content/${clientId}/github/${encodedBranch}`,
    `https://content.tinajs.io/1.5/content/${clientId}/github/${encodedBranch}`,
  ];
};

const query = `query archivedRulesQuery($first: Float, $after: String) {
  ruleConnection(filter: { isArchived: { eq: true } }, first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        uri
      }
    }
  }
}`;

async function request(url, token, variables) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["X-API-KEY"] = token;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 500)}` : ""}`);
  }

  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(json.errors.map((e) => e?.message).filter(Boolean).join("\n") || "GraphQL error");
  }

  return json?.data?.ruleConnection;
}

async function fetchAllArchivedSlugs(url, token) {
  const slugs = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const conn = await request(url, token, { first: 200, after });
    const edges = conn?.edges ?? [];

    for (const e of edges) {
      const uri = e?.node?.uri;
      if (typeof uri === "string" && uri) {
        slugs.push(uri);
      }
    }

    hasNextPage = !!conn?.pageInfo?.hasNextPage;
    after = conn?.pageInfo?.endCursor ?? null;
  }

  return slugs;
}

(async () => {
  const token = (process.env.TINA_TOKEN || "").trim();
  let slugs = [];

  try {
    const urls = getCandidateUrls();
    if (urls.length === 0) {
      console.warn("⚠️ generate-archived-rules: Missing NEXT_PUBLIC_TINA_CLIENT_ID/branch; writing empty archived-rules.json");
    }

    for (const url of urls) {
      try {
        slugs = await fetchAllArchivedSlugs(url, token);
        console.log(`📋 generate-archived-rules: fetched ${slugs.length} archived slugs from ${url}`);
        break;
      } catch (err) {
        console.warn(`⚠️ generate-archived-rules: failed against ${url}:`, err?.message || err);
      }
    }
  } catch (err) {
    console.warn("⚠️ generate-archived-rules: unexpected error:", err?.message || err);
  }

  try {
    fs.writeFileSync(outputPath, JSON.stringify(slugs));
  } catch (err) {
    console.warn("⚠️ generate-archived-rules: failed to write archived-rules.json:", err?.message || err);
  }
})();
