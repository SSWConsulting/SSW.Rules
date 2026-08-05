import { readFile } from "node:fs/promises";
import path from "node:path";
import { profileImageUrl } from "@/lib/authorImage";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const MAX_FACES = 2; // 78% of rules have <= 2 authors; the rest get a "+N more"
const OVERLAP = 16;
const AVATAR = 96;

const COUNT_SIZE = 56;
const COUNT_LABEL_SIZE = 30;
/**
 * Satori's `alignItems: "baseline"` aligns line boxes, not text baselines, so the
 * smaller label lands low against the count. With `lineHeight: 1` on both and
 * flex-end, the remaining gap is the descender difference between the two sizes.
 * Measured from a render, not guessed - scripts/og-verify.mjs regenerates the case.
 */
const COUNT_LABEL_NUDGE = Math.round((COUNT_SIZE - COUNT_LABEL_SIZE) * 0.115);

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
 * Builds the shared Open Graph card. Callers pass already-resolved data so this stays
 * synchronous-ish and testable; use `resolveOgCard` to gather the images first.
 */
export async function OgCard({ title, authors = [], ruleCount }: { title: string; authors?: OgAuthor[]; ruleCount?: number }) {
  // Categories and the home page sit above individual rules, so they get a heavier
  // treatment: a larger title (their titles are shorter - longest category is 62 chars
  // against 107 for a rule) and the rule count in place of the author byline.
  const isHub = ruleCount !== undefined;
  const shown = authors.filter((a) => a?.title).slice(0, MAX_FACES);
  const extra = authors.length - shown.length;

  const [polygon, avatars] = await Promise.all([loadPolygon(), Promise.all(shown.map(loadAvatar))]);

  // Author names are content data and can be long - the longest real pair is 52 chars.
  // Clamp them rather than trusting them to fit.
  const names = shown.map((a) => (a.title ?? "").trim()).join(", ");

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

      {shown.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", flexShrink: 0 }}>
            {avatars.map((src, i) => (
              <Avatar key={shown[i].url ?? i} src={src} index={i} total={shown.length} />
            ))}
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#555",
              marginLeft: 24,
              minWidth: 0,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {names}
          </div>
          {/* `extra && ...` would render a literal "0" when there are no extra authors.
              The label is one interpolated string, not `+{extra} more` - JSX would split
              that into three text nodes, and Satori rejects multi-child divs that are
              not explicitly display:flex. */}
          {extra > 0 ? <div style={{ fontSize: 30, color: "#999", marginLeft: 12, flexShrink: 0 }}>{`+${extra} more`}</div> : null}
        </div>
      ) : isHub ? (
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div style={{ fontSize: COUNT_SIZE, fontWeight: 700, color: "#cc4141", lineHeight: 1 }}>{ruleCount.toLocaleString("en-AU")}</div>
          <div style={{ fontSize: COUNT_LABEL_SIZE, color: "#555", marginLeft: 14, marginBottom: COUNT_LABEL_NUDGE, lineHeight: 1 }}>{ruleCount === 1 ? "rule" : "rules"}</div>
        </div>
      ) : (
        // 235 rules have no authors at all
        <div style={{ fontSize: 30, color: "#999" }}>ssw.com.au/rules</div>
      )}
    </div>
  );
}
