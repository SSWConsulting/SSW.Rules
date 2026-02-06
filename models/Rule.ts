import { Author } from "@/types/author";

export interface Rule {
  guid: string;
  title: string;
  uri: string;
  body: any;
  isArchived?: boolean;
  archivedreason?: string;
  authors?: (Author | null)[] | null;
  lastUpdated?: string;
  lastUpdatedBy?: string;
}
