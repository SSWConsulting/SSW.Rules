import { Author } from "./author";

export interface Rule {
  guid: string;
  title: string;
  uri: string;
  excerpt?: string;
  htmlAst?: any;
  authors?: (Author | null)[] | null;
  isBookmarked?: boolean;
  lastUpdated: string;
  lastUpdatedBy: string;
  isArchived?: boolean;
}
