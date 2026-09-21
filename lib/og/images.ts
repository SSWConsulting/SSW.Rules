import { readFile } from "node:fs/promises";
import path from "node:path";
import { authorImageUrl } from "@/lib/authorImage";
import type { OgAuthor } from "@/lib/og/target";

const publicFile = (relative: string) => path.join(process.cwd(), "public", relative);

const dataUri = (buffer: Buffer, mime: string) => `data:${mime};base64,${buffer.toString("base64")}`;

/**
 * Detects the image type from magic bytes rather than the response header.
 *
 * Several profile photos in SSW.People.Profiles are PNGs saved with a .jpg extension.
 * raw.githubusercontent serves them as image/jpeg from the extension, and Satori throws
 * "Invalid JPEG" if you believe it. Returns null for anything unrecognised so callers
 * fall back rather than hand Satori bytes it cannot decode.
 */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

/**
 * SSW's polygon background, inverted offline so it reads light. Fading the near-black
 * brand asset down instead crushes its facet contrast to nothing. Regenerate with:
 *
 *   magick polygonBackground.png -resize 1200x630^ -gravity center -extent 1200x630 \
 *     -negate -normalize -sigmoidal-contrast 3,50% +level 79%,99.5% public/og-polygon.png
 */
const cachedFile = (relative: string, mime: string) => {
  let cache: string | undefined;
  return async (): Promise<string> => (cache ??= dataUri(await readFile(publicFile(relative)), mime));
};

export const loadPolygon = cachedFile("og-polygon.png", "image/png");
const loadPlaceholder = cachedFile("uploads/ssw-employee-profile-placeholder-sketch.jpg", "image/jpeg");

/** Fetched rather than handed to Satori as a URL so one bad photo degrades to the placeholder. */
export const loadAvatar = async (author: OgAuthor): Promise<string> => {
  const url = authorImageUrl(author.url);

  if (url) {
    try {
      // Bounded: a slow GitHub must not stall the render past a crawler deadline
      const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 }, signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const type = sniffImageType(buffer);
        if (type) return dataUri(buffer, type);
      }
    } catch (error) {
      console.warn(`[og] avatar fetch failed for ${url}:`, error);
    }
  }

  return loadPlaceholder();
};
