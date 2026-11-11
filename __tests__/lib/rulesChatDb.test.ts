/**
 * @jest-environment node
 */
type FakePool = { connect: jest.Mock; close: jest.Mock; on: jest.Mock; emitError: (error: Error) => void };

const connect = jest.fn();
const created: FakePool[] = [];

jest.mock("mssql", () => ({
  __esModule: true,
  default: {
    ConnectionPool: jest.fn().mockImplementation(() => {
      const listeners: ((error: Error) => void)[] = [];
      const fake: FakePool = {
        connect,
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn((event: string, listener: (error: Error) => void) => {
          if (event === "error") listeners.push(listener);
        }),
        emitError: (error) => {
          for (const listener of listeners) listener(error);
        },
      };
      created.push(fake);
      return fake;
    }),
  },
}));
jest.mock("@/lib/rulesChat/config", () => ({ getRulesChatConfig: () => ({ sql: {} }) }));

const timeout = Object.assign(new Error("Failed to connect to sql-sswrules-chat-staging.database.windows.net:1433 in 15000ms"), { code: "ETIMEOUT" });

beforeEach(() => {
  jest.resetModules();
  connect.mockReset();
  created.length = 0;
  jest.useFakeTimers();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("getPool", () => {
  it("waits for a paused database to resume instead of failing", async () => {
    const { getPool } = await import("@/lib/rulesChat/db");
    connect.mockRejectedValueOnce(timeout).mockResolvedValueOnce(undefined);

    const pool = getPool();
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(pool).resolves.toBe(created[1]);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(created[0].close).toHaveBeenCalled();
  });

  it("keeps the connected pool when a failed attempt reports an error later", async () => {
    const { getPool } = await import("@/lib/rulesChat/db");
    connect.mockRejectedValueOnce(timeout).mockResolvedValueOnce(undefined);

    const pool = getPool();
    await jest.advanceTimersByTimeAsync(5_000);
    await pool;
    created[0].emitError(new Error("socket closed"));

    expect(getPool()).toBe(pool);
  });

  it("connects again after the connected pool reports an error", async () => {
    const { getPool } = await import("@/lib/rulesChat/db");
    connect.mockResolvedValue(undefined);

    const pool = getPool();
    await pool;
    created[0].emitError(new Error("socket closed"));

    expect(getPool()).not.toBe(pool);
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
