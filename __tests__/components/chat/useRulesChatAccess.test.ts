import { renderHook, waitFor } from "@testing-library/react";
import { useRulesChatAccess } from "@/components/chat/useRulesChatAccess";

// The access check is cached per user for the whole module, so each test signs in a different user.
let userSub = "";
jest.mock("@/components/auth/UserClientProvider", () => ({ useAuth: () => ({ user: { sub: userSub } }) }));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("useRulesChatAccess", () => {
  it("checks again after a failed check instead of remembering the failure", async () => {
    userSub = "auth0|failed-first";
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    renderHook(() => useRulesChatAccess());
    await waitFor(() => expect(console.error).toHaveBeenCalled());

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ allowed: true }) });
    const second = renderHook(() => useRulesChatAccess());

    await waitFor(() => expect(second.result.current).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares one check between components", async () => {
    userSub = "auth0|shared";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ allowed: true }) });

    const first = renderHook(() => useRulesChatAccess());
    const second = renderHook(() => useRulesChatAccess());

    await waitFor(() => expect(first.result.current && second.result.current).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
