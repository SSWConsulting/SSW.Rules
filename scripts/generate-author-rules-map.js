const fs = require("node:fs");
const path = require("node:path");

const AUTHOR_INDEX_FILENAME = "author-title-to-rules-map.json";

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const current = argv[i];
    if (!current?.startsWith("--")) continue;

    const key = current.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith("--") ? next : "true";

    args[key] = value;
    if (value !== "true") i++;
  }
  return args;
};

const unquote = (value) => {
  const trimmed = String(value).trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const extractAuthorTitles = (rawMdx) => {
  const match = rawMdx.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return [];

  const frontmatter = match[1];
  const lines = frontmatter.split(/\r?\n/);

  let inAuthors = false;
  const titles = [];

  for (const line of lines) {
    if (!inAuthors) {
      if (line.trimEnd() === "authors:") {
        inAuthors = true;
      }
      continue;
    }

    // Stop when we hit a new top-level key
    if (/^[A-Za-z0-9_]+\s*:/.test(line) && !/^\s*-/.test(line)) {
      break;
    }

    const titleKvp = line.match(/^\s*-\s*title:\s*(.+?)\s*$/);
    if (titleKvp) {
      titles.push(unquote(titleKvp[1]));
      continue;
    }

    const titleInlineObj = line.match(/^\s*-\s*\{\s*title:\s*([^,}]+)[,}]/);
    if (titleInlineObj) {
      titles.push(unquote(titleInlineObj[1]));
      continue;
    }

    // Support string list items: - Bob Northwind
    const stringItem = line.match(/^\s*-\s*(.+?)\s*$/);
    if (stringItem && !stringItem[1].includes(":")) {
      titles.push(unquote(stringItem[1]));
    }
  }

  return titles.filter((t) => t.length > 0);
};

const listRuleFiles = (rulesDirAbs) => {
  const results = [];
  const stack = [{ abs: rulesDirAbs, relPosix: "" }];

  while (stack.length > 0) {
    const { abs, relPosix } = stack.pop();
    const entries = fs.readdirSync(abs, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nextAbs = path.join(abs, entry.name);
        const nextRelPosix = relPosix ? `${relPosix}/${entry.name}` : entry.name;
        stack.push({ abs: nextAbs, relPosix: nextRelPosix });
      } else if (entry.isFile() && entry.name === "rule.mdx") {
        results.push(relPosix ? `${relPosix}/rule.mdx` : "rule.mdx");
      }
    }
  }

  return results.sort();
};

const looksLikeContentRoot = (dir) => {
  if (!dir) return false;
  try {
    return fs.existsSync(path.join(dir, "public", "uploads", "rules"));
  } catch {
    return false;
  }
};

const resolveContentRoot = (args, repoRoot) => {
  const candidates = [];

  if (args.contentRoot) {
    candidates.push(path.resolve(args.contentRoot));
  }

  const rel = process.env.LOCAL_CONTENT_RELATIVE_PATH;
  if (rel) {
    // Support paths relative to either repo root or this scripts/ directory.
    candidates.push(path.resolve(__dirname, rel));
    candidates.push(path.resolve(repoRoot, rel));
  }

  // Common local/CI layouts
  candidates.push(path.join(repoRoot, "content"));
  candidates.push(path.join(repoRoot, "..", "SSW.Rules.Content"));

  const deduped = Array.from(new Set(candidates));
  for (const candidate of deduped) {
    if (looksLikeContentRoot(candidate)) return candidate;
  }

  console.error("Could not locate the content repo (missing LOCAL_CONTENT_RELATIVE_PATH and auto-detection failed).\n");
  console.error("Fix options:");
  console.error("  1) Set LOCAL_CONTENT_RELATIVE_PATH (e.g. ../SSW.Rules.Content or ./content)");
  console.error("  2) Or pass --contentRoot (e.g. pnpm run generate:author-rules -- --contentRoot ..\\SSW.Rules.Content)\n");
  console.error("Tried:");
  for (const candidate of deduped) {
    console.error(`  - ${candidate}`);
  }
  process.exit(1);
};

const main = () => {
  const args = parseArgs(process.argv);

  const repoRoot = path.resolve(__dirname, "..");
  const outFile = args.outFile ? path.resolve(args.outFile) : path.join(repoRoot, "public", AUTHOR_INDEX_FILENAME);

  const contentRoot = resolveContentRoot(args, repoRoot);

  const rulesDir = path.resolve(contentRoot, "public", "uploads", "rules");
  const ruleFiles = listRuleFiles(rulesDir);
  const index = {};

  for (const relativePathPosix of ruleFiles) {
    const absFile = path.join(rulesDir, ...relativePathPosix.split("/"));
    const raw = fs.readFileSync(absFile, "utf8");
    const titles = extractAuthorTitles(raw);

    for (const title of titles) {
      (index[title] ||= []).push(relativePathPosix);
    }
  }

  for (const [title, files] of Object.entries(index)) {
    index[title] = Array.from(new Set(files)).sort();
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Generated ${outFile} (${Object.keys(index).length} authors)`);
};

main();
