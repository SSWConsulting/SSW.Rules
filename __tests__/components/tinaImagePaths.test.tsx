import { render, screen } from "@testing-library/react";
import { ImageEmbed } from "@/components/embeds/imageEmbed";
import { typographyComponents } from "@/components/typography-components";

jest.mock("next/link", () => jest.fn(({ prefetch, ...props }) => <a {...props} />));
// Jest cannot load these two modules, and no test here shows a code block or a diagram
jest.mock("tinacms/dist/rich-text/prism", () => ({ Prism: () => null }));
jest.mock("@/components/mermaid/MermaidElement", () => ({ __esModule: true, default: () => null }));

const CLIENT_ID = "00000000-0000-0000-0000-000000000000";
const ASSETS = `https://assets.tina.io/${CLIENT_ID}`;

const savedEnv = { ...process.env };
// NODE_ENV is read-only in the Next.js types
const env = () => process.env as Record<string, string | undefined>;

beforeEach(() => {
  process.env = { ...savedEnv, NEXT_PUBLIC_TINA_CLIENT_ID: CLIENT_ID, NEXT_PUBLIC_BASE_PATH: "/rules" };
});

afterAll(() => {
  process.env = savedEnv;
});

// Each pair is the value from TinaCloud and the value from the local Tina server for the same content
const IMAGE_VALUES = [
  ["a media library image", `${ASSETS}/rules/my-rule/image.png`, "/uploads/rules/my-rule/image.png"],
  ["a category image", `${ASSETS}/categories/image.png`, "/uploads/categories/image.png"],
  ["a file name with special characters", `${ASSETS}/rules/my-rule/Image (2).jpeg`, "/uploads/rules/my-rule/Image (2).jpeg"],
  ["an external image", "https://images.unsplash.com/photo-1", "https://images.unsplash.com/photo-1"],
  [
    "an external URL behind the media root",
    "https://github.com/user-attachments/assets/9b67be39",
    "/uploadshttps://github.com/user-attachments/assets/9b67be39",
  ],
] as const;

describe("ImageEmbed", () => {
  const renderEmbed = (src: string) => render(<ImageEmbed data={{ src, alt: "Example", size: "large" }} />);

  it.each(IMAGE_VALUES)("shows the same URL for %s from the two data sources", (_name, fromTinaCloud, fromLocalServer) => {
    renderEmbed(fromTinaCloud);
    expect(screen.getByRole("img")).toHaveAttribute("src", fromTinaCloud);
    document.body.innerHTML = "";

    renderEmbed(fromLocalServer);
    expect(screen.getByRole("img")).toHaveAttribute("src", fromTinaCloud);
  });

  it("keeps the stored path in development", () => {
    env().NODE_ENV = "development";
    renderEmbed("/uploads/rules/my-rule/image.png");
    expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/rules/my-rule/image.png");
  });
});

describe("markdown image", () => {
  const Img = typographyComponents.img;

  it.each(IMAGE_VALUES)("shows the same URL for %s from the two data sources", (_name, fromTinaCloud, fromLocalServer) => {
    render(<Img url={fromTinaCloud} alt="Example" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", fromTinaCloud);
    document.body.innerHTML = "";

    render(<Img url={fromLocalServer} alt="Example" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", fromTinaCloud);
  });

  it("adds the base path to a path that is not in the media library", () => {
    render(<Img url="/images/diagram.png" alt="Example" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/rules/images/diagram.png");
  });

  it("keeps the stored path below the base path in development", () => {
    env().NODE_ENV = "development";
    render(<Img url="/uploads/rules/my-rule/image.png" alt="Example" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/rules/uploads/rules/my-rule/image.png");
  });
});

describe("markdown link", () => {
  const A = typographyComponents.a;

  it("links a file of the media library to TinaCloud and sets the download name", () => {
    render(<A url="/uploads/rules/my-rule/Checklist.pdf">Checklist</A>);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `${ASSETS}/rules/my-rule/Checklist.pdf`);
    expect(link).toHaveAttribute("download", "Checklist.pdf");
  });

  it("gives the same link in development", () => {
    env().NODE_ENV = "development";
    render(<A url="/uploads/rules/my-rule/Checklist.pdf">Checklist</A>);
    expect(screen.getByRole("link")).toHaveAttribute("href", `${ASSETS}/rules/my-rule/Checklist.pdf`);
  });

  it("does not change the link when the client ID is not set", () => {
    delete process.env.NEXT_PUBLIC_TINA_CLIENT_ID;
    render(<A url="/uploads/rules/my-rule/Checklist.pdf">Checklist</A>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/uploads/rules/my-rule/Checklist.pdf");
  });

  it.each([
    ["a link to a rule", "/my-rule"],
    ["a file type that is not a download", "/uploads/rules/my-rule/image.png"],
    ["a file that is not in a rule folder", "/uploads/categories/Checklist.pdf"],
  ])("does not change %s", (_name, url) => {
    render(<A url={url}>Link</A>);
    expect(screen.getByRole("link")).toHaveAttribute("href", url);
  });

  it("does not change an absolute link to a file", () => {
    const url = "https://assets.tina.io/11111111-1111-1111-1111-111111111111/rules/my-rule/Sample.pdf";
    render(<A url={url}>Sample</A>);
    expect(screen.getByRole("link")).toHaveAttribute("href", url);
  });
});
