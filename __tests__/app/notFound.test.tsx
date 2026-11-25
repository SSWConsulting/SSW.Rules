import { render, screen } from "@testing-library/react";

const getCategoryData = jest.fn();
const getRuleData = jest.fn();
const isAdminPage = jest.fn();
const pathname = jest.fn();

jest.mock("@/app/[filename]/pageData", () => ({
  getCategoryData: (...args: unknown[]) => getCategoryData(...args),
  getRuleData: (...args: unknown[]) => getRuleData(...args),
}));
jest.mock("@/tina/__generated__/client", () => ({ __esModule: true, default: { queries: {} } }));
// prepare:content writes this file, and CI does not run it
jest.mock(`${process.cwd()}/category-uri-title-map.json`, () => ({ categories: {} }), { virtual: true });
jest.mock("@/lib/services/github/giscusDiscussions.service", () => ({ getDiscussionNumberForGuid: async () => null }));
jest.mock("@/app/[filename]/TinaRuleWrapper", () => ({ TinaRuleWrapper: () => <p>rule page</p> }));
jest.mock("@/app/[filename]/TinaCategoryWrapper", () => ({ TinaCategoryWrapper: () => <p>category page</p> }));
jest.mock("@/app/[filename]/ClientFallbackPage", () => ({
  __esModule: true,
  default: ({ filename }: { filename: string }) => <p>branch preview of {filename}</p>,
}));
jest.mock("@/components/hooks/useIsAdminPage", () => ({ useIsAdminPage: () => isAdminPage() }));
jest.mock("next/navigation", () => ({
  ...jest.requireActual("next/navigation"),
  usePathname: () => pathname(),
}));
jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children }: any) => <a href={href}>{children}</a> }));

import NotFoundOrBranchPreview, { filenameFromPath } from "@/app/[filename]/NotFoundOrBranchPreview";
import Page from "@/app/[filename]/page";

const params = (filename: string) => ({ params: Promise.resolve({ filename }) });

describe("[filename] page", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("returns a 404 when there is no category and no rule", async () => {
    getCategoryData.mockResolvedValue(null);
    getRuleData.mockResolvedValue(null);

    await expect(Page(params("not-a-rule"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("renders a rule that exists", async () => {
    getCategoryData.mockResolvedValue(null);
    getRuleData.mockResolvedValue({ data: { rule: { guid: "abc" } }, brokenReferences: null });

    render(await Page(params("hard-tasks-first")));

    expect(screen.getByText("rule page")).toBeInTheDocument();
  });
});

describe("NotFoundOrBranchPreview", () => {
  it("shows the 404 page to visitors", () => {
    pathname.mockReturnValue("/not-a-rule");
    isAdminPage.mockReturnValue({ isAdmin: false, isLoading: false });

    render(<NotFoundOrBranchPreview />);

    expect(screen.getByText(/NOT FOUND!/)).toBeInTheDocument();
    expect(screen.queryByText(/branch preview/)).not.toBeInTheDocument();
  });

  it("shows the 404 page until the Tina editor check is done", () => {
    pathname.mockReturnValue("/new-rule-on-branch");
    isAdminPage.mockReturnValue({ isAdmin: false, isLoading: true });

    render(<NotFoundOrBranchPreview />);

    expect(screen.getByText(/NOT FOUND!/)).toBeInTheDocument();
  });

  it("loads the page from the editor's branch inside the Tina editor", () => {
    pathname.mockReturnValue("/new-rule-on-branch");
    isAdminPage.mockReturnValue({ isAdmin: true, isLoading: false });

    render(<NotFoundOrBranchPreview />);

    expect(screen.getByText("branch preview of new-rule-on-branch")).toBeInTheDocument();
  });

  it("does not preview a path deeper than one segment", () => {
    pathname.mockReturnValue("/user/someone");
    isAdminPage.mockReturnValue({ isAdmin: true, isLoading: false });

    render(<NotFoundOrBranchPreview />);

    expect(screen.getByText(/NOT FOUND!/)).toBeInTheDocument();
  });

  it.each([
    ["/hard-tasks-first", "hard-tasks-first"],
    ["/hard-tasks-first/", "hard-tasks-first"],
    ["/user/someone", null],
    ["/", null],
    [null, null],
  ])("reads the filename from %p", (path, expected) => {
    expect(filenameFromPath(path)).toBe(expected);
  });
});
