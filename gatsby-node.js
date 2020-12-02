const { createFilePath } = require('gatsby-source-filesystem');
const appInsights = require('applicationinsights');
const siteConfig = require('./site-config');

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

  var gitHubData={};
  var githubQuery = 'query {';
  var nbRules = 0;
  var i = 0;
  for (const node of result.data.rules.nodes) { 
   githubQuery += `
  rule${i}: github {
      repository(name: "SSW.Rules.Content", owner: "SSWConsulting") {
        content: object(expression: "${siteConfig.rulesContentBranch}") {
          ... on GitHub_Commit {
            blame(path: "${'rules/' + node.frontmatter.uri + '/rule.md'}") {
              ranges {
                commit {
                  committedDate
                  author {
                    avatarUrl
                    name
                    user {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;
    i++;
    nbRules++;
    if(nbRules === 500){    
      const resultGithub = await graphql(
        githubQuery +
          `
    }`
      );
      gitHubData=Object.assign(gitHubData, resultGithub.data);
      
      githubQuery = 'query {';
      nbRules = 0;

    }
  }
  if(nbRules>0){
    const resultGithub = await graphql(
      githubQuery +
        `
  }`
    );
    gitHubData=Object.assign(gitHubData, resultGithub.data);
  }
  //console.log(gitHubData);

  result.data.rules.nodes.forEach((node, i) => {
    var commits = null;
    if (gitHubData[`rule${i}`] !== null && gitHubData[`rule${i}`].repository !== null && gitHubData[`rule${i}`].repository.content !== null)
      commits = gitHubData[`rule${i}`].repository.content.blame.ranges;
    else
      console.log(node.frontmatter.uri);
    createPage({
      path: node.frontmatter.uri,
      component: ruleTemplate,
      context: {
        slug: node.fields.slug,
        related: node.frontmatter.related ? node.frontmatter.related : [''],
        uri: node.frontmatter.uri,
        commits: commits,
      },
    });
  });
};
