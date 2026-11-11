import { act, renderHook } from "@testing-library/react";
import { TextDecoder, TextEncoder } from "node:util";
import { FAILURE_TEXT } from "@/components/chat/refusalMessage";
import { useChatMessages } from "@/components/chat/useChatMessages";

jest.mock("@/components/auth/UserClientProvider", () => ({ useAuth: () => ({ user: null, isLoading: false }) }));

Object.assign(globalThis, { TextDecoder, TextEncoder });

const SOURCES = { type: "sources", sources: [{ number: 1, title: "Rule A", href: "/rule-a" }], remainingToday: null };

// A streamed response, delivered in the given chunks so a line can be split across reads.
function streamed(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: { getReader: () => ({ read: async () => (index < chunks.length ? { done: false, value: encoder.encode(chunks[index++]) } : { done: true }) }) },
  };
}

const lines = (...items: object[]) => items.map((item) => `${JSON.stringify(item)}\n`).join("");

const fetchMock = jest.fn();

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

async function ask(text: string) {
  const { result } = renderHook(() => useChatMessages());
  await act(() => result.current.send(text));
  return result;
}

describe("useChatMessages", () => {
  it("parses a line split across chunks once", async () => {
    const body = lines(SOURCES, { type: "delta", text: "Use rule A [1]." });
    fetchMock.mockResolvedValue(streamed([body.slice(0, 40), body.slice(40)]));

    const result = await ask("Question?");

    const reply = result.current.messages[1];
    expect(reply).toMatchObject({ role: "assistant", text: "Use rule A [1].", sources: [{ number: 1, href: "/rule-a" }] });
    expect(reply.failed).toBeUndefined();
  });

  it("marks the reply failed when the stream reports an error", async () => {
    fetchMock.mockResolvedValue(streamed([lines(SOURCES, { type: "delta", text: "Half" }, { type: "error" })]));

    const result = await ask("Question?");

    expect(result.current.messages[1]).toMatchObject({ text: FAILURE_TEXT, failed: true });
  });

  it("marks the reply failed when sources arrive but no answer does", async () => {
    fetchMock.mockResolvedValue(streamed([lines(SOURCES)]));

    const result = await ask("Question?");

    expect(result.current.messages[1]).toMatchObject({ text: FAILURE_TEXT, failed: true });
  });

  it("shows the daily limit message when the server refuses for the day", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ reason: "day", retryAt: null }) });

    const result = await ask("Question?");

    expect(result.current.messages[1]).toMatchObject({ text: "You've used today's questions. Try again tomorrow.", failed: true });
  });

  it("sends only the latest questions, never earlier answers or failure messages", async () => {
    const answered = () => streamed([lines(SOURCES, { type: "delta", text: "Answer [1]." })]);
    const { result } = renderHook(() => useChatMessages());
    for (const question of ["First?", "Second?", "Third?"]) {
      fetchMock.mockResolvedValueOnce(answered());
      await act(() => result.current.send(question));
    }
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => null });
    await act(() => result.current.send("Fourth?"));

    fetchMock.mockResolvedValueOnce(answered());
    await act(() => result.current.send("Fifth?"));

    const sent = JSON.parse(fetchMock.mock.calls[4][1].body);
    expect(result.current.messages[7]).toMatchObject({ failed: true });
    expect(sent.messages).toEqual([
      { role: "user", content: "Third?" },
      { role: "user", content: "Fourth?" },
      { role: "user", content: "Fifth?" },
    ]);
    expect(sent.citedRules).toEqual([{ number: 1, uri: "rule-a" }]);
  });
});
