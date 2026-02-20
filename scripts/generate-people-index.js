/**
 * Generate People Index and Content Files
 *
 * Fetches People markdown files from the SSW.People.Profiles GitHub repository
 * and generates:
 * 1. public/people-index.json - Quick lookup index
 * 2. public/uploads/people/*.mdx - TinaCMS-compatible people files for references
 *
 * Usage: node scripts/generate-people-index.js
 *
 * Environment Variables:
 *   GITHUB_TOKEN - GitHub personal access token (optional, increases rate limit)
 *   PEOPLE_REPO - Override the repo (default: SSWConsulting/SSW.People.Profiles)
 *   LOCAL_CONTENT_RELATIVE_PATH - Path to SSW.Rules.Content (used to compute popularity ordering)
 */

const fs = require("fs");
const fg = require("fast-glob");
const matter = require("gray-matter");
const dotenv = require("dotenv");
const path = require("path");

const PEOPLE_REPO = process.env.PEOPLE_REPO || "SSWConsulting/SSW.People.Profiles";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.NEXT_PUBLIC_GITHUB_TOKEN;
const GITHUB_API_BASE = "https://api.github.com";
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com";

// Output directories
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PEOPLE_OUTPUT_DIR = path.join(PROJECT_ROOT, "public/uploads/people");

// Node scripts don't automatically load Next.js .env files
dotenv.config({ path: path.join(PROJECT_ROOT, ".env.local") });
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

const RECENCY_WINDOW_MONTHS = 12;

function resolveContentRoot() {
  const relPath = process.env.LOCAL_CONTENT_RELATIVE_PATH?.trim();
  if (relPath) {
    // Match scripts/prepare-content.js behavior (relative to the scripts folder)
    const absPath = path.resolve(__dirname, relPath);
    if (fs.existsSync(absPath)) return absPath;
  }

  // CI (see .github/workflows/build-artifacts.yml)
  const ciPath = path.join(PROJECT_ROOT, "content-temp");
  if (fs.existsSync(ciPath)) return ciPath;

  // Common local sibling checkout
  const siblingPath = path.resolve(PROJECT_ROOT, "..", "SSW.Rules.Content");
  if (fs.existsSync(siblingPath)) return siblingPath;

  return null;
}

function extractAuthorSlugs(frontmatter) {
  const authors = Array.isArray(frontmatter?.authors) ? frontmatter.authors : [];
  const slugs = new Set();

  for (const author of authors) {
    if (typeof author === "string") {
      slugs.add(author);
      continue;
    }

    if (author && typeof author === "object") {
      // New Tina format: { author: "ash-anil" }
      if (typeof author.author === "string") slugs.add(author.author);
      if (typeof author.slug === "string") slugs.add(author.slug);

      // Legacy format: { title: "Ash Anil", url: "https://www.ssw.com.au/people/ash-anil" }
      if (typeof author.url === "string") {
        try {
          const u = new URL(author.url);
          const parts = u.pathname.split("/").filter(Boolean);
          const last = parts[parts.length - 1];
          if (last) slugs.add(last);
        } catch {
          // ignore invalid URL
        }
      }
      if (typeof author.title === "string") slugs.add(nameToSlug(author.title));
    }
  }

  return [...slugs];
}

function parseFrontmatterDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  // Fast path for ISO 8601
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.valueOf())) return direct;

  // Common Content formats:
  // - "2021-03-17 05:01:20.730000"
  // - "2013-06-24 07:41:13+00:00"
  let normalized = trimmed.replace(" ", "T");
  normalized = normalized.replace(/\.(\d{3})\d+/, ".$1");

  // If there's no timezone info, assume UTC for consistency
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) normalized = `${normalized}Z`;

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.valueOf())) return parsed;

  return null;
}

function computeSortWeights(contentRoot) {
  if (!contentRoot) return {};

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RECENCY_WINDOW_MONTHS);
  console.log(`📊 Sort weight window: last ${RECENCY_WINDOW_MONTHS} months (cutoff: ${cutoff.toISOString()})`);

  const candidateRoots = [
    path.join(contentRoot, "public", "uploads", "rules"),
    path.join(contentRoot, "public", "rules"),
    path.join(contentRoot, "rules"),
    contentRoot,
  ];

  const rulesRoot = candidateRoots.find((p) => fs.existsSync(p)) || contentRoot;

  const ruleFiles = fg.sync(["**/rule.mdx", "**/rule.md"], {
    cwd: rulesRoot,
    absolute: true,
    ignore: ["**/.git/**", "**/node_modules/**"],
  });

  console.log(`📊 Found ${ruleFiles.length} rule files under: ${rulesRoot}`);

  const sortWeights = {};

  for (const filePath of ruleFiles) {
    try {
      const file = fs.readFileSync(filePath, "utf8");
      const { data } = matter(file);

      if (data?.isArchived === true || data?.archived === true) continue;

      const activityRaw = data?.lastUpdated ?? data?.created ?? null;
      const activityDate = parseFrontmatterDate(activityRaw);
      const isRecent = activityDate instanceof Date && activityDate >= cutoff;
      if (!isRecent) continue;

      const authorSlugs = extractAuthorSlugs(data);
      for (const slug of authorSlugs) {
        sortWeights[slug] = (sortWeights[slug] || 0) + 1;
      }
    } catch {
      // ignore malformed files
    }
  }

  return sortWeights;
}

/**
 * Fetch with GitHub authentication if token is available
 */
async function fetchGitHub(url) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "SSW-Rules-People-Index-Generator",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch raw file content from GitHub
 */
async function fetchRawFile(filePath) {
  const url = `${RAW_GITHUB_BASE}/${PEOPLE_REPO}/main/${filePath}`;

  const headers = {
    "User-Agent": "SSW-Rules-People-Index-Generator",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    return null;
  }

  return response.text();
}

/**
 * Convert a name to a URL-friendly slug
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Convert folder name to properly capitalized format for image URLs
 */
function formatFolderName(folderName) {
  return folderName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
}

/**
 * Get the profile image URL for a person
 */
function getImageUrl(folderName) {
  const formattedName = formatFolderName(folderName);
  return `${RAW_GITHUB_BASE}/${PEOPLE_REPO}/main/${formattedName}/Images/${formattedName}-Profile.jpg`;
}

/**
 * Fetch the list of people directories from the repo
 */
async function fetchPeopleDirectories() {
  console.log(`📁 Fetching directory listing from ${PEOPLE_REPO}...`);

  const url = `${GITHUB_API_BASE}/repos/${PEOPLE_REPO}/contents`;
  const contents = await fetchGitHub(url);

  const directories = contents.filter((item) => item.type === "dir" && !item.name.startsWith(".") && !item.name.startsWith("_"));

  console.log(`   Found ${directories.length} people directories`);
  return directories;
}

/**
 * Find and fetch the markdown file for a person
 */
async function fetchPersonMarkdown(folderName) {
  const possibleFiles = [`${folderName}/${folderName}.md`, `${folderName}/${folderName}.mdx`, `${folderName}/index.md`, `${folderName}/index.mdx`];

  for (const filePath of possibleFiles) {
    const content = await fetchRawFile(filePath);
    if (content) {
      return { path: filePath, content };
    }
  }

  return null;
}

/**
 * Parse person data from markdown frontmatter
 * Only extracts essential fields: slug, name, imageUrl
 */
function parsePersonData(folderName, markdownContent) {
  try {
    const { data: frontmatter } = matter(markdownContent);

    const name = frontmatter.name || frontmatter.title || frontmatter.fullName || frontmatter.displayName || folderName.replace(/-/g, " ");

    const slug = nameToSlug(name);

    return {
      slug,
      name,
      imageUrl: getImageUrl(folderName),
    };
  } catch (error) {
    console.warn(`   ⚠️  Failed to parse frontmatter for ${folderName}: ${error.message}`);
    return null;
  }
}

/**
 * Generate a TinaCMS-compatible MDX file for a person
 */
function generatePersonMdx(personData) {
  const frontmatter = {
    slug: personData.slug,
    name: personData.name,
    imageUrl: personData.imageUrl,
  };

  return matter.stringify("", frontmatter);
}

/**
 * Ensure the people output directory exists and is clean
 */
function prepareOutputDirectory() {
  if (fs.existsSync(PEOPLE_OUTPUT_DIR)) {
    // Clean existing files
    const files = fs.readdirSync(PEOPLE_OUTPUT_DIR);
    for (const file of files) {
      if (file.endsWith(".mdx")) {
        fs.unlinkSync(path.join(PEOPLE_OUTPUT_DIR, file));
      }
    }
  } else {
    fs.mkdirSync(PEOPLE_OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Main function to generate the people index and content files
 */
async function generatePeopleIndex() {
  console.log("🚀 Starting People Index Generation");
  console.log(`   Repository: ${PEOPLE_REPO}`);
  console.log(`   Auth: ${GITHUB_TOKEN ? "Using token" : "No token (rate limited)"}`);
  console.log("");

  try {
    // Prepare output directory
    prepareOutputDirectory();
    console.log(`📂 Output directory: ${PEOPLE_OUTPUT_DIR}\n`);

    // Fetch all people directories
    const directories = await fetchPeopleDirectories();

    // Process each person
    console.log("\n👤 Processing people...");
    const people = [];
    let successCount = 0;
    let errorCount = 0;

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < directories.length; i += batchSize) {
      const batch = directories.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (dir) => {
          try {
            const markdown = await fetchPersonMarkdown(dir.name);

            if (!markdown) {
              console.log(`   ⚠️  No markdown found for ${dir.name}`);
              errorCount++;
              return;
            }

            const personData = parsePersonData(dir.name, markdown.content);

            if (personData) {
              people.push(personData);

              // Generate MDX file for TinaCMS
              const mdxContent = generatePersonMdx(personData);
              const mdxPath = path.join(PEOPLE_OUTPUT_DIR, `${personData.slug}.mdx`);
              fs.writeFileSync(mdxPath, mdxContent);

              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            console.warn(`   ❌ Error processing ${dir.name}: ${error.message}`);
            errorCount++;
          }
        })
      );

      // Progress indicator
      const progress = Math.min(i + batchSize, directories.length);
      process.stdout.write(`\r   Progress: ${progress}/${directories.length} people processed`);
    }

    console.log("\n");

    const contentRoot = resolveContentRoot();
    if (!contentRoot) {
      console.warn("⚠️  Could not locate SSW.Rules.Content; sortWeight will be 0 for all people.");
    } else {
      console.log(`📊 Computing sortWeight from: ${contentRoot}`);
    }

    const sortWeights = computeSortWeights(contentRoot);
    console.log(`📊 Sort weight scan complete. Matched ${Object.keys(sortWeights).length} author slugs.`);

    for (const person of people) {
      person.sortWeight = sortWeights[person.slug] || 0;
    }

    // Sort people by weight (desc) then name (asc)
    people.sort((a, b) => {
      const scoreB = b.sortWeight || 0;
      const scoreA = a.sortWeight || 0;
      return scoreB - scoreA || a.name.localeCompare(b.name);
    });

    // Build the JSON index in the sorted insertion order
    const peopleIndex = {};
    for (const person of people) {
      peopleIndex[person.slug] = person;
    }

    // Write the JSON index file
    const indexPath = path.join(PROJECT_ROOT, "public", "people-index.json");
    fs.writeFileSync(indexPath, JSON.stringify(peopleIndex, null, 2));

    console.log("✅ People Index Generation Complete!");
    console.log(`   Total people: ${people.length}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   JSON Index: ${indexPath}`);
    console.log(`   MDX Files: ${PEOPLE_OUTPUT_DIR}`);

    return peopleIndex;
  } catch (error) {
    console.error("❌ Failed to generate people index:", error);
    process.exit(1);
  }
}

// Run the generator
generatePeopleIndex();
