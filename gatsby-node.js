const siteConfig = require('./site-config');
const { createFilePath } = require('gatsby-source-filesystem');
const appInsights = require('applicationinsights');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');
const path = require('path');
const axios = require('axios');
const { createContentDigest } = require('gatsby-core-utils');
const express = require('express');

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
  if (node.internal.type === 'Mdx') {
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
    type Mdx implements Node @infer {
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
      seoDescription: String
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
  const { createPage, createRedirect } = actions;

  const result = await graphql(`
    query {
      categories: allMdx(
        filter: { frontmatter: { type: { eq: "category" } } }
      ) {
        nodes {
          fields {
            slug
          }
          frontmatter {
            index
            uri
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
          internal {
            contentFilePath
          }
        }
      }
      rules: allMdx(filter: { frontmatter: { type: { in: ["rule"] } } }) {
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
            seoDescription
          }
          internal {
            contentFilePath
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
    // eslint-disable-next-line no-console
    console.log('Creating Category: ' + node.parent.name);
    createPage({
      path: node.parent.name,
      component: `${categoryTemplate}?__contentFilePath=${node.internal.contentFilePath}`,
      context: {
        slug: node.fields.slug,
        index: node.frontmatter.index,
        redirects: node.frontmatter.redirects,
      },
    });

    node.frontmatter.redirects?.forEach((toPath) => {
      // eslint-disable-next-line no-console
      console.log(`\tRedirect: ${toPath} -> ${node.frontmatter.uri}`);
      createRedirect({
        fromPath: toPath,
        toPath: '/' + node.frontmatter.uri,
        isPermanent: true,
      });
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
    // eslint-disable-next-line no-console
    console.log('Creating Rule: ' + node.frontmatter.title);
    createPage({
      path: node.frontmatter.uri,
      component: `${ruleTemplate}?__contentFilePath=${node.internal.contentFilePath}`,
      context: {
        slug: node.fields.slug,
        related: node.frontmatter.related ? node.frontmatter.related : [''],
        uri: node.frontmatter.uri,
        redirects: node.frontmatter.redirects,
        file: `rules/${node.frontmatter.uri}/rule.md`,
        title: node.frontmatter.title,
        seoDescription: node.frontmatter.seoDescription,
      },
    });

    node.frontmatter.redirects?.forEach((toPath) => {
      // eslint-disable-next-line no-console
      console.log(`\tRedirect: ${toPath} -> ${node.frontmatter.uri}`);
      createRedirect({
        fromPath: toPath,
        toPath: '/' + node.frontmatter.uri,
        isPermanent: true,
      });
    });
  });

  const profilePage = require.resolve('./src/pages/profile.js');
  createPage({
    path: `${siteConfig.pathPrefix}/people/`,
    matchPath: `${siteConfig.pathPrefix}/people/:gitHubUsername`,
    component: `${profilePage}?__contentFilePath=${node.fiels.slug}`,
  });
};

exports.sourceNodes = async ({ actions, createNodeId }) => {
  const { createNode } = actions;
  const res = await axios.get('https://www.ssw.com.au/api/get-megamenu');
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

//Required as per https://tina.io/docs/frameworks/gatsby/#allowing-static-adminindexhtml-file-in-dev-mode
exports.onCreateDevServer = ({ app }) => {
  app.use('/admin', express.static('public/admin'));
};
