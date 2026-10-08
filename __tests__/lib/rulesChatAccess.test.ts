import { getRulesChatTier, isEmployeeGitHubUser } from "@/lib/rulesChatAccess";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/services/dynamics", () => ({
  createDynamicsService: () => ({ getEmployees: async () => [{ gitHubUrl: "https://github.com/AntPolkanov" }] }),
}));
// AntPolkanov's GitHub account ID is 1 in these tests.
const resolveGitHubIds = jest.fn(async (usernames: string[]) => new Set(usernames.includes("antpolkanov") ? [1] : []));
jest.mock("@/lib/rulesChat/gitHubIds", () => ({
  ...jest.requireActual("@/lib/rulesChat/gitHubIds"),
  resolveGitHubIds: (usernames: string[]) => resolveGitHubIds(usernames),
}));

describe("getRulesChatTier", () => {
  const savedEnv = { ...process.env };
  const employee = { sub: "github|1", nickname: "AntPolkanov" };
  const stranger = { sub: "github|2", nickname: "stranger" };

  beforeEach(() => {
    process.env.RULES_CHAT_ENABLED = "true";
    process.env.RULES_CHAT_MEMBER_DAILY_LIMIT = "20";
    process.env.RULES_CHAT_MONTHLY_BUDGET_USD = "100";
    process.env.RULES_CHAT_INPUT_PRICE_PER_MILLION_TOKENS_USD = "1";
    process.env.RULES_CHAT_OUTPUT_PRICE_PER_MILLION_TOKENS_USD = "4";
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  describe("local access switch", () => {
    // process.env is replaced after each test, so always write to the current object.
    const env = () => process.env as Record<string, string | undefined>;
    const developer = { sub: "auth0|developer" };

    beforeEach(() => {
      env().RULES_CHAT_DEV_ACCESS = "true";
      env().RULES_CHAT_MEMBER_DAILY_LIMIT = "0";
    });

    it("lets any signed-in user in on a development server, without the CRM check", async () => {
      env().NODE_ENV = "development";
      expect(await getRulesChatTier(developer)).toBe("staff");
    });

    it("is ignored by a production build", async () => {
      env().NODE_ENV = "production";
      expect(await getRulesChatTier(developer)).toBeNull();
      expect(await getRulesChatTier(stranger)).toBeNull();
    });

    it("still needs a signed-in user", async () => {
      env().NODE_ENV = "development";
      expect(await getRulesChatTier(null)).toBeNull();
    });
  });

  it("gives employees the staff tier and other GitHub users the member tier", async () => {
    expect(await getRulesChatTier(employee)).toBe("staff");
    expect(await getRulesChatTier(stranger)).toBe("member");
  });

  it("keeps it to staff while the member daily limit is 0", async () => {
    process.env.RULES_CHAT_MEMBER_DAILY_LIMIT = "0";
    expect(await getRulesChatTier(employee)).toBe("staff");
    expect(await getRulesChatTier(stranger)).toBeNull();
  });

  it("doesn't give the staff tier to a different account that took an employee's old username", async () => {
    // Session users carry the GitHub username as nickname; the match ignores it.
    const renamedAway = { sub: "github|99", nickname: "AntPolkanov" };
    expect(await getRulesChatTier(renamedAway)).toBe("member");
  });

  it("falls back to the member tier when the employees' GitHub IDs can't be loaded", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    resolveGitHubIds.mockRejectedValueOnce(new Error("GitHub is down"));
    expect(await getRulesChatTier(employee)).toBe("member");
    error.mockRestore();
  });

  it("lets nobody in when switched off, when signed out, or when not signed in with GitHub", async () => {
    expect(await getRulesChatTier(null)).toBeNull();
    const otherSignIn = { sub: "auth0|1", nickname: "AntPolkanov" };
    expect(await getRulesChatTier(otherSignIn)).toBeNull();
    process.env.RULES_CHAT_ENABLED = "false";
    expect(await getRulesChatTier(employee)).toBeNull();
  });
});

describe("isEmployeeGitHubUser", () => {
  const employeeIds = new Set([1, 42]);

  it("matches on the GitHub account ID in the sub", () => {
    expect(isEmployeeGitHubUser({ sub: "github|42" }, employeeIds)).toBe(true);
  });

  it.each([
    ["no user", null],
    ["an ID that isn't an employee's", { sub: "github|7" }],
    ["a non-GitHub sign-in with the same number", { sub: "auth0|42" }],
    ["a malformed sub", { sub: "github|42abc" }],
  ])("rejects %s", (_name, user) => {
    expect(isEmployeeGitHubUser(user, employeeIds)).toBe(false);
  });
});
