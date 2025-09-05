import type { Rule } from '@/types/rule';

export function appendNewRules(existing: Rule[], incoming: Rule[]): Rule[] {
  const ruleKey = (rule: Rule) => rule.guid ?? rule.uri;

  const existingKeys = new Set(existing.map(ruleKey));
  const result = existing.slice();

  for (const rule of incoming) {
    const key = ruleKey(rule);
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      result.push(rule);
    }
  }
  return result;
}
