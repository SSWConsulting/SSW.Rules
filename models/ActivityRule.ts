export interface ActivityRule {
  guid: string;
  title: string;
  uri: string;
  lastCommentAt: string;
  commentCount: number;
}

export interface ActivityRulesResponse {
  rules: ActivityRule[];
  total: number;
}
