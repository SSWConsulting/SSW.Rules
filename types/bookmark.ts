export interface BookmarkData {
  ruleGuid: string;
  userId: string;
}

export interface BookmarkResponse {
  error?: boolean;
  message?: string;
  bookmarkStatus?: boolean;
}

export interface UserBookmarksResponse {
  error?: boolean;
  message?: string;
  bookmarkedRules?: BookmarkedRule[];
}

export interface BookmarkedRule {
  id: string;
  userId: string;
  ruleGuid: string;
  discriminator: string;
}
