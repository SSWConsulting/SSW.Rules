// The two Tina data sources return a different value for the same media file. TinaCloud returns the URL of
// its asset host. The local Tina server returns the path that the content stores, and no route of the
// production site serves that path. These functions give the same URL for the two sources.

// The value of `media.tina.mediaRoot` in tina/config.tsx. Each path that the Tina media library stores starts with it.
const MEDIA_ROOT = "/uploads";
const ASSETS_ORIGIN = "https://assets.tina.io";

// A URL that has a scheme, or a protocol-relative URL.
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:|^\/\//i;

/**
 * Returns the URL that TinaCloud returns for a path of the Tina media library.
 * A value that is not such a path does not change.
 *
 * @example
 * toTinaAssetUrl("/uploads/rules/my-rule/image.png") // "https://assets.tina.io/<client ID>/rules/my-rule/image.png"
 * toTinaAssetUrl("https://example.com/image.png")    // "https://example.com/image.png"
 * toTinaAssetUrl("/my-rule")                         // "/my-rule"
 */
export function toTinaAssetUrl<T>(value: T): T | string {
  const clientId = process.env.NEXT_PUBLIC_TINA_CLIENT_ID;
  if (typeof value !== "string" || !clientId || !value.startsWith(MEDIA_ROOT)) return value;

  const path = value.slice(MEDIA_ROOT.length);
  // Some content has the media root in front of an external URL ("/uploadshttps://..."). TinaCloud returns the external URL.
  if (ABSOLUTE_URL.test(path)) return path;
  if (!path.startsWith("/")) return value;

  return `${ASSETS_ORIGIN}/${clientId}${path}`;
}

/**
 * Returns the URL to show for the value of a Tina image field: an `image` field, the `src` of an image embed,
 * or the URL of a markdown image.
 */
export function tinaImageSrc<T>(value: T): T | string {
  // The development server serves the stored path from the local content repository (see proxy.ts).
  // Thus an image that is not in TinaCloud yet is visible during local work.
  if (process.env.NODE_ENV === "development") return value;

  return toTinaAssetUrl(value);
}

/**
 * Returns the rich-text content with `tinaImageSrc` applied to the URL of each markdown image.
 *
 * TinaMarkdown shows the content of a table cell with its default components, not with the components
 * that the page gives to it. An image in a table cell thus needs the correct URL in the content.
 * The result is the same object when no URL changes.
 */
export function withTinaImageSrc<T>(content: T): T {
  return convertImageUrls(content) as T;
}

function convertImageUrls(node: unknown): unknown {
  if (Array.isArray(node)) {
    let changed = false;
    const items = node.map((item) => {
      const converted = convertImageUrls(item);
      if (converted !== item) changed = true;
      return converted;
    });
    return changed ? items : node;
  }
  if (!node || typeof node !== "object") return node;

  const source = node as Record<string, unknown>;
  let result = source;
  for (const [key, value] of Object.entries(source)) {
    const converted = key === "url" && source.type === "img" ? tinaImageSrc(value) : convertImageUrls(value);
    if (converted === value) continue;
    if (result === source) result = { ...source };
    result[key] = converted;
  }
  return result;
}
