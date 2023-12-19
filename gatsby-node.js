const siteConfig = require('./site-config');
const { createFilePath } = require('gatsby-source-filesystem');
const appInsights = require('applicationinsights');
const makePluginData = require('./src/helpers/plugin-data');
const createRewriteMap = require('./src/helpers/createRewriteMap');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');
const path = require('path');
const Map = require('core-js/features/map');

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
            redirects
            experts
            consulting
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
        filter: { frontmatter: { type: { in: ["rule"] } } }
      ) {
        nodes {
          fields {
            slug
          }
          frontmatter {
            uri
            title
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
    // Find any categories that can't resolve a rule
    node.frontmatter.index.forEach((inCat) => {
      var match = false;

      result.data.rules.nodes.forEach((rulenode) => {
        if (rulenode.frontmatter.uri == inCat) {
          match = true;
        }
        if (rulenode.frontmatter.redirects) {
          rulenode.frontmatter.redirects.forEach((redirect) => {
            if (redirect == inCat) {
              match = true;
            }
          });
        }
      });

      if (match == false) {
        // eslint-disable-next-line no-console
        console.log(node.parent.name + ' cannot find rule ' + inCat);
      }
    });

    // Create the page for the category
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

  result.data.rules.nodes.forEach((node) => {
    // Find any rules missing a category
    var match = false;
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
      // eslint-disable-next-line no-console
      console.log(
        'https://www.ssw.com.au/rules/' +
          node.frontmatter.uri +
          ' is missing a category'
      );
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
