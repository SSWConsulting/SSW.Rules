/**
 * @jest-environment node
 */
import { isCrossSiteRequest, readJsonBody } from "@/lib/rulesChat/request";

describe("isCrossSiteRequest", () => {
  it.each([
    ["cross-site", true],
    ["same-site", true],
    ["none", true],
    ["same-origin", false],
  ])("treats Sec-Fetch-Site %s as cross-site: %s", (site, expected) => {
    expect(isCrossSiteRequest(new Headers({ "sec-fetch-site": site }))).toBe(expected);
  });

  it("lets through callers that send no Sec-Fetch-Site, which are not browsers", () => {
    expect(isCrossSiteRequest(new Headers())).toBe(false);
  });
});

describe("readJsonBody", () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request("http://localhost/api/chat", { method: "POST", body, headers });

  it("parses a JSON body within the limit", async () => {
    expect(await readJsonBody(post('{"a":1}'), 100)).toEqual({ tooLarge: false, value: { a: 1 } });
  });

  it("reads a body that is not JSON as null", async () => {
    expect(await readJsonBody(post("not json"), 100)).toEqual({ tooLarge: false, value: null });
  });

  it("rejects a declared length over the limit without reading the body", async () => {
    expect(await readJsonBody(post("{}", { "content-length": "101" }), 100)).toEqual({ tooLarge: true });
  });

  it("rejects a body over the limit even when no length is declared", async () => {
    const chunks = new ReadableStream({
      start(controller) {
        for (let index = 0; index < 5; index++) controller.enqueue(new TextEncoder().encode("x".repeat(30)));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/chat", { method: "POST", body: chunks, duplex: "half" } as RequestInit);
    expect(await readJsonBody(request, 100)).toEqual({ tooLarge: true });
  });
});
