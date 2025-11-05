export const UPDATE_CATEGORY_MUTATION = `
mutation UpdateCategoryDoc($relativePath: String!, $category: CategoryCategoryMutation) {
    updateCategory(relativePath: $relativePath, params: { category: $category }) {
    __typename
    }
}
`;

export const CATEGORY_FULL_QUERY = `
query CategoryFull($relativePath: String!) {
    category(relativePath: $relativePath) {
    ... on CategoryCategory {
        title
        uri
        guid
        consulting
        experts
        redirects
        body
        created
        createdBy
        createdByEmail
        lastUpdated
        lastUpdatedBy
        lastUpdatedByEmail
        isArchived
        archivedreason
    }
    }
}
`;


export const RULE_PATH_BY_URI_QUERY = `
query RulePathByUri($uris: [String!]!) {
  ruleConnection(filter: { uri: { in: $uris } }) {
    edges { node { uri _sys { relativePath } } }
  }
}
`;

export const CATEGORY_RULE_PATHS_QUERY = `
query CategoryRulePaths($relativePath: String!) {
  category(relativePath: $relativePath) {
    ... on CategoryCategory {
      index {
        rule {
          ... on Rule {
            uri
            _sys { relativePath }
          }
        }
      }
    }
  }
}
`;