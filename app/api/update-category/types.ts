export type CategoryRuleIndexItem = {
    rule: {
      _sys?: {
        relativePath?: string;
      };
    };
  };
  
  export type CategoryQueryResponse = {
    category?: {
      index?: CategoryRuleIndexItem[];
    };
  };
  
  export type RuleConnectionQueryResponse = {
    ruleConnection?: {
      edges?: Array<{
        node?: {
          _sys?: {
            relativePath?: string;
          };
        };
      }>;
    };
  };
  
  export type CategoryFullQueryResponse = {
    category?: {
      title?: string;
      uri?: string;
      guid?: string;
      consulting?: boolean;
      experts?: string[];
      redirects?: string[];
      body?: string;
      created?: string;
      createdBy?: string;
      createdByEmail?: string;
      lastUpdated?: string;
      lastUpdatedBy?: string;
      lastUpdatedByEmail?: string;
      isArchived?: boolean;
      archivedreason?: string;
    };
  };
  
  export type CategoryIndexItem = {
    rule: string;
  };
  
  export type CategoryMutationParams = {
    title?: string;
    uri?: string;
    guid?: string;
    consulting?: boolean;
    experts?: string[];
    redirects?: string[];
    body?: string;
    created?: string;
    createdBy?: string;
    createdByEmail?: string;
    lastUpdated?: string;
    lastUpdatedBy?: string;
    lastUpdatedByEmail?: string;
    isArchived?: boolean;
    archivedreason?: string;
    index?: CategoryIndexItem[];
  };
  
  export type UpdateResult = {
    success: boolean;
    error?: unknown;
  };


  export type CategoryProcessingResult = {
    processed: string[];
    failed: string[];
  };
  
  export type UpdateCategoryRequest = {
    categories: Array<string | { category?: string }>;
    ruleUri: string;
  };
  
  export type UpdateCategoryResponse = {
    success: boolean;
    message: string;
    URI?: string;
    AddedCategories: string[];
    DeletedCategories: string[];
    NoChangedCategories: string[];
  };