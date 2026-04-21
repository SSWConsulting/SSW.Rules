import { Rule } from "@/models/Rule";

export function hasAssignedCategory(categories: Rule["categories"]): boolean {
  return (categories ?? []).some((categoryItem) => {
    const category = categoryItem?.category;

    return (
      (typeof category?.title === "string" && category.title.trim().length > 0) || (typeof category?.uri === "string" && category.uri.trim().length > 0)
    );
  });
}
