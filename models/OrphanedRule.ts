export interface OrphanedRule {
  folderName: string;
  uri: string;
  filePath: string;
}

export type OrphanedRulesData = OrphanedRule[];