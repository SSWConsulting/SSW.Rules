/**
 * Migrate Authors to Slugs
 *
 * This script migrates existing rule files from the legacy author format
 * (objects with title/url) to the new slug-based format.
 *
 * Usage: node scripts/migrate-authors-to-slugs.js [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Show what would change without modifying files
 *   --verbose   Show detailed output for each file
 *
 * Environment Variables:
 *   LOCAL_CONTENT_RELATIVE_PATH - Path to the content repository
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERBOSE = args.includes("--verbose");

// Statistics
const stats = {
  totalRules: 0,
  rulesWithAuthors: 0,
  rulesMigrated: 0,
  rulesAlreadyMigrated: 0,
  authorsConverted: 0,
  authorsNotMapped: 0,
  errors: 0,
};

// Track unmapped authors for reporting
const unmappedAuthors = new Set();

/**
 * Load the people index for slug lookup
 */
function loadPeopleIndex() {
  const indexPath = path.resolve(__dirname, "..", "people-index.json");

  if (!fs.existsSync(indexPath)) {
    console.warn("⚠️  people-index.json not found. Run 'npm run generate:people' first.");
    console.warn("   Continuing without slug validation...\n");
    return null;
  }

  const content = fs.readFileSync(indexPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Extract slug from a legacy author URL
 */
function extractSlugFromUrl(url) {
  if (!url) return null;

  // SSW People URL: https://ssw.com.au/people/bob-northwind
  if (url.includes("ssw.com.au/people/")) {
    const match = url.match(/people\/([^/?#]+)/);
    return match ? match[1].toLowerCase() : null;
  }

  // GitHub URL: https://github.com/username
  if (url.includes("github.com/")) {
    const username = url.split("github.com/").pop()?.split("/")[0];
    return username ? `gh-${username.toLowerCase()}` : null;
  }

  return null;
}

/**
 * Convert a legacy author object to a slug
 */
function convertAuthorToSlug(author, peopleIndex) {
  if (typeof author === "string") {
    // Already a slug
    return { slug: author, wasConverted: false };
  }

  if (!author || typeof author !== "object") {
    return { slug: null, wasConverted: false };
  }

  // Try to extract slug from URL
  const urlSlug = extractSlugFromUrl(author.url);

  if (urlSlug) {
    // Validate against people index if available
    if (peopleIndex && !peopleIndex[urlSlug] && !urlSlug.startsWith("gh-")) {
      unmappedAuthors.add(`${author.title || "Unknown"} (${author.url})`);
      stats.authorsNotMapped++;
    }
    stats.authorsConverted++;
    return { slug: urlSlug, wasConverted: true };
  }

  // Can't extract slug - try to derive from title
  if (author.title) {
    const derivedSlug = author.title
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (derivedSlug) {
      unmappedAuthors.add(`${author.title} (no URL, derived slug: ${derivedSlug})`);
      stats.authorsNotMapped++;
      stats.authorsConverted++;
      return { slug: derivedSlug, wasConverted: true };
    }
  }

  // Can't convert
  unmappedAuthors.add(`${author.title || "Unknown"} (${author.url || "no URL"})`);
  stats.authorsNotMapped++;
  return { slug: null, wasConverted: false };
}

/**
 * Check if authors are already in slug format
 */
function isAlreadyMigrated(authors) {
  if (!authors || !Array.isArray(authors) || authors.length === 0) {
    return false;
  }

  // If all items are strings, it's already migrated
  return authors.every((a) => typeof a === "string" || a === null);
}

/**
 * Migrate a single rule file
 */
function migrateRuleFile(filePath, peopleIndex) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data: frontmatter, content: body } = matter(content);

    stats.totalRules++;

    // Check if this rule has authors
    if (!frontmatter.authors || !Array.isArray(frontmatter.authors) || frontmatter.authors.length === 0) {
      if (VERBOSE) {
        console.log(`  ⏭️  ${path.basename(path.dirname(filePath))}: No authors`);
      }
      return false;
    }

    stats.rulesWithAuthors++;

    // Check if already migrated
    if (isAlreadyMigrated(frontmatter.authors)) {
      stats.rulesAlreadyMigrated++;
      if (VERBOSE) {
        console.log(`  ✅ ${path.basename(path.dirname(filePath))}: Already migrated`);
      }
      return false;
    }

    // Convert authors to slugs
    const newAuthors = frontmatter.authors
      .map((author) => convertAuthorToSlug(author, peopleIndex))
      .filter((result) => result.slug !== null)
      .map((result) => result.slug);

    if (newAuthors.length === 0) {
      if (VERBOSE) {
        console.log(`  ⚠️  ${path.basename(path.dirname(filePath))}: Could not convert any authors`);
      }
      return false;
    }

    // Update frontmatter
    const newFrontmatter = { ...frontmatter, authors: newAuthors };

    // Reconstruct file content
    const newContent = matter.stringify(body, newFrontmatter);

    if (DRY_RUN) {
      console.log(`  📝 ${path.basename(path.dirname(filePath))}: Would migrate ${frontmatter.authors.length} authors → [${newAuthors.join(", ")}]`);
    } else {
      fs.writeFileSync(filePath, newContent);
      if (VERBOSE) {
        console.log(`  ✏️  ${path.basename(path.dirname(filePath))}: Migrated ${frontmatter.authors.length} authors → [${newAuthors.join(", ")}]`);
      }
    }

    stats.rulesMigrated++;
    return true;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}: ${error.message}`);
    stats.errors++;
    return false;
  }
}

/**
 * Find all rule.mdx files in the content directory
 */
function findRuleFiles(rulesDir) {
  const files = [];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name === "rule.mdx" || entry.name === "rule.md") {
        files.push(fullPath);
      }
    }
  }

  scanDir(rulesDir);
  return files;
}

/**
 * Main migration function
 */
async function migrate() {
  console.log("🚀 Author Migration Script");
  console.log("==========================");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE"}`);
  console.log(`   Verbose: ${VERBOSE ? "Yes" : "No"}`);
  console.log("");

  // Determine rules directory
  const relPath = process.env.LOCAL_CONTENT_RELATIVE_PATH;
  let rulesDir;

  if (relPath) {
    rulesDir = path.resolve(__dirname, relPath, "public/uploads/rules");
  } else {
    rulesDir = path.resolve(__dirname, "..", "public/uploads/rules");
  }

  if (!fs.existsSync(rulesDir)) {
    console.error(`❌ Rules directory not found: ${rulesDir}`);
    console.error("   Set LOCAL_CONTENT_RELATIVE_PATH or ensure the rules directory exists.");
    process.exit(1);
  }

  console.log(`📁 Rules directory: ${rulesDir}`);

  // Load people index for validation
  const peopleIndex = loadPeopleIndex();
  if (peopleIndex) {
    console.log(`👥 People index loaded: ${Object.keys(peopleIndex).length} people`);
  }
  console.log("");

  // Find all rule files
  console.log("🔍 Scanning for rule files...");
  const ruleFiles = findRuleFiles(rulesDir);
  console.log(`   Found ${ruleFiles.length} rule files\n`);

  // Migrate each file
  console.log("📝 Processing rules...");
  for (const filePath of ruleFiles) {
    migrateRuleFile(filePath, peopleIndex);
  }

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Migration Summary");
  console.log("=".repeat(50));
  console.log(`   Total rules scanned:    ${stats.totalRules}`);
  console.log(`   Rules with authors:     ${stats.rulesWithAuthors}`);
  console.log(`   Already migrated:       ${stats.rulesAlreadyMigrated}`);
  console.log(`   ${DRY_RUN ? "Would migrate" : "Migrated"}:          ${stats.rulesMigrated}`);
  console.log(`   Authors converted:      ${stats.authorsConverted}`);
  console.log(`   Authors not in index:   ${stats.authorsNotMapped}`);
  console.log(`   Errors:                 ${stats.errors}`);

  if (unmappedAuthors.size > 0) {
    console.log("\n⚠️  Authors not found in people index:");
    for (const author of unmappedAuthors) {
      console.log(`   - ${author}`);
    }
    console.log("\n   These authors may need to be added to the People repository,");
    console.log("   or their URLs may be incorrect in the rule files.");
  }

  if (DRY_RUN) {
    console.log("\n📌 This was a DRY RUN. No files were modified.");
    console.log("   Run without --dry-run to apply changes.");
  } else {
    console.log("\n✅ Migration complete!");
  }
}

// Run migration
migrate().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
