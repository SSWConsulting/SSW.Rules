/* eslint-disable no-console */
const siteConfig = require('./site-config');
const { createFilePath } = require('gatsby-source-filesystem');
const appInsightsConfig = require('applicationinsights');
const makePluginData = require('./src/helpers/plugin-data');
const createRewriteMap = require('./src/helpers/createRewriteMap');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');
const path = require('path');
const Map = require('core-js/features/map');

if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
  // Log build time stats to appInsights
  appInsightsConfig
    .setup()
    .setAutoCollectConsole(true, true) // Enable logging of console.xxx
    .start();
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing APPINSIGHTS_INSTRUMENTATIONKEY, this build will not be logged to Application Insights'
  );
}

let assetsManifest = {};

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
      authors: [Author]
      related: [String]
      redirects: [String]
      guid: String
    }
    type Author {
      title: String
      url: String
      img: String
    }
  `;
  createTypes(typeDefs);
};

exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    plugins: [
      new WebpackAssetsManifest({
        assets: assetsManifest, // mutates object with entries
        merge: true,
      }),
    ],
    resolve: {
      modules: [path.resolve(__dirname, 'src'), 'node_modules'],
      plugins: [
        new DirectoryNamedWebpackPlugin({
          exclude: /node_modules/,
        }),
      ],
    },
  });
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
            redirects
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
            redirects
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
        redirects: node.frontmatter.redirects,
      },
    });
  });

  const { execSync } = require('child_process');
  var rule = 1;
  result.data.rules.nodes.forEach((node) => {
    // eslint-disable-next-line quotes
    const prettyThing = `--pretty=format:'{ "date": "%aD",  "author": "%aN",  "email": "%aE" }'`;
    var gitCommitInfoObject = {};
    try {
      const gitCommitInfo = execSync(
        `git -C ../SSW.Rules.Content/rules/${node.frontmatter.uri} log -1 ${prettyThing} --perl-regexp --author='^((?!SSW.Rules.SharePointExtractor).*)$' rule.md`
      ).toString();

      console.log(gitCommitInfo);
      gitCommitInfoObject = JSON.parse(gitCommitInfo);

      const nameFromEmail = gitCommitInfoObject.email.match(/^([^@]*)@/)[1];

      if (gitCommitInfoObject.author == nameFromEmail) {
        gitCommitInfoObject.author = gitCommitInfoObject.author.replace(
          /([a-z])([A-Z])/g,
          '$1 $2'
        );
        console.log(gitCommitInfoObject.author);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `Unable to get git history data for rule ${node.frontmatter.uri}`,
        e
      );
    }

    createPage({
      path: node.frontmatter.uri,
      component: ruleTemplate,
      context: {
        slug: node.fields.slug,
        related: node.frontmatter.related ? node.frontmatter.related : [''],
        uri: node.frontmatter.uri,
        redirects: node.frontmatter.redirects,
        file: `rules/${node.frontmatter.uri}/rule.md`,
        gitCommitInfo: gitCommitInfoObject,
      },
    });
    console.log('done ' + rule);
    rule++;
  });

  const profilePage = require.resolve('./src/pages/profile.js');
  createPage({
    path: `${siteConfig.pathPrefix}/people/`,
    matchPath: `${siteConfig.pathPrefix}/people/:gitHubUsername`,
    component: profilePage,
  });
};

exports.onPostBuild = async ({ store, pathPrefix }) => {
  const { pages } = store.getState();
  const pluginData = makePluginData(store, assetsManifest, pathPrefix);
  const rewrites = Array.from(pages.values())
    .filter((page) => page.context.redirects)
    .reduce((acc, page) => {
      acc = acc.concat(
        page.context.redirects.map((redirect) => {
          return {
            fromPath: pathPrefix + '/' + redirect,
            toPath: pathPrefix + page.path,
          };
        })
      );
      return acc;
    }, []);

  const allRewritesUnique = [
    ...new Map(rewrites.map((item) => [item.fromPath, item])).values(),
  ];
  await createRewriteMap.writeRewriteMapsFile(pluginData, allRewritesUnique);
};
