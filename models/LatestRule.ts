export interface LatestRule {
  id: string;
  title: string;
  lastUpdated?: string | null;
  lastUpdatedBy?: string | null;
  created?: string | null;
  createdBy?: string | null;
  uri: string;
  authorUrl?: string | null;
}