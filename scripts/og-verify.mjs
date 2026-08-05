/**
 * Renders components/og/card.tsx directly, bypassing Tina, so the Open Graph card can be
 * eyeballed without running the whole site. Covers the cases that actually broke during
 * development: multiple authors, no authors, over-long content, and unreadable photos.
 *
 *   node scripts/og-verify.mjs [outDir]     (default: ./og-preview)
 */
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og.js";

const outDir = process.argv[2] ?? "og-preview";
const build = path.join("scripts", ".og-card.build.mjs");

// card.tsx is TSX and imports via "@/" - bundle it before importing
execFileSync(
  "./node_modules/.bin/esbuild",
  [
    "components/og/card.tsx",
    "--bundle",
    "--format=esm",
    "--platform=node",
    "--jsx=automatic",
    "--external:react",
    "--external:react/jsx-runtime",
    `--outfile=${build}`,
    "--log-level=error",
  ],
  { stdio: "inherit" }
);

const { OgCard, OG_SIZE } = await import(`../${build}`);

const P = (title, slug) => ({ title, url: `https://www.ssw.com.au/people/${slug}` });

const TOTAL = 3802; // stand-in for fetchRuleCount()

const cases = {
  "1-single-author": {
    title: "Do you know when to change the email subject (or appointment subject)?",
    authors: [P("Adam Cogan", "adam-cogan")],
    totalRules: TOTAL,
  },
  // Igor's photo is a PNG named .jpg - regression case for the content-type sniffing
  "2-many-authors": {
    title: "Do you use the best tools for database schema changes?",
    authors: [
      P("Adam Cogan", "adam-cogan"),
      P("Igor Goldobin", "igor-goldobin"),
      P("Adam Stephensen", "adam-stephensen"),
      P("Thiago Passos", "thiago-passos"),
      P("Brendan Richards", "brendan-richards"),
    ],
    totalRules: TOTAL,
  },
  // 235 rules and every category page have no authors
  "3-no-authors": { title: "Do you know the rules to better unit tests?", authors: [], totalRules: TOTAL },
  // Longest real title (107 chars, with emoji) + longest real name pair (52 chars)
  "4-longest-content": {
    title: "Do you create a Sprint Forecast email 📩? (aka Functionality to be developed per Sprint Planning)",
    authors: [
      P("Christian Morford-Waite", "christian-morford-waite"),
      P("Sebastien Boissiere", "sebastien-boissiere"),
      P("Kosta Madorsky", "kosta-madorsky"),
      P("Camilla Rosa Silva", "camilla-rosa-silva"),
      P("Jerwin Parker Roberto", "jerwin-parker-roberto"),
    ],
    totalRules: TOTAL,
  },
  // Neither author has a profile photo - must fall back, not fail the image
  "5-missing-photos": {
    title: "Do you have a rule authored by someone with no profile photo?",
    authors: [P("Toby Goodman", "toby-goodman"), P("Ryan Tee", "ryan-tee")],
    totalRules: TOTAL,
  },
  "6-homepage": { title: "Secret Ingredients to Quality Software", totalRules: TOTAL, isHub: true },
  "7-category": { title: "Rules to Better Interfaces (Forms)", totalRules: TOTAL, isHub: true },
  "8-category-longest": { title: "Rules to Better User Acceptance Tests (UAT) for Bug Management", totalRules: TOTAL, isHub: true },
};

await mkdir(outDir, { recursive: true });

for (const [name, rule] of Object.entries(cases)) {
  const res = new ImageResponse(await OgCard(rule), OG_SIZE);
  const file = path.join(outDir, `${name}.png`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(`wrote ${file}`);
}

await rm(build, { force: true });
