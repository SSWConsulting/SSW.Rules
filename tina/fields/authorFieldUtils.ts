export const DEFAULT_ADAM_AUTHOR = {
  title: "Adam Cogan",
  url: "https://www.ssw.com.au/people/adam-cogan",
};

function normalizeAuthorName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

export function shouldDefaultToAdamCogan(values: Record<string, unknown> | undefined) {
  return normalizeAuthorName(values?.createdBy) === "adam cogan";
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
