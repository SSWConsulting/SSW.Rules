const { createFilePath } = require('gatsby-source-filesystem');
const appInsights = require('applicationinsights');

if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
  // Log build time stats to appInsights
  appInsights
    .setup()
    .setAutoCollectConsole(true, true) // Enable logging of console.xxx
    .start();
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing APPINSIGHTS_INSTRUMENTATIONKEY, this build will not be logged to Application Insights'
  );
}

exports.onCreateNode = ({ node, getNode, actions }) => {
  const { createNodeField } = actions;
  if (node.internal.type === 'MarkdownRemark') {
    const slug = createFilePath({ node, getNode, basePath: '' });
    createNodeField({
      node,
      name: 'slug',
      value: slug,
    });
  }
};
exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;
  const typeDefs = `
    type MarkdownRemark implements Node {
      frontmatter: Frontmatter
    }
    type Frontmatter {
      archivedreason: String   
      related: [String]
    }
  `;
  createTypes(typeDefs);
};

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions;

  const result = await graphql(`
    query {
      categories: allMarkdownRemark(
        filter: { frontmatter: { type: { eq: "category" } } }
      ) {
        nodes {
          fields {
            slug
          }
          frontmatter {
            index
          }
          parent {
            ... on File {
              name
              relativeDirectory
            }
          }
        }
      }
      rules: allMarkdownRemark(
        filter: {
          frontmatter: { type: { nin: ["category", "top-category", "main"] } }
        }
      ) {
        nodes {
          fields {
            slug
          }
          frontmatter {
            uri
            archivedreason
            related
          }
        }
      }
    }
  `);

  const categoryTemplate = require.resolve('./src/templates/category.js');
  const ruleTemplate = require.resolve('./src/templates/rule.js');

  result.data.categories.nodes.forEach((node) => {
    createPage({
      path: node.parent.name,
      component: categoryTemplate,
      context: {
        slug: node.fields.slug,
        index: node.frontmatter.index,
      },
    });
  });

  result.data.rules.nodes.forEach((node) => {
    createPage({
      path: node.frontmatter.uri,
      component: ruleTemplate,
      context: {
        slug: node.fields.slug,
        related: node.frontmatter.related ? node.frontmatter.related : [''],
        uri: node.frontmatter.uri,
      },
    });
  });
};
