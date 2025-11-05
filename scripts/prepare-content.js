import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import 'dotenv/config';
import { execSync } from 'child_process';

const copyAndMoveJsonFile = (fileName, scriptsPath) => {
  const output = join(scriptsPath, fileName);
  const dest = resolve(__dirname, `../${fileName}`);

  if (!fs.existsSync(output)) {
    console.error(`Expected file not found: ${output}`);
    process.exit(1);
  }
  fs.copyFileSync(output, dest);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const relPath = process.env.LOCAL_CONTENT_RELATIVE_PATH;
if (!relPath) {
  console.error('Missing LOCAL_CONTENT_RELATIVE_PATH');
  process.exit(1);
}

const contentAbsPath = resolve(__dirname, relPath);
const scriptsPath = join(contentAbsPath, 'scripts/tina-migration');
const buildMapScript = join(scriptsPath, 'build-rule-category-map.py');
const orphanedCheckScript = join(scriptsPath, 'orphaned_rules_check.py');
const buildRedirectMapScript = join(scriptsPath, 'build-redirect-map.py');
const updateCategoriesJs = resolve(__dirname, './update-categories.js');
const rulesDirAbs = join(contentAbsPath, 'public/uploads/rules');

// Update categories via Node script in this repo
execSync(`node "${updateCategoriesJs}" "${rulesDirAbs}"`, { stdio: 'inherit' });

execSync(`python "${buildMapScript}"`, { stdio: 'inherit', cwd: scriptsPath });
execSync(`python "${orphanedCheckScript}"`, { stdio: 'inherit', cwd: scriptsPath });
execSync(`python "${buildRedirectMapScript}"`, { stdio: 'inherit', cwd: scriptsPath });

copyAndMoveJsonFile("category-uri-title-map.json", scriptsPath)
copyAndMoveJsonFile("rule-to-categories.json", scriptsPath)
copyAndMoveJsonFile("orphaned_rules.json", scriptsPath)
copyAndMoveJsonFile("redirects.json", scriptsPath)