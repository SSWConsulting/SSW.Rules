import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import 'dotenv/config';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const relPath = process.env.LOCAL_CONTENT_RELATIVE_PATH;
if (!relPath) {
  console.error('Missing LOCAL_CONTENT_RELATIVE_PATH');
  process.exit(1);
}

const contentAbsPath = resolve(__dirname, relPath);
const scriptsPath = join(contentAbsPath, 'scripts/tina-migration');
const input = join(scriptsPath, 'build-rule-category-map.py');
const output = join(scriptsPath, 'rule-category-mapping.json');

const dest = resolve(__dirname, '../rule-category-mapping.json');

execSync(`python "${input}"`, { stdio: 'inherit', cwd: scriptsPath });

if (!fs.existsSync(output)) {
  console.error(`Expected file not found: ${output}`);
  process.exit(1);
}

fs.copyFileSync(output, dest);
