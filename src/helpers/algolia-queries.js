const indexName = 'Rules';

const pageQuery = `{
    pages: allMarkdownRemark(filter: { frontmatter: { type: { eq: "rule" } } }) {
        nodes {
            id
            excerpt(format: PLAIN, pruneLength: 500)
            frontmatter {
                title
            }
            fields {
                slug
            }
            internal {
              # querying internal.contentDigest is required - https://github.com/algolia/gatsby-plugin-algolia#partial-updates
              contentDigest
            }
        }
    }
}`;

function pageToAlgoliaRecord({ id, frontmatter, fields, internal, ...rest }) {
  return {
    objectID: id,
    ...frontmatter,
    ...fields,
    ...internal,
    ...rest,
  };
}

const queries = [
  {
    query: pageQuery,
    transformer: ({ data }) => data.pages.nodes.map(pageToAlgoliaRecord),
    indexName,
    settings: { attributesToSnippet: ['excerpt:20'] },
  },
];

module.exports = queries;
