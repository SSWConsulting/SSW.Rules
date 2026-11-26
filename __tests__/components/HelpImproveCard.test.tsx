import { render, screen } from "@testing-library/react";
import HelpImproveCard from "@/components/HelpImproveCard";

// The tinacms packages are ESM, which Jest does not transform
jest.mock("tinacms/dist/react", () => ({ tinaField: () => undefined }));
jest.mock("tinacms/dist/rich-text", () => ({
  TinaMarkdown: ({ content }: { content: any }) => <span>{JSON.stringify(content).match(/"text":"([^"]*)"/)?.[1]}</span>,
}));

describe("HelpImproveCard", () => {
  it("shows the fallback quote when no Tina data is passed", () => {
    render(<HelpImproveCard />);

    expect(screen.getByText(/works just like Wikipedia/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "tweet me" })).toHaveAttribute("href", "https://twitter.com/adamcogan");
  });

  it("shows the quote from Tina when it is passed", () => {
    const quote = {
      type: "root",
      children: [{ type: "p", children: [{ type: "text", text: "Quote from Tina" }] }],
    };

    render(<HelpImproveCard data={{ quote }} />);

    expect(screen.getByText("Quote from Tina")).toBeInTheDocument();
    expect(screen.queryByText(/works just like Wikipedia/)).not.toBeInTheDocument();
  });
});
