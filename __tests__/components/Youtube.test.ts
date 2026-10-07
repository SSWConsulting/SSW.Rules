import { render } from "@testing-library/react";
import { createElement } from "react";
import { buildYoutubeEmbedUrl, extractYoutubeStart, YouTubePlayer } from "@/components/shared/Youtube";

describe("extractYoutubeStart", () => {
  it.each([
    // YouTube's Share button format
    ["https://youtu.be/1clWprLC5Ak?si=cshOVJLPEJeVMR6t&t=31", 31],
    ["https://youtu.be/oPyTZ-HGdn4?t=2141", 2141],
    ["https://youtu.be/mDGmCN_ftcA?si=1FFh8XyKBZrK28fX&t=93", 93],
    ["https://www.youtube.com/embed/7yty_Abk7uw?start=4461", 4461],
    ["https://www.youtube.com/embed/0ugMkda9IBw?t=7s", 7],
    ["https://www.youtube.com/watch?v=rC1TV0_sIrM&t=807s", 807],
    ["https://www.youtube.com/watch?v=8lSntwhn4uI?t=26", 26],
    ["https://www.youtube.com/watch?v=rC1TV0_sIrM&time_continue=15", 15],
    ["https://youtu.be/rC1TV0_sIrM#t=45", 45],
    ["https://youtu.be/rC1TV0_sIrM?t=1h2m3s", 3723],
    ["https://youtu.be/rC1TV0_sIrM?t=2m30s", 150],
    ["https://youtu.be/rC1TV0_sIrM?t=1h", 3600],
  ])("parses %s", (url, expected) => {
    expect(extractYoutubeStart(url)).toBe(expected);
  });

  it.each([
    ["bare id", "dQw4w9WgXcQ"],
    ["watch without time", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["youtu.be without time", "https://youtu.be/dQw4w9WgXcQ"],
    ["embed without time", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["shorts without time", "https://www.youtube.com/shorts/dQw4w9WgXcQ"],
    ["t=0", "https://youtu.be/dQw4w9WgXcQ?t=0"],
    ["t=0s", "https://youtu.be/dQw4w9WgXcQ?t=0s"],
    ["garbage", "https://youtu.be/dQw4w9WgXcQ?t=abc"],
    ["negative", "https://youtu.be/dQw4w9WgXcQ?t=-5"],
    ["empty t", "https://youtu.be/dQw4w9WgXcQ?t="],
    ["empty", ""],
  ])("returns null for %s", (_name, url) => {
    expect(extractYoutubeStart(url)).toBeNull();
  });
});

describe("buildYoutubeEmbedUrl", () => {
  it("adds start when set", () => {
    expect(buildYoutubeEmbedUrl("dQw4w9WgXcQ", 93)).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?start=93");
  });
  it("omits start when null", () => {
    expect(buildYoutubeEmbedUrl("dQw4w9WgXcQ", null)).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
});

describe("YouTubePlayer", () => {
  it("renders iframe with start from the URL", () => {
    const { container } = render(createElement(YouTubePlayer, { url: "https://youtu.be/dQw4w9WgXcQ?t=93" }));
    expect(container.querySelector("iframe")?.getAttribute("src")).toMatch(/\/embed\/dQw4w9WgXcQ\?start=93$/);
  });
  it("renders iframe without query when no timestamp", () => {
    const { container } = render(createElement(YouTubePlayer, { url: "https://youtu.be/dQw4w9WgXcQ" }));
    expect(container.querySelector("iframe")?.getAttribute("src")).not.toContain("?");
  });
});
