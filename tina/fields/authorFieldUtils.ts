"use client";

export const DEFAULT_ADAM_AUTHOR = {
  title: "Adam Cogan",
  url: "https://www.ssw.com.au/people/adam-cogan",
};

export function shouldDefaultToAdamCogan(values: Record<string, unknown> | undefined) {
  return typeof values?.createdBy === "string" && values.createdBy.trim().toLowerCase() === "adam cogan";
}

export function getDefaultAuthors(values: Record<string, unknown> | undefined) {
  return shouldDefaultToAdamCogan(values) ? [DEFAULT_ADAM_AUTHOR] : undefined;
}

export function getMissingAuthorMessage(values: Record<string, unknown> | undefined) {
  if (shouldDefaultToAdamCogan(values)) {
    return undefined;
  }

  return "Add at least one author. Use an SSW People URL for SSW contributors, or any other profile or website URL for non-SSW authors.";
}
