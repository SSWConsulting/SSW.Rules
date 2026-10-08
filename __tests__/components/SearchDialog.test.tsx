import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openSearch } from "@/components/search/openSearch";
import { SearchDialog } from "@/components/search/SearchDialog";
import { SearchTrigger } from "@/components/search/SearchTrigger";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

type Request = { indexName?: string; params?: { query?: string } };
type Rule = { slug: string; title: string };

const search = jest.fn();
jest.mock("@/lib/algoliaClient", () => ({ searchClient: { search: (requests: Request[]) => search(requests) } }));

function respondWith(rulesFor: (query: string) => Rule[]) {
  search.mockImplementation(async (requests: Request[]) => ({
    results: requests.map(({ indexName, params }) => {
      const query = params?.query ?? "";
      const hits = (query ? rulesFor(query) : []).map((rule) => ({
        objectID: rule.slug,
        ...rule,
        _highlightResult: { title: { value: rule.title, matchLevel: "none", matchedWords: [] } },
      }));
      return {
        index: indexName,
        hits,
        nbHits: hits.length,
        page: 0,
        nbPages: 1,
        hitsPerPage: 8,
        query,
        params: "",
        exhaustiveNbHits: true,
        processingTimeMS: 0,
      };
    }),
  }));
}

async function openAndType(text: string) {
  const user = userEvent.setup();
  render(<SearchDialog />);
  act(() => openSearch());
  const input = await screen.findByRole("combobox", { name: "Search rules" });
  await user.type(input, text);
  return { user, input };
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME = "rules-test";
  // Headless UI's combobox needs it, and jsdom doesn't have it.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  push.mockClear();
  search.mockReset();
  respondWith(() => [
    { slug: "over-the-shoulder", title: "Do you do over the shoulder reviews?" },
    { slug: "pull-request-templates", title: "Do you use pull request templates?" },
  ]);
});

describe("SearchDialog", () => {
  it("asks for more characters below the minimum query length", async () => {
    await openAndType("pu");
    expect(screen.getByText("Keep typing...")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("shows the spinner and no empty-result message while a search is pending", async () => {
    let finish: () => void = () => {};
    search.mockImplementation((requests: Request[]) =>
      requests.every((request) => !request.params?.query)
        ? Promise.resolve({ results: requests.map(() => ({ hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage: 8, query: "", params: "" })) })
        : new Promise((resolve) => {
            finish = () => resolve({ results: requests.map(() => ({ hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage: 8, query: "pul", params: "" })) });
          })
    );
    await openAndType("pul");
    expect(screen.getByRole("status", { name: "Searching" })).toBeInTheDocument();
    expect(screen.queryByText(/No rules match/)).not.toBeInTheDocument();
    act(() => finish());
  });

  it("says no rules match when the search returns nothing", async () => {
    respondWith(() => []);
    await openAndType("zzzz");
    expect(await screen.findByText(/No rules match/)).toHaveTextContent("No rules match “zzzz”.");
  });

  it("shows an error instead of an empty result when the search fails", async () => {
    search.mockImplementation((requests: Request[]) =>
      requests.every((request) => !request.params?.query)
        ? Promise.resolve({ results: requests.map(() => ({ hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage: 8, query: "", params: "" })) })
        : Promise.reject(new Error("Rate limit exceeded. Please try again later."))
    );
    await openAndType("pull");
    expect(await screen.findByRole("alert")).toHaveTextContent("Search is unavailable right now. Try again in a minute.");
    expect(screen.queryByText(/No rules match/)).not.toBeInTheDocument();
  });

  it("opens the highlighted rule on Enter", async () => {
    const { user } = await openAndType("pull");
    await screen.findByRole("option", { name: /over the shoulder/ });
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/over-the-shoulder");
  });

  it("goes to the full search page from the last row", async () => {
    const { user } = await openAndType("pull request");
    await screen.findByRole("option", { name: /over the shoulder/ });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/search?keyword=pull%20request");
  });

  it("clears the query when closed with the keyboard shortcut, as it does with Esc", async () => {
    const { user } = await openAndType("pull");
    await user.keyboard("{Meta>}k{/Meta}");
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    act(() => openSearch());
    expect(await screen.findByRole("combobox", { name: "Search rules" })).toHaveValue("");
  });
});

describe("SearchTrigger", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME = "rules-test";
  });

  it("is hidden when search isn't configured, since the dialog can't open", () => {
    delete process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME;
    render(<SearchTrigger />);
    expect(screen.queryByRole("button", { name: "Search rules" })).not.toBeInTheDocument();
  });

  it("opens the search dialog", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SearchTrigger />
        <SearchDialog />
      </>
    );
    await user.click(screen.getByRole("button", { name: "Search rules" }));
    expect(await screen.findByRole("combobox", { name: "Search rules" })).toBeInTheDocument();
  });
});
