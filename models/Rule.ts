export interface Rule {
  guid: string;
  title: string;
  uri: string;
  body: any;
  isArchived?: boolean;
  archivedreason?: string;
  authors?: ({ title?: string | null; url?: string | null } | null)[] | null;
  lastUpdated?: string;
  lastUpdatedBy?: string;
}