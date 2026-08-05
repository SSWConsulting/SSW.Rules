import { loadAvatar, loadPolygon } from "@/lib/og/images";
import type { OgAuthor } from "@/lib/og/target";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const MAX_FACES = 2;
const OVERLAP = 16;
const AVATAR = 72;
const FOOTER_SIZE = 26;

// Satori renders standalone - no CSS runtime, no Tailwind, no access to styles.css -
// so the ssw-* classes cannot be used here. These are those tokens by value; keep them
// in step with styles.css.
const SSW_RED = "#cc4141"; // --color-ssw-red
const SSW_BLACK = "#333333"; // --color-ssw-black
const SSW_GRAY = "#797979"; // --color-ssw-gray
const RULE_LINE = "#c4c4c4";
const SURFACE = "#ffffff";

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
      background: SURFACE,
      fontSize: 24,
      fontWeight: 600,
      color: SSW_GRAY,
    }}
  >
    {`+${count}`}
  </div>
);

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
      // A white separator ring only works on a white background, so the photo behind
      // has a hole masked out of it and the polygon shows through the gap instead.
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

interface OgCardOptions {
  title: string;
  authors?: OgAuthor[];
  totalRules?: number;
  /** Categories and the home page get a larger title than individual rules. */
  isHub?: boolean;
}

/** Not a component: Satori cannot render async ones, so call sites await this. */
export async function buildOgCard({ title, authors = [], totalRules, isHub = false }: OgCardOptions) {
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
        background: SURFACE,
        padding: 64,
        fontFamily: "Nunito, sans-serif",
        position: "relative",
      }}
    >
      <img src={polygon} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />

      {/* Flattens the polygon behind the title, whose facet edges fight the letterforms
          at any contrast ratio. Separate from the scrim below because interpolating a
          white stop into a black one produces a grey haze mid-transition. */}
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
        <div style={{ fontSize: 28, color: SSW_RED, letterSpacing: 2, marginBottom: 24 }}>SSW.RULES</div>
        <div style={{ fontSize: isHub ? 72 : 54, fontWeight: 700, color: SSW_BLACK, lineHeight: 1.15, display: "block", lineClamp: 3 }}>{title}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        {shown.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexShrink: 0 }}>
              {avatars.map((src, i) => (
                <Avatar key={shown[i].url ?? i} src={src} index={i} total={faceCount} />
              ))}
              {extra > 0 ? <ExtraChip count={extra} /> : null}
            </div>
            <div style={{ fontSize: FOOTER_SIZE, color: SSW_GRAY, marginLeft: 22, flexShrink: 0 }}>
              {`${authorCount} ${authorCount === 1 ? "contributor" : "contributors"}`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}

        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {totalRules ? <div style={{ fontSize: FOOTER_SIZE, color: SSW_GRAY }}>{`${totalRules.toLocaleString("en-AU")} rules`}</div> : null}
          {totalRules ? <div style={{ fontSize: FOOTER_SIZE, color: RULE_LINE, marginLeft: 20, marginRight: 20 }}>|</div> : null}
          <div style={{ fontSize: FOOTER_SIZE, color: SSW_GRAY }}>ssw.com.au/rules</div>
        </div>
      </div>
    </div>
  );
}
