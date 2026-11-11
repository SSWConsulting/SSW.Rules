/**
 * @jest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateRuleCategories } from "@/scripts/validate-rule-categories";

const EXISTING = "categories/business-applications/rules-to-better-sharepoint-for-developers.mdx";
const MOVED = "categories/software-engineering/rules-to-better-sharepoint-for-developers.mdx";

let contentRoot: string;

const writeFile = (relativePath: string, content: string) => {
  const full = path.join(contentRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

const writeRule = (folder: string, frontmatter: string) => writeFile(`public/uploads/rules/${folder}/rule.mdx`, `---\n${frontmatter}\n---\n\nBody`);

const categoriesYaml = (...paths: string[]) => `categories:\n${paths.map((p) => `  - category: ${p}`).join("\n")}`;

beforeEach(() => {
  contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rules-content-"));
  writeFile("categories/index.mdx", "---\ntitle: Main\n---\n");
  writeFile(EXISTING, "---\ntitle: SharePoint\n---\n");
});

afterEach(() => fs.rmSync(contentRoot, { recursive: true, force: true }));

describe("validateRuleCategories", () => {
  it("accepts rules whose categories all exist", () => {
    writeRule("valid", `uri: valid\n${categoriesYaml(EXISTING)}`);

    expect(validateRuleCategories(contentRoot)).toEqual({ uncategorizedRules: [], danglingReferences: [] });
  });

  describe("rules with no category", () => {
    it("names each live rule with an empty or missing categories field", () => {
      writeRule("empty-list", "uri: empty-list\ncategories: []");
      writeRule("no-field", "uri: no-field");
      writeRule("blank-entry", "uri: blank-entry\ncategories:\n  - category: ''");

      expect(validateRuleCategories(contentRoot).uncategorizedRules).toEqual([
        "public/uploads/rules/blank-entry/rule.mdx",
        "public/uploads/rules/empty-list/rule.mdx",
        "public/uploads/rules/no-field/rule.mdx",
      ]);
    });

    it("lets archived rules have no category", () => {
      writeRule("archived", "uri: archived\nisArchived: true\narchivedreason: Obsolete\ncategories: []");

      expect(validateRuleCategories(contentRoot).uncategorizedRules).toEqual([]);
    });

    it("treats a rule with only an archivedreason as live, since the site filters on isArchived", () => {
      writeRule("reason-only", "uri: reason-only\narchivedreason: Obsolete");

      expect(validateRuleCategories(contentRoot).uncategorizedRules).toEqual(["public/uploads/rules/reason-only/rule.mdx"]);
    });
  });

  describe("references to a missing category", () => {
    it("names each rule that points at a category file that no longer exists", () => {
      writeRule("moved-category", `uri: moved-category\n${categoriesYaml(MOVED)}`);

      expect(validateRuleCategories(contentRoot)).toEqual({
        uncategorizedRules: [],
        danglingReferences: [{ rule: "public/uploads/rules/moved-category/rule.mdx", category: MOVED }],
      });
    });

    it("checks archived rules too, since /archived resolves their categories", () => {
      writeRule("archived", `uri: archived\nisArchived: true\n${categoriesYaml("categories/gone.mdx")}`);

      expect(validateRuleCategories(contentRoot).danglingReferences).toEqual([
        { rule: "public/uploads/rules/archived/rule.mdx", category: "categories/gone.mdx" },
      ]);
    });

    it("only reports the missing entry when a rule mixes valid and missing categories", () => {
      writeRule("mixed", `uri: mixed\n${categoriesYaml(EXISTING, "categories/gone.mdx")}`);

      expect(validateRuleCategories(contentRoot)).toEqual({
        uncategorizedRules: [],
        danglingReferences: [{ rule: "public/uploads/rules/mixed/rule.mdx", category: "categories/gone.mdx" }],
      });
    });

    it("matches category paths case-sensitively, like Tina on the Linux build agent", () => {
      writeRule("wrong-case", `uri: wrong-case\n${categoriesYaml("categories/Business-Applications/rules-to-better-sharepoint-for-developers.mdx")}`);

      expect(validateRuleCategories(contentRoot).danglingReferences).toHaveLength(1);
    });
  });

  it("names the rule whose frontmatter cannot be parsed", () => {
    writeRule("broken-yaml", 'uri: broken-yaml\ntitle: "unterminated');

    expect(() => validateRuleCategories(contentRoot)).toThrow("public/uploads/rules/broken-yaml/rule.mdx");
  });
});
