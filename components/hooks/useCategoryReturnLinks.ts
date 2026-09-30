"use client";

import { useEffect, useState } from "react";
import type { BreadcrumbCategory } from "@/components/Breadcrumbs";
import { CategoryReturnState, readCategoryReturnStates, requestScrollRestore } from "@/lib/categoryReturnState";

/** Points category links at the page of the list the reader left, and restores their scroll position there. */
export function useCategoryReturnLinks(categories?: BreadcrumbCategory[]): BreadcrumbCategory[] | undefined {
  // Read after mount: sessionStorage doesn't exist during prerendering, and reading it in render would break hydration
  const [returnStates, setReturnStates] = useState<Record<string, CategoryReturnState>>({});

  useEffect(() => {
    setReturnStates(readCategoryReturnStates());
  }, []);

  return categories?.map((category) => {
    const categoryUri = category.link.replace(/^\//, "");
    const returnState = returnStates[categoryUri];
    if (!returnState) return category;

    return {
      ...category,
      link: `${category.link}${returnState.search}`,
      scroll: false,
      onClick: () => requestScrollRestore(categoryUri),
    };
  });
}
