import { MAX_CITED_RULES } from "./limits";
import type { FoundRule } from "./search";

export type CitedRule = { number: number; uri: string };
export type RuleSource = FoundRule & { number: number };

const MAX_REFERENCED_RULES = 3;

// The rules already cited in this conversation, as sent by the chat window.
export function parseCitedRules(value: unknown): CitedRule[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CITED_RULES) return null;
  const cited: CitedRule[] = [];
  for (const item of value) {
    const { number, uri } = (item ?? {}) as Partial<CitedRule>;
    if (!Number.isInteger(number) || (number as number) < 1 || typeof uri !== "string" || !/^[\w-]{1,400}$/.test(uri)) return null;
    cited.push({ number: number as number, uri });
  }
  return cited;
}

// A rule keeps the number it was first cited with; rules new to the conversation continue after the highest one.
export function numberSources(found: FoundRule[], cited: CitedRule[]): RuleSource[] {
  const known = new Map(cited.map((rule) => [rule.uri, rule.number]));
  let next = Math.max(0, ...cited.map((rule) => rule.number)) + 1;
  return found.map((rule) => ({ ...rule, number: known.get(rule.uri) ?? next++ }));
}

// The rules behind the citation numbers a question mentions, such as "tell me more about [2]".
export function referencedUris(question: string, cited: CitedRule[]): string[] {
  const mentioned = new Set([...question.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])));
  return [...new Set(cited.filter((rule) => mentioned.has(rule.number)).map((rule) => rule.uri))].slice(0, MAX_REFERENCED_RULES);
}
