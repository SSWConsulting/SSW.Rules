import { render, screen } from "@testing-library/react";
import ServerCategoryPage from "@/app/[filename]/ServerCategoryPage";
import ServerRulePage from "@/app/[filename]/ServerRulePage";
import { BoxEmbed } from "@/components/embeds/boxEmbed";
import { EmailEmbed } from "@/components/embeds/emailEmbed";
import HelpImproveCard from "@/components/HelpImproveCard";
import RuleListItem from "@/components/rule-list/rule-list-item";
import WhyRulesCard from "@/components/WhyRulesCard";
import { RuleListFilter } from "@/types/ruleListFilter";

// TinaMarkdown shows an image in a table cell with its default components, so these tests look at the content that it gets
jest.mock("tinacms/dist/rich-text", () => ({
  TinaMarkdown: ({ content }: { content: unknown }) => <pre data-testid="content">{JSON.stringify(content)}</pre>,
}));
jest.mock("tinacms/dist/react", () => ({ tinaField: () => undefined }));
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock("next/image", () => ({ __esModule: true, default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));
jest.mock("@/components/tina-markdown/markdown-component-mapping", () => ({ __esModule: true, default: {}, getMarkdownComponentMapping: () => ({}) }));
jest.mock("@/components/hooks/useAdminBackBlock", () => ({ useAdminBackBlock: () => undefined }));
jest.mock("@/components/hooks/useIsAdminPage", () => ({ useIsAdminPage: () => ({ isAdmin: false, isLoading: false }) }));

// The parts of the page that do not show a Tina image. A function declaration is available when Jest runs the mocks.
function mockEmptyComponent() {
  return { __esModule: true, default: () => null };
}
jest.mock("@/components/AuthorsCard", () => mockEmptyComponent());
jest.mock("@/components/Breadcrumbs", () => mockEmptyComponent());
jest.mock("@/components/BrokenReferenceBanner", () => mockEmptyComponent());
jest.mock("@/components/CategoriesCard", () => mockEmptyComponent());
jest.mock("@/components/CategoryEdit", () => ({ CategoryEdit: () => null }));
jest.mock("@/components/Discussion", () => mockEmptyComponent());
jest.mock("@/components/HelpCard", () => mockEmptyComponent());
jest.mock("@/components/last-updated-by", () => mockEmptyComponent());
jest.mock("@/components/RelatedRulesCard", () => mockEmptyComponent());
jest.mock("@/components/RuleActionButtons", () => mockEmptyComponent());
jest.mock("@/components/rule-list/rule-list", () => mockEmptyComponent());
jest.mock("@/components/rule-list/rule-list-item-header", () => mockEmptyComponent());
jest.mock("@/components/shared/SocialVideoEmbed", () => ({ SocialVideoEmbed: () => null }));

const CLIENT_ID = "00000000-0000-0000-0000-000000000000";
const STORED = "/uploads/rules/my-rule/image.png";
const CLOUD = `https://assets.tina.io/${CLIENT_ID}/rules/my-rule/image.png`;

const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv, NEXT_PUBLIC_TINA_CLIENT_ID: CLIENT_ID };
});

afterAll(() => {
  process.env = savedEnv;
});

const text = (value: string) => ({ type: "text", text: value });
const image = (url: string) => ({ type: "img", url, alt: "Example", children: [text("")] });
const bodyWithTable = (url: string) => ({
  type: "root",
  children: [
    { type: "p", children: [text("Intro")] },
    { type: "mdxJsxFlowElement", name: "endIntro", children: [text("")], props: {} },
    { type: "table", children: [{ type: "tr", children: [{ type: "td", children: [{ type: "p", children: [image(url)] }] }] }] },
  ],
});
const textWithImage = (url: string) => ({ type: "root", children: [{ type: "p", children: [text("Text"), image(url)] }] });
const shownContent = () => JSON.parse(screen.getByTestId("content").textContent ?? "null");

describe("ServerRulePage", () => {
  const renderPage = (rule: object) =>
    render(<ServerRulePage tinaProps={{ data: { rule: { title: "Do you test?", uri: "my-rule", ...rule } } }} serverRulePageProps={{ rule: {} }} />);

  it("gives the TinaCloud URL of an image in a table to TinaMarkdown", () => {
    renderPage({ body: bodyWithTable(STORED) });
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });

  it("does not change a body from TinaCloud", () => {
    renderPage({ body: bodyWithTable(CLOUD) });
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });

  it("shows the thumbnail with the same URL for the two data sources", () => {
    renderPage({ thumbnail: STORED });
    expect(screen.getByAltText("thumbnail image for the rule")).toHaveAttribute("src", CLOUD);
    document.body.innerHTML = "";

    renderPage({ thumbnail: CLOUD });
    expect(screen.getByAltText("thumbnail image for the rule")).toHaveAttribute("src", CLOUD);
  });
});

describe("ServerCategoryPage", () => {
  const renderPage = (body: object) => render(<ServerCategoryPage category={{ title: "Rules to Better Testing", body, index: [] }} />);

  it("gives the TinaCloud URL of an image in a table to TinaMarkdown", () => {
    renderPage(bodyWithTable(STORED));
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });

  it("does not change a body from TinaCloud", () => {
    renderPage(bodyWithTable(CLOUD));
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });
});

describe("RuleListItem", () => {
  const renderItem = (body: object, filter: RuleListFilter) =>
    render(
      <ul>
        <RuleListItem rule={{ title: "Do you test?", uri: "my-rule", body }} index={0} filter={filter} />
      </ul>
    );

  it("gives the TinaCloud URL of an image in a table to TinaMarkdown", () => {
    renderItem(bodyWithTable(STORED), RuleListFilter.All);
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });

  it("does not change a body from TinaCloud", () => {
    renderItem(bodyWithTable(CLOUD), RuleListFilter.All);
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });

  it("gives only the intro to TinaMarkdown in the blurb view", () => {
    renderItem(bodyWithTable(STORED), RuleListFilter.Blurb);
    expect(shownContent()).toEqual({ type: "root", children: [{ type: "p", children: [text("Intro")] }] });
  });
});

// These cards give only some components to TinaMarkdown, so it shows an image with its default component
describe("homepage cards", () => {
  it("gives the TinaCloud URL of an image in the quote to TinaMarkdown", () => {
    render(<HelpImproveCard data={{ quote: textWithImage(STORED) }} />);
    expect(shownContent()).toEqual(textWithImage(CLOUD));
  });

  it("gives the TinaCloud URL of an image in the body to TinaMarkdown", () => {
    render(<WhyRulesCard data={{ body: textWithImage(STORED) }} />);
    expect(shownContent()).toEqual(textWithImage(CLOUD));
  });

  it("does not change content from TinaCloud", () => {
    render(<WhyRulesCard data={{ body: textWithImage(CLOUD) }} />);
    expect(shownContent()).toEqual(textWithImage(CLOUD));
  });
});

// An embed can get its body from a page that did not convert the content
describe("embeds with rich text", () => {
  it("gives the TinaCloud URL of an image in the body of a box to TinaMarkdown", () => {
    render(<BoxEmbed data={{ style: "info", body: bodyWithTable(STORED) }} />);
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });

  it("gives the TinaCloud URL of an image in the body of an email to TinaMarkdown", () => {
    render(<EmailEmbed data={{ shouldDisplayBody: true, body: bodyWithTable(STORED) }} />);
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });

  it("does not change a body from TinaCloud", () => {
    render(<BoxEmbed data={{ style: "info", body: bodyWithTable(CLOUD) }} />);
    expect(shownContent()).toEqual(bodyWithTable(CLOUD));
  });
});
