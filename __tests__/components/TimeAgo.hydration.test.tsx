import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import LatestRulesCard from "@/components/LatestRulesCard";
import { TimeAgo } from "@/components/TimeAgo";
import type { LatestRule } from "@/models/LatestRule";

jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children }: any) => <a href={href}>{children}</a> }));

// Pages are cached for hours, so the browser hydrates the server HTML at a later time than the server rendered it
const RENDERED_AT = new Date("2026-11-20T09:00:00Z");
const VIEWED_AT = new Date("2026-11-23T09:00:00Z");

async function hydrateLater(element: React.ReactElement) {
  jest.setSystemTime(RENDERED_AT);
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.appendChild(container);

  jest.setSystemTime(VIEWED_AT);
  const errors: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: (error) => errors.push(error) });
  });
  return { container, errors };
}

describe("TimeAgo", () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ["queueMicrotask", "nextTick", "setImmediate"] }));
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  it("hydrates a page that the server rendered days earlier without a mismatch", async () => {
    const rules: LatestRule[] = [{ id: "1", uri: "hard-tasks-first", title: "Do you tackle the hard things first?", lastUpdated: "2026-11-18T09:00:00Z" }];

    const { container, errors } = await hydrateLater(<LatestRulesCard rules={rules} />);

    expect(errors).toEqual([]);
    expect(container.textContent).toContain("5 days ago");
  });

  it("renders the same text in every time zone before hydration", () => {
    const html = (timeZone: string) => {
      const before = process.env.TZ;
      process.env.TZ = timeZone;
      try {
        return renderToString(<TimeAgo date="2026-11-18T23:30:00Z" />);
      } finally {
        process.env.TZ = before;
      }
    };

    expect(html("Australia/Brisbane")).toBe(html("UTC"));
  });

  it("renders nothing for a missing date", () => {
    expect(renderToString(<TimeAgo date={null} />)).toBe("");
  });
});
