import fs from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { execSync } from "child_process";

function resolvePythonInvocation() {
  const configured = process.env.PYTHON_COMMAND?.trim();
  if (configured) {
    return { command: configured, note: "PYTHON_COMMAND" };
  }

  const candidates = ["py", "python", "python3"];

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: "ignore" });
      return { command: candidate, note: "auto-detected" };
    } catch {
      // try next
    }
  }

  console.error("Python was not found. Install python (or set PYTHON_COMMAND).");
  process.exit(1);
}

const copyAndMoveJsonFile = (fileName, scriptsPath) => {
  const output = join(scriptsPath, fileName);
  const dest = resolve(__dirname, `../${fileName}`);

  if (!fs.existsSync(output)) {
    console.error(`Expected file not found: ${output}`);
    process.exit(1);
  }
  fs.copyFileSync(output, dest);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const relPath = process.env.LOCAL_CONTENT_RELATIVE_PATH;
if (!relPath) {
  console.error("Missing LOCAL_CONTENT_RELATIVE_PATH");
  process.exit(1);
}

const contentAbsPath = resolve(__dirname, relPath);
const scriptsPath = join(contentAbsPath, "scripts/tina-migration");
const buildMapScript = join(scriptsPath, "build-rule-category-map.py");
const orphanedCheckScript = join(scriptsPath, "orphaned_rules_check.py");
const buildRedirectMapScript = join(scriptsPath, "build-redirect-map.py");

const { command: python } = resolvePythonInvocation();

execSync(`${python} "${buildMapScript}"`, { stdio: "inherit", cwd: scriptsPath });
execSync(`${python} "${orphanedCheckScript}"`, { stdio: "inherit", cwd: scriptsPath });
execSync(`${python} "${buildRedirectMapScript}"`, { stdio: "inherit", cwd: scriptsPath });

copyAndMoveJsonFile("category-uri-title-map.json", scriptsPath);
copyAndMoveJsonFile("orphaned_rules.json", scriptsPath);
copyAndMoveJsonFile("redirects.json", scriptsPath);
