export interface RuleAuthor {
  title?: string;
  url?: string;
  img?: string;
}

export const DEFAULT_AUTHOR: RuleAuthor = {
  title: "Adam Cogan",
  url: "https://www.ssw.com.au/people/adam-cogan",
};

const normalize = (value?: string) => (value ?? "").trim().toLowerCase().replace(/\/+$/, "");

/** How many authors share this name or profile URL. Empty values never match. */
export const countMatchingAuthors = (authors: RuleAuthor[] | undefined, key: "title" | "url", value?: string) => {
  const target = normalize(value);
  if (!target) return 0;
  return (authors ?? []).filter((author) => normalize(author?.[key]) === target).length;
};

export const findDuplicateAuthor = (authors: RuleAuthor[] = []) =>
  authors.find((author) => countMatchingAuthors(authors, "title", author?.title) > 1 || countMatchingAuthors(authors, "url", author?.url) > 1);

export const validateUniqueAuthors = (authors?: RuleAuthor[]) => {
  const duplicate = findDuplicateAuthor(authors);
  if (duplicate) return `${duplicate.title || duplicate.url} is listed more than once. Remove the duplicate before saving.`;
};
