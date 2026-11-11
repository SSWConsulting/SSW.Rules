import { getRulesChatTier, isEmployeeGitHubUser } from "@/lib/rulesChatAccess";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/services/dynamics", () => ({
  createDynamicsService: () => ({ getEmployees: async () => [{ gitHubUrl: "https://github.com/AntPolkanov" }] }),
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

  it("lets nobody in when switched off, when signed out, or when not signed in with GitHub", async () => {
    expect(await getRulesChatTier(null)).toBeNull();
    expect(await getRulesChatTier({ sub: "auth0|1", nickname: "AntPolkanov" })).toBeNull();
    process.env.RULES_CHAT_ENABLED = "false";
    expect(await getRulesChatTier(employee)).toBeNull();
  });
});

const employeeGitHubUrls = ["https://github.com/AntPolkanov", "https://github.com/someone-else/", ""];

describe("isEmployeeGitHubUser", () => {
  it.each([
    ["an exact username", "AntPolkanov"],
    ["a different letter case", "antpolkanov"],
    ["a profile URL with a trailing slash", "someone-else"],
  ])("allows %s", (_name, nickname) => {
    expect(isEmployeeGitHubUser({ sub: "github|1", nickname }, employeeGitHubUrls)).toBe(true);
  });

  it.each([
    ["no user", null],
    ["no nickname", { sub: "github|1" }],
    ["a username that is only part of an employee's", { sub: "github|1", nickname: "ant" }],
    ["a username that is not in CRM", { sub: "github|1", nickname: "stranger" }],
    ["a matching nickname from a non-GitHub sign-in", { sub: "auth0|1", nickname: "AntPolkanov" }],
  ])("rejects %s", (_name, user) => {
    expect(isEmployeeGitHubUser(user, employeeGitHubUrls)).toBe(false);
  });
});
