export interface QueryResult<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string;
  };
}
