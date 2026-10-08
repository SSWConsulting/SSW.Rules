// Six turns of 2,000 characters plus the cited rules come to well under this.
export const MAX_BODY_BYTES = 32 * 1024;

// Browsers mark every request with where it came from. The chat window and the pop-out are on the site itself,
// so anything else is another site trying to use a signed-in visitor's session.
export function isCrossSiteRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin";
}

export type JsonBody = { tooLarge: true } | { tooLarge: false; value: unknown };

// Stops reading once the limit is passed, so a large body is never held in memory. A body that is not JSON reads as null.
export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<JsonBody> {
  if (Number(request.headers.get("content-length")) > maxBytes) return { tooLarge: true };
  if (!request.body) return { tooLarge: false, value: null };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }

  try {
    return { tooLarge: false, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { tooLarge: false, value: null };
  }
}
