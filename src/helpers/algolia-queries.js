const indexName = 'Pages';

const pageQuery = `{
    pages: allMarkdownRemark(filter: { frontmatter: { type: { eq: "rule" } } }) {
        nodes {
            id
            frontmatter {
                title
            }
            fields {
                slug
            }
        }
    }
}`;

function pageToAlgoliaRecord({ id, frontmatter, fields, ...rest }) {
  return {
    objectID: id,
    ...frontmatter,
    ...fields,
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
