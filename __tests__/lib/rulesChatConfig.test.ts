import { getRulesChatConfig } from "@/lib/rulesChat/config";

const required = {
  RULES_CHAT_AI_BASE_URL: "http://localhost:11434/v1",
  RULES_CHAT_EMBEDDING_MODEL: "bge-m3",
  RULES_CHAT_CHAT_MODEL: "qwen3.5:9b",
  RULES_CHAT_SQL_SERVER: "localhost",
  RULES_CHAT_SQL_DATABASE: "RulesChat",
};

describe("getRulesChatConfig", () => {
  const original = process.env;
  beforeEach(() => {
    process.env = { ...original, ...required };
  });
  afterAll(() => {
    process.env = original;
  });

  it("rejects a temperature that isn't a number", () => {
    process.env.RULES_CHAT_TEMPERATURE = "abc";
    expect(() => getRulesChatConfig()).toThrow(/RULES_CHAT_TEMPERATURE/);
  });

  it("rejects an unknown token-limit parameter instead of guessing", () => {
    process.env.RULES_CHAT_MAX_TOKENS_PARAMETER = "max_token";
    expect(() => getRulesChatConfig()).toThrow(/RULES_CHAT_MAX_TOKENS_PARAMETER/);
  });

  it("defaults to max_completion_tokens and no temperature", () => {
    delete process.env.RULES_CHAT_MAX_TOKENS_PARAMETER;
    delete process.env.RULES_CHAT_TEMPERATURE;
    const config = getRulesChatConfig();
    expect(config.maxTokensParameter).toBe("max_completion_tokens");
    expect(config.temperature).toBeUndefined();
  });
});
