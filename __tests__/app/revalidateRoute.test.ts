/**
 * @jest-environment node
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { POST } from "@/app/api/revalidate/route";
import { GLOBAL_SETTINGS_TAG } from "@/lib/services/global";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn(), unstable_cache: (fn: unknown) => fn }));
jest.mock("@/tina/__generated__/client", () => ({ __esModule: true, default: { queries: {} } }));

const SECRET = "test-secret";

const send = (body: unknown, secret: string = SECRET) =>
  POST(
    new Request("http://localhost/api/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify(body),
    })
  );

const paths = () => (revalidatePath as jest.Mock).mock.calls.map(([path]) => path);
const tags = () => (revalidateTag as jest.Mock).mock.calls.map(([tag]) => tag);

describe("POST /api/revalidate", () => {
  const savedSecret = process.env.TINA_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TINA_WEBHOOK_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.TINA_WEBHOOK_SECRET = savedSecret;
  });

  it("rejects a request that has the wrong secret", async () => {
    const res = await send({ type: "content.modified", paths: ["global/index.json"] }, "wrong");

    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("ignores an event type that is not a content change", async () => {
    const res = await send({ type: "content.removed", paths: ["public/uploads/rules/a-rule/rule.mdx"] });

    expect(await res.json()).toMatchObject({ revalidated: false, ignored: true });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates only the page and the card of an edited rule", async () => {
    const res = await send({ type: "content.modified", paths: ["public/uploads/rules/3-steps-to-a-pbi/rule.mdx"] });

    expect(await res.json()).toEqual({ revalidated: true, routes: ["/3-steps-to-a-pbi", "/3-steps-to-a-pbi/opengraph-image"] });
    expect(paths()).toEqual(["/3-steps-to-a-pbi", "/3-steps-to-a-pbi/opengraph-image"]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("also revalidates the rule lists and the rule count for a new rule", async () => {
    await send({ type: "content.added", paths: ["public/uploads/rules/a-new-rule/rule.mdx"] });

    expect(paths()).toEqual(["/a-new-rule", "/a-new-rule/opengraph-image", "/api/rules"]);
    expect(revalidateTag).toHaveBeenCalledWith("latest-rules", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("rule-count", { expire: 0 });
  });

  it("revalidates the category page, the home page and the category data for an edited category", async () => {
    await send({ type: "content.modified", paths: ["categories/communication/rules-to-better-email.mdx"] });

    expect(paths()).toEqual(["/opengraph-image", "/", "/rules-to-better-email", "/rules-to-better-email/opengraph-image"]);
    expect(tags()).toEqual(["category-rule-data"]);
  });

  it("does not revalidate a category page for a top category index file", async () => {
    await send({ type: "content.modified", paths: ["categories/communication/index.mdx"] });

    expect(paths()).toEqual(["/opengraph-image", "/"]);
  });

  // The root layout reads the global settings, so no path identifies the pages. The tag is on each page.
  it("marks all pages stale for a change of the global settings", async () => {
    const res = await send({ type: "content.modified", paths: ["global/index.json"] });

    expect(await res.json()).toEqual({ revalidated: true, routes: [] });
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith(GLOBAL_SETTINGS_TAG, "max");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not use the global settings tag for a rule or a category change", async () => {
    await send({ type: "content.added", paths: ["public/uploads/rules/a-new-rule/rule.mdx", "categories/communication/rules-to-better-email.mdx"] });

    expect(tags()).not.toContain(GLOBAL_SETTINGS_TAG);
  });

  it("revalidates nothing for a file that no page reads through this route", async () => {
    const res = await send({ type: "content.modified", paths: ["README.md"] });

    expect(await res.json()).toEqual({ revalidated: true, routes: [] });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
