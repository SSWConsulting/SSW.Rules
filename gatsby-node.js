const { createFilePath } = require('gatsby-source-filesystem');
const appInsights = require('applicationinsights');
const makePluginData = require('./src/helpers/plugin-data');
const createRewriteMap = require('./src/helpers/createRewriteMap');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');
const path = require('path');
const Map = require('core-js/features/map');
const axios = require('axios');
const { createContentDigest } = require('gatsby-core-utils');

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
    type MarkdownRemark implements Node @infer {
      frontmatter: Frontmatter
    }
    type Frontmatter @infer {
      archivedreason: String   
      authors: [Author]
      related: [String]
      redirects: [String]
      experts: String
      consulting: String
      guid: String
    }
    type Author implements Node @dontInfer {
      title: String
      url: String
      img: String
      noimage: Boolean
    }
  `;
  createTypes(typeDefs);
};

exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    devtool: 'eval-source-map',
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
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
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
          }
          parent {
            ... on File {
              name
            }
          }
        }
      }
      rules: allMarkdownRemark(
        filter: { frontmatter: { type: { in: ["rule"] } } }
      ) {
        nodes {
          excerpt(format: HTML, pruneLength: 500)
          fields {
            slug
          }
          frontmatter {
            uri
            title
            related
            redirects
            archivedreason
            guid
          }
          htmlAst
        }
      }
    }
  `);

  const categoryTemplate = require.resolve('./src/templates/category.js');
  const ruleTemplate = require.resolve('./src/templates/rule.js');
  result.data.categories.nodes.forEach((node) => {
    let indexedRule = [];
    result.data.rules.nodes.forEach((rule) => {
      if (
        node.frontmatter.index.includes(rule.frontmatter.uri) &&
        !rule.frontmatter.archivedreason
      ) {
        indexedRule.push(rule);
      }
    });

    // Create the page for the category
    createPage({
      path: node.parent.name,
      component: categoryTemplate,
      context: {
        slug: node.fields.slug,
        pageRules: indexedRule,
      },
    });
  });

  const orphanedRules = [];

  result.data.rules.nodes.forEach((node) => {
    let match = false;
    if (!node.frontmatter.archivedreason) {
      result.data.categories.nodes.forEach((catNode) => {
        catNode.frontmatter.index.forEach((inCat) => {
          if (node.frontmatter.uri == inCat) {
            match = true;
          }
        });
      });
    } else {
      match = true;
    }

    if (match == false) {
      orphanedRules.push(node.frontmatter.uri);
    }

    // Create the page for the rule
    createPage({
      path: node.frontmatter.uri,
      component: ruleTemplate,
      context: {
        slug: node.fields.slug,
        related: node.frontmatter.related ? node.frontmatter.related : [''],
        uri: node.frontmatter.uri,
        redirects: node.frontmatter.redirects,
        file: `rules/${node.frontmatter.uri}/rule.md`,
        title: node.frontmatter.title,
      },
    });
  });

  // const profilePage = require.resolve('./src/pages/profile.js');
  // createPage({
  //   path: `${siteConfig.pathPrefix}/people/`,
  //   matchPath: `${siteConfig.pathPrefix}/people/:gitHubUsername`,
  //   component: profilePage,
  // });

  const orphanedPage = require.resolve('./src/templates/orphaned.js');
  createPage({
    path: '/orphaned/',
    component: orphanedPage,
    context: {
      index: orphanedRules,
    },
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

exports.sourceNodes = async ({ actions, createNodeId }) => {
  const { createNode } = actions;
  const res = await axios.get('https://ssw.com.au/api/get-megamenu');
  const menuData = res.data;

  menuData?.menuGroups.forEach((group) => {
    const node = {
      id: createNodeId(`megamenugroup-${group.name}`),
      parent: null,
      children: [],
      internal: {
        type: 'MegaMenuGroup',
        contentDigest: createContentDigest(group),
      },
      ...group,
    };

    createNode(node);
  });
};
