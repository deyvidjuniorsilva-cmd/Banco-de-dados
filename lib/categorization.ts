export interface MatchableRule {
  keyword: string;
  categoryId: string;
}

export function matchCategory(
  description: string,
  rules: MatchableRule[]
): string | null {
  const normalizedDescription = description.toLowerCase();
  for (const rule of rules) {
    if (normalizedDescription.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId;
    }
  }
  return null;
}
