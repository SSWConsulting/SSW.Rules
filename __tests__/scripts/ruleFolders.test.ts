/**
 * @jest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listRuleFolders, writeRuleFolders } from "@/scripts/rule-folders";

let contentRoot: string;

const writeFile = (relativePath: string, content = "") => {
  const full = path.join(contentRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

const writeRule = (folder: string, frontmatter = `uri: ${folder}`) => writeFile(`public/uploads/rules/${folder}/rule.mdx`, `---\n${frontmatter}\n---\n\nBody`);

beforeEach(() => {
  contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rules-content-"));
  fs.mkdirSync(path.join(contentRoot, "public", "uploads", "rules"), { recursive: true });
});

afterEach(() => fs.rmSync(contentRoot, { recursive: true, force: true }));

describe("listRuleFolders", () => {
  it("returns each folder that has a rule.mdx file, in sorted order", () => {
    writeRule("keep-urls-clean");
    writeRule("3-steps-to-a-pbi");
    writeRule("definition-of-done");

    expect(listRuleFolders(contentRoot)).toEqual(["3-steps-to-a-pbi", "definition-of-done", "keep-urls-clean"]);
  });

  it("includes archived rules, because they have a page", () => {
    writeRule("active");
    writeRule("archived", "uri: archived\nisArchived: true\narchivedreason: Obsolete");

    expect(listRuleFolders(contentRoot)).toEqual(["active", "archived"]);
  });

  it("uses the folder name and not the uri field, because the page loads <folder>/rule.mdx", () => {
    writeRule("folder-name", "uri: different-uri");

    expect(listRuleFolders(contentRoot)).toEqual(["folder-name"]);
  });

  it("ignores a folder that has no rule.mdx file", () => {
    writeRule("with-rule");
    writeFile("public/uploads/rules/images-only/figure.png");
    writeFile("public/uploads/rules/other-format/rule.md");

    expect(listRuleFolders(contentRoot)).toEqual(["with-rule"]);
  });

  it("ignores a rule.mdx file in a deeper folder, because no page can load it", () => {
    writeRule("with-rule");
    writeFile("public/uploads/rules/parent/child/rule.mdx");

    expect(listRuleFolders(contentRoot)).toEqual(["with-rule"]);
  });

  it("ignores a file in the rules folder", () => {
    writeRule("with-rule");
    writeFile("public/uploads/rules/rule.mdx");
    writeFile("public/uploads/rules/.DS_Store");

    expect(listRuleFolders(contentRoot)).toEqual(["with-rule"]);
  });

  it("returns an empty list when the content has no rules", () => {
    expect(listRuleFolders(contentRoot)).toEqual([]);
  });
});

describe("writeRuleFolders", () => {
  it("writes the list as a JSON array and returns it", () => {
    writeRule("keep-urls-clean");
    writeRule("definition-of-done");
    const outputPath = path.join(contentRoot, "rule-folders.json");

    const result = writeRuleFolders(contentRoot, outputPath);

    expect(result).toEqual({ folders: ["definition-of-done", "keep-urls-clean"], outputPath });
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toEqual(["definition-of-done", "keep-urls-clean"]);
  });

  it("replaces a list from an earlier run", () => {
    const outputPath = path.join(contentRoot, "rule-folders.json");
    fs.writeFileSync(outputPath, JSON.stringify(["removed-rule"]));
    writeRule("keep-urls-clean");

    writeRuleFolders(contentRoot, outputPath);

    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toEqual(["keep-urls-clean"]);
  });
});
