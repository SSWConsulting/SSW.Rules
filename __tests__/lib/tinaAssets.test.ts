import { tinaImageSrc, toTinaAssetUrl, withTinaImageSrc } from "@/lib/tinaAssets";

const CLIENT_ID = "00000000-0000-0000-0000-000000000000";
const ASSETS = `https://assets.tina.io/${CLIENT_ID}`;

const savedEnv = { ...process.env };
// NODE_ENV is read-only in the Next.js types
const env = () => process.env as Record<string, string | undefined>;

beforeEach(() => {
  process.env = { ...savedEnv, NEXT_PUBLIC_TINA_CLIENT_ID: CLIENT_ID };
});

afterAll(() => {
  process.env = savedEnv;
});

// The values that TinaCloud and the local Tina server return in the same form
const UNCHANGED = [
  ["a TinaCloud asset URL", `${ASSETS}/rules/my-rule/image.png`],
  ["an asset URL of a different Tina project", "https://assets.tina.io/11111111-1111-1111-1111-111111111111/rules/my-rule/file.pdf"],
  ["an external URL", "https://github.com/user-attachments/assets/9b67be39-50ee-4563-ab4f-0e273613788c"],
  ["an http URL", "http://example.com/uploads/image.png"],
  ["a protocol-relative URL", "//example.com/uploads/image.png"],
  ["a data URI", "data:image/png;base64,iVBORw0KGgo="],
  ["an anchor", "#uploads"],
  ["an empty value", ""],
  ["a link to a rule", "/my-rule"],
  ["a path that is not below the media root", "/images/uploads/image.png"],
  ["a path without the first slash", "uploads/rules/my-rule/image.png"],
  ["a file name", "image.png"],
  ["the media root with no file", "/uploads"],
  ["a folder name that only starts with the media root", "/uploadsfolder/image.png"],
] as const;

describe("toTinaAssetUrl", () => {
  it("gives the TinaCloud URL for a path of the media library", () => {
    expect(toTinaAssetUrl("/uploads/rules/my-rule/image.png")).toBe(`${ASSETS}/rules/my-rule/image.png`);
    expect(toTinaAssetUrl("/uploads/categories/image.png")).toBe(`${ASSETS}/categories/image.png`);
    expect(toTinaAssetUrl("/uploads/rules/my-rule/file.pdf")).toBe(`${ASSETS}/rules/my-rule/file.pdf`);
  });

  it("keeps the part after the media root as it is", () => {
    expect(toTinaAssetUrl("/uploads/rules/my-rule/Image (2).jpeg")).toBe(`${ASSETS}/rules/my-rule/Image (2).jpeg`);
    expect(toTinaAssetUrl("/uploads/rules/my-rule/Screenshot%202026-02-05,%20at%204.12.png")).toBe(
      `${ASSETS}/rules/my-rule/Screenshot%202026-02-05,%20at%204.12.png`
    );
    expect(toTinaAssetUrl("/uploads/__staging/tina/my-branch/__file/rules/my-rule/image.jpg")).toBe(
      `${ASSETS}/__staging/tina/my-branch/__file/rules/my-rule/image.jpg`
    );
    expect(toTinaAssetUrl("/uploads/rules/uploads/image.png")).toBe(`${ASSETS}/rules/uploads/image.png`);
  });

  it("gives the external URL when the media root is in front of it", () => {
    expect(toTinaAssetUrl("/uploadshttps://github.com/user-attachments/assets/9b67be39")).toBe("https://github.com/user-attachments/assets/9b67be39");
  });

  it.each(UNCHANGED)("does not change %s", (_name, value) => {
    expect(toTinaAssetUrl(value)).toBe(value);
  });

  it("does not change a value that is not text", () => {
    const content = { type: "root", children: [] };
    expect(toTinaAssetUrl(undefined)).toBeUndefined();
    expect(toTinaAssetUrl(null)).toBeNull();
    expect(toTinaAssetUrl(content)).toBe(content);
  });

  it("does not change a path when the client ID is not set", () => {
    delete process.env.NEXT_PUBLIC_TINA_CLIENT_ID;
    expect(toTinaAssetUrl("/uploads/rules/my-rule/image.png")).toBe("/uploads/rules/my-rule/image.png");
  });

  it("gives the same URL in development", () => {
    env().NODE_ENV = "development";
    expect(toTinaAssetUrl("/uploads/rules/my-rule/file.pdf")).toBe(`${ASSETS}/rules/my-rule/file.pdf`);
  });
});

describe("tinaImageSrc", () => {
  it.each(["production", "test"])("gives the TinaCloud URL for a path of the media library when NODE_ENV is %s", (nodeEnv) => {
    env().NODE_ENV = nodeEnv;
    expect(tinaImageSrc("/uploads/rules/my-rule/image.png")).toBe(`${ASSETS}/rules/my-rule/image.png`);
    expect(tinaImageSrc("/uploadshttps://github.com/user-attachments/assets/9b67be39")).toBe("https://github.com/user-attachments/assets/9b67be39");
  });

  it.each(UNCHANGED)("does not change %s", (_name, value) => {
    expect(tinaImageSrc(value)).toBe(value);
  });

  it("does not change a missing value", () => {
    expect(tinaImageSrc(undefined)).toBeUndefined();
    expect(tinaImageSrc(null)).toBeNull();
  });

  it("keeps the stored path in development, where the development server serves it", () => {
    env().NODE_ENV = "development";
    expect(tinaImageSrc("/uploads/rules/my-rule/image.png")).toBe("/uploads/rules/my-rule/image.png");
    expect(tinaImageSrc(`${ASSETS}/rules/my-rule/image.png`)).toBe(`${ASSETS}/rules/my-rule/image.png`);
  });
});

describe("withTinaImageSrc", () => {
  const text = (value: string) => ({ type: "text", text: value });
  const image = (url: string) => ({ type: "img", url, alt: "Example", children: [text("")] });
  const paragraph = (...children: object[]) => ({ type: "p", children });
  const body = (...children: object[]) => ({ type: "root", children });
  const table = (cell: object) => ({ type: "table", children: [{ type: "tr", children: [{ type: "td", children: [paragraph(cell)] }] }] });
  const box = (content: object) => ({ type: "mdxJsxFlowElement", name: "boxEmbed", children: [text("")], props: { style: "info", body: content } });

  const STORED = "/uploads/rules/my-rule/image.png";
  const CLOUD = `${ASSETS}/rules/my-rule/image.png`;

  it("converts the URL of a markdown image", () => {
    expect(withTinaImageSrc(body(paragraph(text("Intro"), image(STORED))))).toEqual(body(paragraph(text("Intro"), image(CLOUD))));
  });

  it("converts the URL of a markdown image in a table cell", () => {
    expect(withTinaImageSrc(body(table(image(STORED))))).toEqual(body(table(image(CLOUD))));
  });

  it("converts the URL of a markdown image in the body of an embed", () => {
    expect(withTinaImageSrc(body(box(body(table(image(STORED))))))).toEqual(body(box(body(table(image(CLOUD))))));
  });

  it("does not change the input", () => {
    const content = body(paragraph(image(STORED)));
    withTinaImageSrc(content);
    expect(content).toEqual(body(paragraph(image(STORED))));
  });

  it("does not change a value that is not the URL of a markdown image", () => {
    const content = body(
      paragraph({ type: "a", url: "/uploads/rules/my-rule/file.pdf", children: [text("File")] }),
      { type: "mdxJsxFlowElement", name: "imageEmbed", children: [text("")], props: { src: STORED, url: STORED } },
      { type: "mdxJsxFlowElement", name: "youtubeEmbed", children: [text("")], props: { url: STORED } }
    );
    expect(withTinaImageSrc(content)).toBe(content);
  });

  it("gives the same object for content from TinaCloud", () => {
    const content = body(paragraph(image(CLOUD)), table(image("https://example.com/image.png")));
    expect(withTinaImageSrc(content)).toBe(content);
  });

  it("gives the same object in development", () => {
    env().NODE_ENV = "development";
    const content = body(table(image(STORED)));
    expect(withTinaImageSrc(content)).toBe(content);
  });

  it("does not change content that is not an object", () => {
    expect(withTinaImageSrc("Text with /uploads/rules/my-rule/image.png")).toBe("Text with /uploads/rules/my-rule/image.png");
    expect(withTinaImageSrc(undefined)).toBeUndefined();
    expect(withTinaImageSrc(null)).toBeNull();
  });
});
