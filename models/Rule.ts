export type RuleCategory = {
  title?: string | null;
  uri?: string | null;
};

export type RuleCategoryItem = {
  category?: RuleCategory | null;
};

export interface Rule {
  guid: string;
  title: string;
  uri: string;
  body: any;
  isArchived?: boolean;
  archivedreason?: string;
  categories?: (RuleCategoryItem | null)[] | null;
  authors?: ({ title?: string | null; url?: string | null } | null)[] | null;
  lastUpdated?: string;
  lastUpdatedBy?: string;
}
