import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import 'dotenv/config';

const copyAndMoveJsonFile = (fileName, scriptsPath, destDir) => {
  const output = join(scriptsPath, fileName);
  const dest = join(destDir, fileName);

  if (!fs.existsSync(output)) {
    console.error(`Expected file not found: ${output}`);
    process.exit(1);
  }

  fs.copyFileSync(output, dest);
  console.log(`Copied ${fileName} to ${dest}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Preparing content for build...');

// Hardcoded for now - can be moved to env vars later
const contentRepoUrl = 'https://github.com/SSWConsulting/SSW.Rules.Content.git';
const contentBranch = process.env.NEXT_PUBLIC_TINA_BRANCH || 'tina/migration-dev-content';

console.log(`Cloning content repo: ${contentRepoUrl} (branch: ${contentBranch})`);

const tempDir = join('/tmp', 'content-repo');
const repoUrl = contentRepoUrl;

try {
  // Clean up any existing temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }

  // Clone the content repo
  execSync(
    `git clone --depth 1 --branch ${contentBranch} "${repoUrl}" "${tempDir}"`,
    { stdio: 'inherit' }
  );

} catch (error) {
  console.error(`Failed to clone branch ${contentBranch}:`, error.message);
  process.exit(1);
}

const scriptsPath = join(tempDir, 'scripts/tina-migration');
const buildMapScript = join(scriptsPath, 'build-rule-category-map.py');
const orphanedCheckScript = join(scriptsPath, 'orphaned_rules_check.py');
const buildRedirectMapScript = join(scriptsPath, 'build-redirect-map.py');

// Verify the scripts directory and Python scripts exist
if (!fs.existsSync(scriptsPath)) {
  console.error(`Scripts directory not found: ${scriptsPath}`);
  process.exit(1);
}

if (!fs.existsSync(buildMapScript)) {
  console.error(`Python script not found: ${buildMapScript}`);
  process.exit(1);
}

if (!fs.existsSync(orphanedCheckScript)) {
  console.error(`Python script not found: ${orphanedCheckScript}`);
  process.exit(1);
}

if (!fs.existsSync(buildRedirectMapScript)) {
  console.error(`Python script not found: ${buildRedirectMapScript}`);
  process.exit(1);
}

console.log(`Running Python script: ${buildMapScript}`);

// Run the Python scripts
try {
  execSync(`python3 "${buildMapScript}"`, { stdio: 'inherit', cwd: scriptsPath });
  execSync(`python3 "${orphanedCheckScript}"`, { stdio: 'inherit', cwd: scriptsPath });
  execSync(`python3 "${buildRedirectMapScript}"`, { stdio: 'inherit', cwd: scriptsPath });
} catch (error) {
  console.error('Python script execution failed:', error.message);
  process.exit(1);
}

// Copy the generated JSON files to the website root
const destDir = process.cwd();
copyAndMoveJsonFile("category-uri-title-map.json", scriptsPath, destDir);
copyAndMoveJsonFile("rule-to-categories.json", scriptsPath, destDir);
copyAndMoveJsonFile("orphaned_rules.json", scriptsPath, destDir);
copyAndMoveJsonFile("redirects.json", scriptsPath, destDir);

console.log('Content preparation completed successfully!');