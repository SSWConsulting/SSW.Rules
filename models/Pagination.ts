export interface PaginationVars {
    first?: number;
    last?: number;
    after?: string;
    before?: string;
  }
  
export interface PaginationResult<T> {
    items: T[];
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string | null;
        endCursor: string | null;
    };
    totalCount: number;
}