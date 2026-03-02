/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const matter = require("gray-matter");

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
const outputPath = path.join(projectRoot, "public", "people-latest-rules.json");

const ONLY_USER = (process.env.PEOPLE_LATEST_RULES_ONLY_USER || "").trim().toLowerCase();

const LOCAL_CONTENT_RELATIVE_PATH = process.env.LOCAL_CONTENT_RELATIVE_PATH || path.join("..", "SSW.Rules.Content");
let CONTENT_REPO_PATH = path.resolve(projectRoot, LOCAL_CONTENT_RELATIVE_PATH);
const GIT_MAX_COMMITS = Number(process.env.PEOPLE_LATEST_RULES_GIT_MAX_COMMITS) || 100000;

const MAX_RULES_PER_USER = 5;

function isGitRepo(repoPath) {
  return Boolean(repoPath) && fs.existsSync(repoPath) && fs.existsSync(path.join(repoPath, ".git"));
}

function resolveContentRepoPath() {
  const initialPath = CONTENT_REPO_PATH;
  const candidates = [initialPath, path.resolve(projectRoot, "..", "SSW.Rules.Content"), path.resolve(projectRoot, "..", "..", "SSW.Rules.Content")].filter(
    Boolean
  );

  for (const p of candidates) {
    if (isGitRepo(p)) {
      return p;
    }
  }

  throw new Error(`Content repo not found (or missing .git): ${initialPath}. Tried: ${candidates.join(", ")}`);
}

function extractUsernameFromUrl(url) {
  if (!url) return null;
  const trimmed = String(url).trim();

  try {
    if (trimmed.toLowerCase().startsWith("http")) {
      const u = new URL(trimmed);
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length > 0) return segments[0].replace(/^@/, "");
    }
  } catch {
    // Ignore URL parsing errors and try regex-based cleanup
  }

  const cleaned = trimmed
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/^\//, "");

  const username = cleaned.split("/")[0].trim();
  return username || null;
}

function ruleUriFromPath(filePath) {
  if (!filePath) return null;

  const normalized = String(filePath)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");

  // Only count rule file edits.
  const m = normalized.match(/^(?:public\/uploads\/rules|rules)\/(.+)\/rule\.mdx?$/);
  if (!m) return null;

  const uri = m[1];
  return uri || null;
}

function pruneToTopN(map, n) {
  if (map.size <= n) return;
  const entries = Array.from(map.entries()).sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime());
  map.clear();
  for (const [k, v] of entries.slice(0, n)) {
    map.set(k, v);
  }
}

function extractLikelyLoginFromEmail(email) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  const at = e.indexOf("@");
  if (at <= 0) return null;
  let local = e.substring(0, at);
  // GitHub noreply pattern: 12345+login@users.noreply.github.com
  if (e.endsWith("@users.noreply.github.com") && local.includes("+")) {
    local = local.split("+").pop();
  }
  return local || null;
}

function extractCoauthorsFromMessage(message) {
  const coauthors = [];
  const text = String(message || "");
  const trailerRe = /^co-authored-by:\s*(.+?)(?:\s*<([^>]+)>)?\s*$/gim;
  let m;
  while ((m = trailerRe.exec(text))) {
    const name = (m[1] || "").trim();
    const email = (m[2] || "").trim();
    coauthors.push({ name, email: email || null });
  }
  return coauthors;
}

// ---------------- Name fallback mapping (CRM fullname/nickname) ----------------

function normalizePersonName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "") // remove [SSW] etc
    .replace(/[^a-z\s'-]/g, " ") // keep ASCII letters + spaces + common punct (adjust if needed)
    .replace(/\s+/g, " ")
    .trim();
}

// Build normalized-name -> login mapping; disable ambiguous (conflicting) names
function buildNameToLogin(users) {
  const nameToLogin = new Map();
  const ambiguousNames = new Set();

  function add(name, loginLower) {
    const key = normalizePersonName(name);
    if (!key) return;

    const existing = nameToLogin.get(key);
    if (existing && existing !== loginLower) {
      ambiguousNames.add(key);
      nameToLogin.delete(key);
      return;
    }

    if (!ambiguousNames.has(key)) {
      nameToLogin.set(key, loginLower);
    }
  }

  for (const u of users || []) {
    const login = extractUsernameFromUrl(u?.ssw_githuburl);
    if (!login) continue;
    const l = login.toLowerCase();

    add(u?.fullname, l);
    add(u?.nickname, l);
  }

  return { nameToLogin, ambiguousNames };
}

function resolveLoginFromName(name, nameToLogin, ambiguousNames) {
  const key = normalizePersonName(name);
  if (!key) return null;
  if (ambiguousNames?.has?.(key)) return null;
  return nameToLogin?.get?.(key) || null;
}

// ---------------- Email -> login resolve (prefer CRM map) ----------------

function resolveLoginFromEmailOrMap(email, emailToLogin) {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  if (!e) return null;

  // Prefer CRM mapping first
  if (emailToLogin && typeof emailToLogin.get === "function") {
    const mapped = emailToLogin.get(e);
    if (mapped) return mapped;
  }

  // Fallback: infer from email patterns (noreply, local-part)
  const inferred = extractLikelyLoginFromEmail(e);
  return inferred || null;
}

// ---------------- Git log scan (single pass) ----------------

async function buildLatestRulesForUsersFromGitLog(activeLogins, emailToLogin, nameToLogin, ambiguousNames) {
  const active = new Set(activeLogins.map((l) => String(l).toLowerCase()));
  const perUser = new Map();
  for (const l of active) perUser.set(l, new Map());

  CONTENT_REPO_PATH = resolveContentRepoPath();

  const COMMIT_MARK = "<<<COMMIT>>>";
  const END_MARK = "<<<END_COMMIT>>>";

  const args = [
    "-C",
    CONTENT_REPO_PATH,
    "log",
    "-n",
    String(GIT_MAX_COMMITS),
    "--date=iso-strict",
    "--name-only",
    // NOTE: added %an (author name) for name fallback mapping
    `--pretty=format:${COMMIT_MARK}%n%H%n%aI%n%ae%n%an%n%B%n${END_MARK}`,
    "--",
    "rules",
    "public/uploads/rules",
  ];

  const git = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });

  git.stderr.on("data", (d) => {
    const msg = String(d || "").trim();
    if (msg) console.warn("⚠️ generate-people-latest-rules: git log stderr:", msg);
  });

  const rl = readline.createInterface({ input: git.stdout, crlfDelay: Infinity });

  let state = "seek";
  let sha = "";
  let date = "";
  let authorEmail = "";
  let authorName = "";
  let messageLines = [];
  let filePaths = [];

  function resolveParticipantLogin({ email, name }) {
    // 1) email -> CRM map (authoritative)
    const fromMap = resolveLoginFromEmailOrMap(email, emailToLogin);
    if (fromMap && active.has(fromMap)) return fromMap;

    // 2) email infer (local-part / noreply) — accept only if it matches an active login
    const inferred = extractLikelyLoginFromEmail(email);
    if (inferred && active.has(inferred)) return inferred;

    // 3) name -> CRM name map (strict)
    const fromName = resolveLoginFromName(name, nameToLogin, ambiguousNames);
    if (fromName && active.has(fromName)) return fromName;

    return null;
  }

  function flushCommit() {
    if (!sha || !date) return;

    const participants = new Set();

    // author: email -> login, else name fallback
    const authorLogin = resolveParticipantLogin({ email: authorEmail, name: authorName });
    if (authorLogin) participants.add(authorLogin);

    const msg = messageLines.join("\n");
    for (const ca of extractCoauthorsFromMessage(msg)) {
      // co-author: email -> login, else name fallback
      const login = resolveParticipantLogin({ email: ca.email, name: ca.name });
      if (login) participants.add(login);

      // Optional: only treat co-author name as github login if it looks like one (no spaces etc)
      const loginLike = String(ca.name || "")
        .trim()
        .toLowerCase()
        .replace(/^@/, "");
      if (loginLike && /^[a-z0-9-]+$/.test(loginLike)) {
        participants.add(loginLike);
      }
    }

    if (participants.size === 0 || filePaths.length === 0) return;

    const touchedUris = new Set();
    for (const fp of filePaths) {
      const uri = ruleUriFromPath(fp);
      if (uri) touchedUris.add(uri);
    }
    if (touchedUris.size === 0) return;

    for (const login of participants) {
      if (!active.has(login)) continue;

      const map = perUser.get(login);
      if (!map) continue;

      for (const uri of touchedUris) {
        const existing = map.get(uri);
        if (!existing || new Date(date) > new Date(existing)) {
          map.set(uri, date);
        }
      }
      pruneToTopN(map, MAX_RULES_PER_USER);
    }
  }

  for await (const lineRaw of rl) {
    const line = String(lineRaw);

    if (line === COMMIT_MARK) {
      flushCommit();
      state = "sha";
      sha = "";
      date = "";
      authorEmail = "";
      authorName = "";
      messageLines = [];
      filePaths = [];
      continue;
    }

    if (state === "sha") {
      sha = line.trim();
      state = "date";
      continue;
    }

    if (state === "date") {
      date = line.trim();
      state = "authorEmail";
      continue;
    }

    if (state === "authorEmail") {
      authorEmail = line.trim();
      state = "authorName";
      continue;
    }

    if (state === "authorName") {
      authorName = line.trim();
      state = "message";
      continue;
    }

    if (state === "message") {
      if (line === END_MARK) {
        state = "files";
      } else {
        messageLines.push(line);
      }
      continue;
    }

    if (state === "files") {
      // files are until next COMMIT_MARK; blank lines can be ignored
      if (line.trim()) filePaths.push(line.trim());
      continue;
    }
  }

  flushCommit();

  const exitCode = await new Promise((resolve) => git.on("close", resolve));
  if (exitCode !== 0) {
    throw new Error(`git log failed with exit code ${exitCode}`);
  }

  // Convert to per-user items array
  const perUserItems = new Map();
  for (const login of activeLogins) {
    const l = String(login).toLowerCase();
    const map = perUser.get(l) || new Map();
    const items = Array.from(map.entries())
      .map(([uri, lastModifiedAt]) => ({ uri, lastModifiedAt: lastModifiedAt || null }))
      .sort((a, b) => {
        const dateA = a.lastModifiedAt ? new Date(a.lastModifiedAt).getTime() : 0;
        const dateB = b.lastModifiedAt ? new Date(b.lastModifiedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, MAX_RULES_PER_USER);

    perUserItems.set(l, items);
  }

  return perUserItems;
}

// ---------------- Rule title extraction (local content) ----------------

function getRuleTitleFromContent(uri) {
  const candidates = [
    path.join(CONTENT_REPO_PATH, "rules", uri, "rule.mdx"),
    path.join(CONTENT_REPO_PATH, "rules", uri, "rule.md"),
    path.join(CONTENT_REPO_PATH, "public", "uploads", "rules", uri, "rule.mdx"),
    path.join(CONTENT_REPO_PATH, "public", "uploads", "rules", uri, "rule.md"),
  ];

  let filePath = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      filePath = c;
      break;
    }
  }
  if (!filePath) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    const title = parsed?.data?.title;
    if (typeof title === "string" && title.trim()) return title.trim();

    const firstHeading = String(parsed?.content || raw)
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith("# "));
    if (firstHeading) return firstHeading.replace(/^#\s+/, "").trim();
  } catch {
    return null;
  }

  return null;
}

async function fetchRuleTitlesFromContent(uris) {
  const titleMap = new Map();
  for (const uri of uris) {
    const title = getRuleTitleFromContent(uri);
    if (title) titleMap.set(uri, title);
  }
  return titleMap;
}

// ---------------- Tina (kept as-is; not used in main flow) ----------------

function getCandidateTinaUrls() {
  const getBranch = () => process.env.NEXT_PUBLIC_TINA_BRANCH || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || process.env.HEAD || "main";

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
}

async function tinaRequest(url, token, query, variables) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-API-KEY"] = token;

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
    throw new Error(
      json.errors
        .map((e) => e?.message)
        .filter(Boolean)
        .join("\n") || "GraphQL error"
    );
  }

  return json?.data;
}

const RULES_BY_URI_QUERY = `query rulesByUriQuery($uris: [String!]!) {
  ruleConnection(filter: { uri: { in: $uris } }, first: 100) {
    edges {
      node {
        title
        uri
      }
    }
  }
}`;

async function fetchRuleTitlesByUri(uris) {
  const token = (process.env.TINA_TOKEN || "").trim();
  const urls = getCandidateTinaUrls();
  const titleMap = new Map();

  if (urls.length === 0) {
    console.warn("⚠️ generate-people-latest-rules: Missing NEXT_PUBLIC_TINA_CLIENT_ID/branch; titles will fallback to uri");
    return titleMap;
  }

  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    let data = null;

    for (const url of urls) {
      try {
        data = await tinaRequest(url, token, RULES_BY_URI_QUERY, { uris: chunk });
        break;
      } catch (err) {
        console.warn(`⚠️ generate-people-latest-rules: rulesByUriQuery failed against ${url}:`, err?.message || err);
      }
    }

    const edges = data?.ruleConnection?.edges || [];
    for (const e of edges) {
      const node = e?.node;
      if (node?.uri && typeof node?.title === "string") {
        titleMap.set(node.uri, node.title);
      }
    }
  }

  return titleMap;
}

// ---------------- Dynamics (CRM) active users ----------------

async function fetchCrmToken() {
  const tenantId = process.env.CRM_TENANT_ID;
  const appId = process.env.CRM_APP_ID;
  const appSecret = process.env.CRM_APP_SECRET;
  const scope = process.env.CRM_SCOPE;

  if (!tenantId || !appId || !appSecret || !scope) {
    throw new Error("Missing Dynamics CRM environment variables (CRM_TENANT_ID, CRM_APP_ID, CRM_APP_SECRET, CRM_SCOPE)");
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const formBody = new URLSearchParams();
  formBody.set("grant_type", "client_credentials");
  formBody.set("client_id", appId);
  formBody.set("client_secret", appSecret);
  formBody.set("scope", scope);

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Dynamics token request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchActiveGitHubLoginsFromCrm() {
  const tenant = process.env.CRM_TENANT;
  const viewCurrent = process.env.CRM_VIEW_CURRENT;

  if (!tenant || !viewCurrent) {
    console.warn("⚠️ generate-people-latest-rules: Missing CRM_TENANT and/or CRM_VIEW_CURRENT; writing empty people-latest-rules.json");
    return { activeLogins: [], emailToLogin: new Map(), nameToLogin: new Map(), ambiguousNames: new Set() };
  }

  let token;
  try {
    token = await fetchCrmToken();
  } catch (err) {
    console.warn("⚠️ generate-people-latest-rules: Unable to get CRM token; writing empty people-latest-rules.json:", err?.message || err);
    return { activeLogins: [], emailToLogin: new Map(), nameToLogin: new Map(), ambiguousNames: new Set() };
  }

  const baseUrl = `https://${tenant}/api/data/v9.1`;
  const urlBase = `${baseUrl}/systemusers?savedQuery=${encodeURIComponent(viewCurrent)}`;
  const urlCandidates = [`${urlBase}&$select=ssw_githuburl,internalemailaddress,fullname,nickname`, urlBase];

  let json = null;
  let lastStatus = 0;
  let lastText = "";

  for (const candidateUrl of urlCandidates) {
    const res = await fetch(candidateUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        Prefer: "odata.include-annotations=OData.Community.Display.V1.FormattedValue",
      },
    });

    if (res.ok) {
      json = await res.json();
      break;
    }

    lastStatus = res.status;
    lastText = await res.text().catch(() => "");

    if (candidateUrl !== urlBase) {
      console.warn(`⚠️ generate-people-latest-rules: CRM request failed (${res.status}); retrying without $select...`);
    }
  }

  if (!json) {
    console.warn(`⚠️ generate-people-latest-rules: CRM request failed (${lastStatus}); writing empty people-latest-rules.json: ${lastText.slice(0, 500)}`);
    return { activeLogins: [], emailToLogin: new Map(), nameToLogin: new Map(), ambiguousNames: new Set() };
  }

  const users = Array.isArray(json?.value) ? json.value : [];

  const logins = new Set();
  const emailToLogin = new Map();
  for (const u of users) {
    const ghUrl = u?.ssw_githuburl;
    const login = extractUsernameFromUrl(ghUrl);
    if (!login) continue;

    const l = login.toLowerCase();
    logins.add(l);

    const internalEmail = String(u?.internalemailaddress || "")
      .trim()
      .toLowerCase();
    if (internalEmail) emailToLogin.set(internalEmail, l);
  }

  const { nameToLogin, ambiguousNames } = buildNameToLogin(users);

  return { activeLogins: Array.from(logins), emailToLogin, nameToLogin, ambiguousNames };
}

// ---------------- Output helpers ----------------

function toUserFacingOutput(activeLogins, perUserItems, titleMap) {
  const out = {};

  for (const login of activeLogins) {
    const items = perUserItems.get(login) || [];
    out[login] = items
      .map((i) => ({
        title: titleMap.get(i.uri) || i.uri,
        uri: i.uri,
        lastModifiedAt: i.lastModifiedAt || null,
      }))
      .slice(0, MAX_RULES_PER_USER);
  }

  return out;
}

function writeJsonFile(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj));
}

// ---------------- Main ----------------

(async () => {
  let activeLogins = [];
  let emailToLogin = new Map();
  let nameToLogin = new Map();
  let ambiguousNames = new Set();

  try {
    const crm = await fetchActiveGitHubLoginsFromCrm();
    activeLogins = crm.activeLogins;
    emailToLogin = crm.emailToLogin;
    nameToLogin = crm.nameToLogin;
    ambiguousNames = crm.ambiguousNames;

    if (ONLY_USER) {
      activeLogins = activeLogins.filter((l) => l === ONLY_USER);
      console.log(`📋 generate-people-latest-rules: ONLY_USER=${ONLY_USER} (filtered to ${activeLogins.length} user)`);
    } else {
      console.log(`📋 generate-people-latest-rules: found ${activeLogins.length} active CRM users with GitHub logins`);
    }
  } catch (err) {
    console.warn("⚠️ generate-people-latest-rules: failed to load active users; writing empty people-latest-rules.json:", err?.message || err);
    writeJsonFile(outputPath, {});
    return;
  }

  if (activeLogins.length === 0) {
    writeJsonFile(outputPath, {});
    return;
  }

  let perUserItems;
  try {
    perUserItems = await buildLatestRulesForUsersFromGitLog(activeLogins, emailToLogin, nameToLogin, ambiguousNames);
  } catch (err) {
    console.warn("⚠️ generate-people-latest-rules: failed to scan git history; writing empty people-latest-rules.json:", err?.message || err);
    writeJsonFile(outputPath, {});
    return;
  }

  const allUris = new Set();
  for (const login of activeLogins) {
    const items = perUserItems.get(login) || [];
    for (const item of items) {
      if (item?.uri) allUris.add(item.uri);
    }
  }

  let titleMap = new Map();
  try {
    titleMap = await fetchRuleTitlesFromContent(Array.from(allUris));
  } catch (err) {
    console.warn("⚠️ generate-people-latest-rules: failed to read titles from Content repo; titles will fallback to uri:", err?.message || err);
  }

  const output = toUserFacingOutput(activeLogins, perUserItems, titleMap);
  writeJsonFile(outputPath, output);

  console.log(`✅ generate-people-latest-rules: wrote ${outputPath}`);
})();
