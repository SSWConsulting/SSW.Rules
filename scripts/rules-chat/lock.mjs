// The application lock that keeps the hourly job and a run started by hand from indexing the same database at once.
// index-rules.mjs takes it with sp_getapplock on a connection of its own.

export const INDEX_LOCK = "rules-chat-index";

// The lock belongs to the session that took it. If that connection drops, SQL Server frees the lock and another run can
// take it, while the pool quietly opens a new session that holds nothing. A query on the lock connection then reads
// NoLock or fails, and either way this run stops.
export async function assertIndexLockHeld(lockConnection, step) {
  let mode;
  try {
    const result = await lockConnection.request().input("resource", INDEX_LOCK).query("SELECT APPLOCK_MODE('public', @resource, 'Session') AS Mode");
    mode = result.recordset[0]?.Mode;
  } catch (error) {
    throw new Error(`Couldn't confirm this run still holds the index lock before ${step}: ${error.message}`, { cause: error });
  }
  if (mode !== "Exclusive") {
    throw new Error(`This run lost the index lock before ${step} (lock mode ${mode}), so another run may be indexing. Stopping.`);
  }
}
