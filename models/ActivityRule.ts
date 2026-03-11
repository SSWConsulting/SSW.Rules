export interface ActivityRuleCategory {
  title: string;
  uri: string;
}

export interface ActivityRule {
  guid: string;
  title: string;
  uri: string;
  lastCommentAt: string;
  commentCount: number;
  authors: string[];
  created: string | null;
  descriptionPreview: string;
  categories: ActivityRuleCategory[];
  thumbsUp: number;
  thumbsDown: number;
}

export interface ActivityRulesResponse {
  rules: ActivityRule[];
  total: number;
}
