export interface Rule {
  guid: string;
  title: string;
  uri: string;
  body: any;
  isArchived?: boolean;
  archivedreason?: string;
  authors?: { title: string }[];
  lastUpdated?: string;
  lastUpdatedBy?: string;
}