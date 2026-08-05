import { readFile } from "node:fs/promises";
import path from "node:path";
import { profileImageUrl } from "@/lib/authorImage";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const MAX_FACES = 2; // 78% of rules have <= 2 authors; the rest are summarised by the chip
const OVERLAP = 16;
const AVATAR = 72;
const FOOTER_SIZE = 26;

export interface OgAuthor {
  title?: string | null;
  url?: string | null;
}

const publicFile = (relative: string) => path.join(process.cwd(), "public", relative);

const dataUri = (buffer: Buffer, mime: string) => `data:${mime};base64,${buffer.toString("base64")}`;

/**
 * SSW's polygon background, inverted offline so it reads light.
 *
 * Fading the near-black brand asset (SSW.Website public/images/polygonBackground.png)
 * into a light card crushes its facet contrast proportionally - at 0.15 opacity only
 * 7 RGB levels survived, which is invisible. Inverting it once instead keeps 53 levels:
 *
 *   magick polygonBackground.png -resize 1200x630^ -gravity center -extent 1200x630 \
 *     -negate -normalize -sigmoidal-contrast 3,50% +level 79%,99.5% public/og-polygon.png
 */
const loadPolygon = async () => dataUri(await readFile(publicFile("og-polygon.png")), "image/png");

/**
 * Detects the real image type from magic bytes rather than trusting the response header.
 *
 * 5 of the 203 profile photos in SSW.People.Profiles are PNGs saved with a .jpg
 * extension (Chris-Briggs, Florent-Dezettre, Eli-Kent, Igor-Goldobin, Stanley-Sidik).
 * raw.githubusercontent serves those as `content-type: image/jpeg` based on the
 * extension, and Satori throws "Invalid JPEG" if it believes the header - which would
 * fail the whole card for any rule those five authored.
 */
const sniffImageType = (buffer: Buffer): string | null => {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
};

/**
 * Author photos are fetched here rather than handed to Satori as URLs, so a missing or
 * unreadable profile falls back to the placeholder instead of failing the whole image.
 * 13 of the 216 author URLs in the content have no profile photo (alumni, or non-person
 * URLs like /people/alumni).
 */
const loadAvatar = async (author: OgAuthor): Promise<string> => {
  const url = profileImageUrl(author.url ?? undefined);

  if (url) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const type = sniffImageType(buffer);
        if (type) return dataUri(buffer, type);
      }
    } catch {
      // fall through to the placeholder
    }
  }

  return dataUri(await readFile(publicFile("uploads/ssw-employee-profile-placeholder-sketch.jpg")), "image/jpeg");
};

const Avatar = ({ src, index, total }: { src: string; index: number; total: number }) => (
  <div
    style={{
      display: "flex",
      position: "relative",
      width: AVATAR,
      height: AVATAR,
      flexShrink: 0,
      marginLeft: index === 0 ? 0 : -OVERLAP,
      borderRadius: AVATAR,
      // Overlapping faces need separating. A white ring only works on a white background,
      // so the photo behind has a hole masked out of it and the polygon shows through.
      ...(index < total - 1
        ? {
            maskImage: `radial-gradient(circle ${AVATAR / 2 + 4}px at ${AVATAR - OVERLAP + AVATAR / 2}px ${AVATAR / 2}px, transparent 99%, #000 100%)`,
          }
        : {}),
    }}
  >
    <img src={src} width={AVATAR} height={AVATAR} style={{ borderRadius: AVATAR, objectFit: "cover" }} alt="" />
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: AVATAR,
        height: AVATAR,
        borderRadius: AVATAR,
        background: "rgba(20,20,25,0.18)",
      }}
    />
  </div>
);

/**
 * Closes the avatar row with a "+3" disc when there are more contributors than faces.
 * Always last in the row, so unlike the photos it never needs a hole masked out of it.
 */
const ExtraChip = ({ count }: { count: number }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: AVATAR,
      height: AVATAR,
      flexShrink: 0,
      marginLeft: -OVERLAP,
      borderRadius: AVATAR,
      background: "#fff",
      fontSize: 24,
      fontWeight: 600,
      color: "#555",
    }}
  >
    {`+${count}`}
  </div>
);

interface OgCardProps {
  title: string;
  authors?: OgAuthor[];
  /** Site-wide rule total, shown bottom-right on every card. */
  totalRules?: number;
  /** Categories and the home page sit above individual rules and get a larger title. */
  isHub?: boolean;
}

export async function OgCard({ title, authors = [], totalRules, isHub = false }: OgCardProps) {
  const named = authors.filter((a) => a?.title);
  const authorCount = named.length;
  const shown = named.slice(0, MAX_FACES);
  const extra = authorCount - shown.length;
  // The chip counts as a face for masking, so the avatar behind it gets a hole cut
  const faceCount = shown.length + (extra > 0 ? 1 : 0);

  const [polygon, avatars] = await Promise.all([loadPolygon(), Promise.all(shown.map(loadAvatar))]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fff",
        padding: 64,
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      <img src={polygon} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />

      {/* The title sat on 56 levels of facet noise, which fights the letterforms whatever
          the contrast ratio. This flattens the top third; the geometry stays intact below. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.78) 38%, rgba(255,255,255,0) 62%)",
        }}
      />
      {/* Kept separate from the scrim above - interpolating a white stop straight into a
          black one produces a grey haze mid-transition. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.10) 100%)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, color: "#cc4141", letterSpacing: 2, marginBottom: 24 }}>SSW.RULES</div>
        {/* Longest real title is 107 chars - clamp so it can't push the byline off-card */}
        <div style={{ fontSize: isHub ? 72 : 54, fontWeight: 700, color: "#111", lineHeight: 1.15, display: "block", lineClamp: 3 }}>{title}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        {/* Left: contributors. Deliberately empty when a page has no authors - categories,
            the home page, and the 235 rules with no author list. */}
        {shown.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexShrink: 0 }}>
              {avatars.map((src, i) => (
                <Avatar key={shown[i].url ?? i} src={src} index={i} total={faceCount} />
              ))}
              {extra > 0 ? <ExtraChip count={extra} /> : null}
            </div>
            <div style={{ fontSize: FOOTER_SIZE, color: "#555", marginLeft: 22, flexShrink: 0 }}>
              {`${authorCount} ${authorCount === 1 ? "contributor" : "contributors"}`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}

        {/* Right: site-wide totals, on every card */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {totalRules ? <div style={{ fontSize: FOOTER_SIZE, color: "#888" }}>{`${totalRules.toLocaleString("en-AU")} rules`}</div> : null}
          {totalRules ? <div style={{ fontSize: FOOTER_SIZE, color: "#c4c4c4", marginLeft: 20, marginRight: 20 }}>|</div> : null}
          <div style={{ fontSize: FOOTER_SIZE, color: "#666" }}>ssw.com.au/rules</div>
        </div>
      </div>
    </div>
  );
}
