import { renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { useCategoryReturnLinks } from "@/components/hooks/useCategoryReturnLinks";
import { readCategoryReturnStates, saveCategoryReturnState } from "@/lib/categoryReturnState";

const categories = [{ link: "/rules-to-better-ai", title: "Rules to Better AI" }];
const click = (modifiers: Partial<MouseEvent<HTMLAnchorElement>> = {}) =>
  ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers }) as MouseEvent<HTMLAnchorElement>;

describe("useCategoryReturnLinks", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("leaves a link untouched when no list position is saved", () => {
    const { result } = renderHook(() => useCategoryReturnLinks(categories));

    expect(result.current).toEqual(categories);
  });

  it("points the link at the saved list page without scrolling to the top", () => {
    saveCategoryReturnState("rules-to-better-ai", "?page=2", 1500);

    const { result } = renderHook(() => useCategoryReturnLinks(categories));

    expect(result.current?.[0]).toMatchObject({ link: "/rules-to-better-ai?page=2", scroll: false });
  });

  it("requests a scroll restore on a plain click only", () => {
    saveCategoryReturnState("rules-to-better-ai", "?page=2", 1500);
    const { result } = renderHook(() => useCategoryReturnLinks(categories));

    result.current?.[0].onClick?.(click({ metaKey: true }));
    expect(readCategoryReturnStates()["rules-to-better-ai"].restoreRequestedAt).toBeNull();

    result.current?.[0].onClick?.(click());
    expect(readCategoryReturnStates()["rules-to-better-ai"].restoreRequestedAt).not.toBeNull();
  });
});
