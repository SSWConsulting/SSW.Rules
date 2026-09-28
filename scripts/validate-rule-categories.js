#!/usr/bin/env node
/**
 * Fails fast when a rule isn't properly categorized:
 * - a non-archived rule has no category (every rule needs one), or
 * - a rule's `categories` frontmatter points at a category file that doesn't exist.
 *
 * Tina throws "Unable to find record" on a missing category: the rule page silently falls back to
 * ClientFallbackPage and /archived aborts the Next.js export ~12 minutes into the Docker build,
 * without naming the rule. This check runs in seconds and names every offending rule.
 *
 * Usage: node scripts/validate-rule-categories.js <path-to-SSW.Rules.Content>
 */
const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");

const RULES_DIR = path.join("public", "uploads", "rules");
const CATEGORIES_DIR = "categories";

const toPosix = (p) => p.split(path.sep).join("/");

function listCategoryFiles(contentRoot) {
  const files = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".mdx")) files.add(toPosix(path.relative(contentRoot, full)));
    }
  };
  walk(path.join(contentRoot, CATEGORIES_DIR));
  return files;
}

function validateRuleCategories(contentRoot) {
  const categoryFiles = listCategoryFiles(contentRoot);
  const uncategorizedRules = [];
  const danglingReferences = [];

  for (const folder of fs.readdirSync(path.join(contentRoot, RULES_DIR)).sort()) {
    const ruleFile = toPosix(path.join(RULES_DIR, folder, "rule.mdx"));
    const fullPath = path.join(contentRoot, ruleFile);
    if (!fs.existsSync(fullPath)) continue;

    let frontmatter;
    try {
      frontmatter = matter(fs.readFileSync(fullPath, "utf8")).data;
    } catch (err) {
      throw new Error(`${ruleFile}: unable to parse frontmatter: ${err.message}`);
    }

    const categories = (Array.isArray(frontmatter.categories) ? frontmatter.categories : [])
      .map((entry) => entry?.category)
      .filter((category) => typeof category === "string" && category);

    // Archived rules are no longer listed in any category, so only live rules need one.
    // `isArchived` is what the site queries on, so it's the source of truth (not `archivedreason`).
    if (categories.length === 0 && frontmatter.isArchived !== true) {
      uncategorizedRules.push(ruleFile);
    }

    for (const category of categories) {
      if (!categoryFiles.has(category)) danglingReferences.push({ rule: ruleFile, category });
    }
  }

  return { uncategorizedRules, danglingReferences };
}

function formatReport({ uncategorizedRules, danglingReferences }) {
  const lines = [`❌ validate-rule-categories: ${uncategorizedRules.length + danglingReferences.length} rule category problem(s) in SSW.Rules.Content.`];

  if (uncategorizedRules.length > 0) {
    lines.push("", `  ${uncategorizedRules.length} rule(s) with no category:`, ...uncategorizedRules.map((r) => `    - ${r}`));
  }

  const byCategory = new Map();
  for (const { rule, category } of danglingReferences) {
    byCategory.set(category, [...(byCategory.get(category) ?? []), rule]);
  }
  for (const [category, rules] of byCategory) {
    lines.push("", `  Missing category: ${category}`, `  Referenced by ${rules.length} rule(s):`, ...rules.map((r) => `    - ${r}`));
  }

  lines.push(
    "",
    "Every rule must belong to at least one existing category.",
    "Fix: in SSW.Rules.Content, set the `categories` frontmatter of the rules above to an existing category",
    "(if a category was moved or renamed, use its current path), or archive the rule with `isArchived: true`."
  );
  return lines.join("\n");
}

function main() {
  const contentArg = process.argv[2];
  if (!contentArg) {
    console.error("Usage: node scripts/validate-rule-categories.js <path-to-SSW.Rules.Content>");
    process.exit(1);
  }

  const contentRoot = path.resolve(contentArg);
  if (!fs.existsSync(path.join(contentRoot, RULES_DIR)) || !fs.existsSync(path.join(contentRoot, CATEGORIES_DIR))) {
    console.error(`❌ validate-rule-categories: ${contentRoot} doesn't look like SSW.Rules.Content (missing ${RULES_DIR} or ${CATEGORIES_DIR})`);
    process.exit(1);
  }

  const result = validateRuleCategories(contentRoot);
  if (result.uncategorizedRules.length === 0 && result.danglingReferences.length === 0) {
    console.log("✅ validate-rule-categories: every rule belongs to an existing category");
    return;
  }

  console.error(formatReport(result));
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { validateRuleCategories };
