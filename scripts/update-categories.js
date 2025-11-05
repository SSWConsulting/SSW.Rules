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
const updateCategoriesScript = join(scriptsPath, 'convert-rule-md-to-mdx.py');

console.log(`Running category update script: ${updateCategoriesScript}`);

// Run the Python script with --update-categories flag
try {
  const rulesDir = process.argv[2] || 'public/uploads/rules';
  execSync(`python "${updateCategoriesScript}" --update-categories "${rulesDir}"`, { 
    stdio: 'inherit', 
    cwd: scriptsPath 
  });
  console.log('✅ Category update completed successfully');
} catch (error) {
  console.error('❌ Category update failed:', error.message);
  process.exit(1);
}
