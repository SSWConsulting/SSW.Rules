/**
 * Generate People Index and Content Files
 *
 * Fetches People markdown files from the SSW.People.Profiles GitHub repository
 * and generates:
 * 1. people-index.json - Quick lookup index
 * 2. public/uploads/people/*.mdx - TinaCMS-compatible people files for references
 *
 * Usage: node scripts/generate-people-index.js
 *
 * Environment Variables:
 *   GITHUB_TOKEN - GitHub personal access token (optional, increases rate limit)
 *   PEOPLE_REPO - Override the repo (default: SSWConsulting/SSW.People.Profiles)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PEOPLE_REPO = process.env.PEOPLE_REPO || "SSWConsulting/SSW.People.Profiles";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.NEXT_PUBLIC_GITHUB_TOKEN;
const GITHUB_API_BASE = "https://api.github.com";
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com";
const SSW_PEOPLE_URL_BASE = "https://ssw.com.au/people";

// Output directories
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PEOPLE_OUTPUT_DIR = path.join(PROJECT_ROOT, "public/uploads/people");

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
 * Get the SSW People profile URL for a person
 */
function getProfileUrl(slug) {
  return `${SSW_PEOPLE_URL_BASE}/${slug}`;
}

/**
 * Fetch the list of people directories from the repo
 */
async function fetchPeopleDirectories() {
  console.log(`📁 Fetching directory listing from ${PEOPLE_REPO}...`);

  const url = `${GITHUB_API_BASE}/repos/${PEOPLE_REPO}/contents`;
  const contents = await fetchGitHub(url);

  const directories = contents.filter(
    (item) => item.type === "dir" && !item.name.startsWith(".") && !item.name.startsWith("_")
  );

  console.log(`   Found ${directories.length} people directories`);
  return directories;
}

/**
 * Find and fetch the markdown file for a person
 */
async function fetchPersonMarkdown(folderName) {
  const possibleFiles = [
    `${folderName}/${folderName}.md`,
    `${folderName}/${folderName}.mdx`,
    `${folderName}/index.md`,
    `${folderName}/index.mdx`,
  ];

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
 */
function parsePersonData(folderName, markdownContent) {
  try {
    const { data: frontmatter } = matter(markdownContent);

    const name =
      frontmatter.name ||
      frontmatter.title ||
      frontmatter.fullName ||
      frontmatter.displayName ||
      folderName.replace(/-/g, " ");

    const slug = nameToSlug(name);

    return {
      slug,
      name,
      folderName,
      role: frontmatter.role || frontmatter.jobTitle || frontmatter.position || null,
      location: frontmatter.location || frontmatter.office || null,
      profileUrl: getProfileUrl(slug),
      imageUrl: getImageUrl(folderName),
      email: frontmatter.email || null,
      github: frontmatter.github || frontmatter.githubUrl || null,
      linkedin: frontmatter.linkedin || frontmatter.linkedinUrl || null,
      twitter: frontmatter.twitter || frontmatter.twitterUrl || null,
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
    name: personData.name,
    slug: personData.slug,
    role: personData.role,
    location: personData.location,
    profileUrl: personData.profileUrl,
    imageUrl: personData.imageUrl,
  };

  // Remove null values
  Object.keys(frontmatter).forEach((key) => {
    if (frontmatter[key] === null) {
      delete frontmatter[key];
    }
  });

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
    const peopleIndex = {};
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
              // Add to index
              peopleIndex[personData.slug] = personData;

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

    // Write the JSON index file
    const indexPath = path.join(PROJECT_ROOT, "people-index.json");
    fs.writeFileSync(indexPath, JSON.stringify(peopleIndex, null, 2));

    console.log("✅ People Index Generation Complete!");
    console.log(`   Total people: ${Object.keys(peopleIndex).length}`);
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
