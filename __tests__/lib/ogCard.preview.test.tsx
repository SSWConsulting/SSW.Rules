/**
 * @jest-environment node
 *
 * Renders the real cards to PNGs so they can be eyeballed. Hits the network for author
 * photos, so it is opt-in and skipped by default:
 *
 *   pnpm verify:og            -> ./og-preview
 *   OG_PREVIEW_DIR=~/tmp pnpm verify:og
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE } from "@/lib/og/card";
import { loadFonts } from "@/lib/og/images";

const outDir = process.env.OG_PREVIEW_DIR;
const P = (title: string, slug: string) => ({ title, url: `https://www.ssw.com.au/people/${slug}` });
const TOTAL = 3802;

const cases: Record<string, Parameters<typeof buildOgCard>[0]> = {
  "1-single-author": {
    title: "Do you know when to change the email subject (or appointment subject)?",
    authors: [P("Adam Cogan", "adam-cogan")],
    totalRules: TOTAL,
  },
  // Igor's photo is a PNG named .jpg - regression case for the magic-byte sniffing
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
  "3-no-authors": { title: "Do you know the rules to better unit tests?", authors: [], totalRules: TOTAL },
  "4-longest-content": {
    title: "Do you create a Sprint Forecast email 📩? (aka Functionality to be developed per Sprint Planning)",
    authors: [P("Christian Morford-Waite", "christian-morford-waite"), P("Sebastien Boissiere", "sebastien-boissiere"), P("Kosta Madorsky", "kosta-madorsky")],
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

(outDir ? describe : describe.skip)("OG card preview", () => {
  jest.setTimeout(60_000);

  it.each(Object.keys(cases))("renders %s", async (name) => {
    await mkdir(outDir as string, { recursive: true });
    const res = new ImageResponse(await buildOgCard(cases[name]), { ...OG_SIZE, fonts: await loadFonts() });
    const png = Buffer.from(await res.arrayBuffer());
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await writeFile(path.join(outDir as string, `${name}.png`), png);
  });
});
