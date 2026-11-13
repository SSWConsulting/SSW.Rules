/**
 * @jest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const allRulesPaths = jest.fn();

// The factory runs before the mock above is initialized, so it reads it only when the query is called
jest.mock("@/tina/__generated__/client", () => ({
  __esModule: true,
  default: { queries: { allRulesPaths: (...args: unknown[]) => allRulesPaths(...args) } },
}));

import { getRuleFolders, RULE_FOLDERS_FILE, readRuleFolders } from "@/lib/ruleFolders";
import { writeRuleFolders } from "@/scripts/rule-folders";

let dir: string;
let filePath: string;
let log: jest.SpyInstance;

const writeList = (content: string) => fs.writeFileSync(filePath, content);

const rulePage = (folders: string[], endCursor: string | null) => ({
  data: {
    ruleConnection: {
      edges: folders.map((folder) => ({ node: { __typename: "Rule", _sys: { relativePath: `${folder}/rule.mdx`, filename: "rule" } } })),
      pageInfo: { hasNextPage: endCursor !== null, endCursor },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rule-folders-"));
  filePath = path.join(dir, RULE_FOLDERS_FILE);
  log = jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("readRuleFolders", () => {
  it("returns the folder names from a valid file", async () => {
    writeList(JSON.stringify(["3-steps-to-a-pbi", "definition-of-done"]));

    expect(await readRuleFolders(filePath)).toEqual({ folders: ["3-steps-to-a-pbi", "definition-of-done"], problem: null });
  });

  it("reads the file that the content preparation writes", async () => {
    const contentRoot = path.join(dir, "content");
    for (const folder of ["keep-urls-clean", "definition-of-done"]) {
      fs.mkdirSync(path.join(contentRoot, "public", "uploads", "rules", folder), { recursive: true });
      fs.writeFileSync(path.join(contentRoot, "public", "uploads", "rules", folder, "rule.mdx"), "---\ntitle: Rule\n---\n");
    }
    writeRuleFolders(contentRoot, filePath);

    expect(await readRuleFolders(filePath)).toEqual({ folders: ["definition-of-done", "keep-urls-clean"], problem: null });
  });

  it("reports a missing file", async () => {
    expect(await readRuleFolders(filePath)).toEqual({ folders: null, problem: "file not found" });
  });

  it("reports a file that it cannot read", async () => {
    fs.mkdirSync(filePath);

    const result = await readRuleFolders(filePath);

    expect(result.folders).toBeNull();
    expect(result.problem).toContain("cannot read the file");
  });

  it("rejects a file that is not valid JSON", async () => {
    writeList('["3-steps-to-a-pbi",');

    expect(await readRuleFolders(filePath)).toEqual({ folders: null, problem: "not valid JSON" });
  });

  it.each([
    ["an empty list", "[]"],
    ["an object", '{"folders":["3-steps-to-a-pbi"]}'],
    ["a string", '"3-steps-to-a-pbi"'],
    ["null", "null"],
  ])("rejects %s", async (_name, content) => {
    writeList(content);

    expect(await readRuleFolders(filePath)).toEqual({ folders: null, problem: "not a non-empty list" });
  });

  it.each([
    ["a number", '["3-steps-to-a-pbi", 42]'],
    ["null", '["3-steps-to-a-pbi", null]'],
    ["an empty string", '["3-steps-to-a-pbi", ""]'],
    ["a path", '["3-steps-to-a-pbi", "definition-of-done/rule.mdx"]'],
  ])("rejects a list where an entry is %s", async (_name, content) => {
    writeList(content);

    expect(await readRuleFolders(filePath)).toEqual({ folders: null, problem: "an entry is not a folder name" });
  });
});

describe("getRuleFolders", () => {
  // The build runs in the project root, which is where the content preparation writes the file
  beforeEach(() => jest.spyOn(process, "cwd").mockReturnValue(dir));

  describe("with a valid file in the working directory", () => {
    beforeEach(() => writeList(JSON.stringify(["3-steps-to-a-pbi", "definition-of-done"])));

    it("returns the rules from the file and sends no Tina request", async () => {
      expect(await getRuleFolders()).toEqual(["3-steps-to-a-pbi", "definition-of-done"]);
      expect(allRulesPaths).not.toHaveBeenCalled();
    });

    it("logs the file as the source, with the number of rules", async () => {
      await getRuleFolders();

      expect(log).toHaveBeenCalledWith("📋 generateStaticParams: rules=2 source=rule-folders.json");
    });
  });

  describe("without a file", () => {
    it("gets the rules from the paged Tina requests", async () => {
      allRulesPaths
        .mockResolvedValueOnce(rulePage(["3-steps-to-a-pbi", "definition-of-done"], "cursor-1"))
        .mockResolvedValueOnce(rulePage(["keep-urls-clean"], null));

      expect(await getRuleFolders()).toEqual(["3-steps-to-a-pbi", "definition-of-done", "keep-urls-clean"]);
      expect(allRulesPaths).toHaveBeenCalledTimes(2);
      expect(allRulesPaths).toHaveBeenNthCalledWith(1, { first: 200, after: null });
      expect(allRulesPaths).toHaveBeenNthCalledWith(2, { first: 200, after: "cursor-1" });
    });

    it("logs Tina as the source, with the cause and the number of rules", async () => {
      allRulesPaths.mockResolvedValueOnce(rulePage(["3-steps-to-a-pbi"], null));

      await getRuleFolders();

      expect(log).toHaveBeenCalledWith("📋 generateStaticParams: rules=1 source=Tina (rule-folders.json: file not found)");
    });

    // The file prevents this result in the build: it gives the full list with no request that can fail
    it("returns only the rules of the earlier pages when a Tina request fails", async () => {
      allRulesPaths
        .mockResolvedValueOnce(rulePage(["3-steps-to-a-pbi"], "cursor-1"))
        .mockRejectedValueOnce(new Error("Throughput exceeds the current capacity of your table or index"));

      expect(await getRuleFolders()).toEqual(["3-steps-to-a-pbi"]);
      expect(allRulesPaths).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledWith("📋 generateStaticParams: rules=1 source=Tina (rule-folders.json: file not found)");
    });
  });

  it("gets the rules from Tina when the file is not valid", async () => {
    writeList("[]");
    allRulesPaths.mockResolvedValueOnce(rulePage(["3-steps-to-a-pbi"], null));

    expect(await getRuleFolders()).toEqual(["3-steps-to-a-pbi"]);
    expect(log).toHaveBeenCalledWith("📋 generateStaticParams: rules=1 source=Tina (rule-folders.json: not a non-empty list)");
  });
});
