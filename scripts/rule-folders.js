/**
 * The rule folders of an SSW.Rules.Content checkout, written to rule-folders.json.
 *
 * The site build prerenders one page for each rule. `generateStaticParams` reads the list from this file,
 * because the paged Tina requests for all rules are slow and each of them can fail.
 */
const fs = require("node:fs");
const path = require("node:path");

const RULES_DIR = path.join("public", "uploads", "rules");
const RULE_FILE = "rule.mdx";
// The project root: the build reads the file from its working directory, and the Docker build context includes it.
const RULE_FOLDERS_PATH = path.resolve(__dirname, "..", "rule-folders.json");

// The folder name is the page URL: the page asks Tina for "<folder>/rule.mdx" and does not use the `uri` field.
// Archived rules have a page too, so they are in the list.
function listRuleFolders(contentRoot) {
  const rulesDir = path.join(contentRoot, RULES_DIR);
  return fs
    .readdirSync(rulesDir)
    .filter((folder) => fs.existsSync(path.join(rulesDir, folder, RULE_FILE)))
    .sort();
}

function writeRuleFolders(contentRoot, outputPath = RULE_FOLDERS_PATH) {
  const folders = listRuleFolders(contentRoot);
  fs.writeFileSync(outputPath, `${JSON.stringify(folders, null, 2)}\n`);
  return { folders, outputPath };
}

module.exports = { listRuleFolders, writeRuleFolders };
