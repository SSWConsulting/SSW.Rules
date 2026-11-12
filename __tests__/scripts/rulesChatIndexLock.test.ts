/**
 * @jest-environment node
 */
import { assertIndexLockHeld, INDEX_LOCK } from "@/scripts/rules-chat/lock.mjs";

function lockConnection(query: jest.Mock) {
  const input = jest.fn();
  const request = { input, query };
  input.mockReturnValue(request);
  return { connection: { request: () => request }, input };
}

describe("assertIndexLockHeld", () => {
  it("passes while the lock connection still holds the lock", async () => {
    const { connection, input } = lockConnection(jest.fn().mockResolvedValue({ recordset: [{ Mode: "Exclusive" }] }));

    await expect(assertIndexLockHeld(connection, "removing rules")).resolves.toBeUndefined();
    expect(input).toHaveBeenCalledWith("resource", INDEX_LOCK);
  });

  it("stops the run when a new session on the lock connection holds no lock", async () => {
    const { connection } = lockConnection(jest.fn().mockResolvedValue({ recordset: [{ Mode: "NoLock" }] }));

    await expect(assertIndexLockHeld(connection, "removing rules")).rejects.toThrow("lost the index lock before removing rules (lock mode NoLock)");
  });

  it("stops the run when the lock connection has dropped", async () => {
    const { connection } = lockConnection(jest.fn().mockRejectedValue(new Error("Connection lost - read ECONNRESET")));

    await expect(assertIndexLockHeld(connection, "reporting success")).rejects.toThrow(
      "Couldn't confirm this run still holds the index lock before reporting success: Connection lost - read ECONNRESET"
    );
  });
});
