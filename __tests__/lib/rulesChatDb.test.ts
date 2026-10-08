/**
 * @jest-environment node
 */
const connect = jest.fn();

jest.mock("mssql", () => ({
  __esModule: true,
  default: { ConnectionPool: jest.fn().mockImplementation(() => ({ connect, on: jest.fn() })) },
}));
jest.mock("@/lib/rulesChat/config", () => ({ getRulesChatConfig: () => ({ sql: {} }) }));

const timeout = Object.assign(new Error("Failed to connect to sql-sswrules-chat-staging.database.windows.net:1433 in 15000ms"), { code: "ETIMEOUT" });

beforeEach(() => {
  jest.resetModules();
  connect.mockReset();
  jest.useFakeTimers();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("getPool", () => {
  it("waits for a paused database to resume instead of failing", async () => {
    const { getPool } = await import("@/lib/rulesChat/db");
    const connected = { name: "pool" };
    connect.mockRejectedValueOnce(timeout).mockResolvedValueOnce(connected);

    const pool = getPool();
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(pool).resolves.toBe(connected);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("fails straight away on an error that isn't the database resuming", async () => {
    const { getPool } = await import("@/lib/rulesChat/db");
    connect.mockRejectedValueOnce(new Error("Login failed for user"));

    await expect(getPool()).rejects.toThrow("Login failed for user");
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("gives up once the database has had two minutes to resume", async () => {
    const { getPool } = await import("@/lib/rulesChat/db");
    connect.mockRejectedValue(timeout);

    const pool = getPool();
    const failed = expect(pool).rejects.toBe(timeout);
    await jest.advanceTimersByTimeAsync(2 * 60_000 + 10_000);

    await failed;
  });
});

describe("isDatabaseWaking", () => {
  it("recognises the error Azure SQL returns while a database resumes", async () => {
    const { isDatabaseWaking } = await import("@/lib/rulesChat/db");

    expect(isDatabaseWaking(new Error("Database 'RulesChat' on server 'x' is not currently available. Please retry the connection later. 40613"))).toBe(true);
    expect(isDatabaseWaking(new Error("Login failed"))).toBe(false);
  });
});
