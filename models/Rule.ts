/**
 * Legacy author format (pre-migration)
 * @deprecated Use author slugs (string[]) instead
 */
export interface LegacyAuthor {
  title?: string | null;
  url?: string | null;
}

/**
 * Author can be either:
 * - string: A slug referencing the people index (new format)
 * - LegacyAuthor: An object with title/url (legacy format, deprecated)
 */
export type Author = string | LegacyAuthor;

export interface Rule {
  guid: string;
  title: string;
  uri: string;
  body: any;
  isArchived?: boolean;
  archivedreason?: string;
  /**
   * Authors can be:
   * - string[]: Array of slugs (new format)
   * - LegacyAuthor[]: Array of objects with title/url (legacy format)
   */
  authors?: (Author | null)[] | null;
  lastUpdated?: string;
  lastUpdatedBy?: string;
}
