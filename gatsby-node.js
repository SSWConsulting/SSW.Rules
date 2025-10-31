const siteConfig = require('./site-config');
const { createFilePath } = require('gatsby-source-filesystem');
const appInsights = require('applicationinsights');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');
const path = require('path');
const axios = require('axios');
const { getViewDataFromCRM } = require('./src/services/crmApi');

if (
  process.env.APPLICATIONINSIGHTS_DISABLED !== 'true' &&
  process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
) {
  // Log build time stats to appInsights
  appInsights
    .setup()
    .setAutoCollectConsole(true, true) // Enable logging of console.xxx
    .start();
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing APPLICATIONINSIGHTS_CONNECTION_STRING, this build will not be logged to Application Insights'
  );
}

let assetsManifest = {};

exports.onCreateNode = ({ node, getNode, actions }) => {
  const { createNodeField } = actions;
  if (node.internal.type === 'MarkdownRemark') {
    // TODO: Workaround - The issue is being tracked on the Gatsby side - https://github.com/gatsbyjs/gatsby/issues/39136
    const trimmedContent = node.internal.content
      .split('\n')
      .map((line) => (line.trim() === '' ? '' : line))
      .join('\n');

    node.internal.content = trimmedContent;

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
      fallback: {
        buffer: require.resolve('buffer/'),
      },
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
      categories: allMarkdownRemark(
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
            seoDescription
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
      component: categoryTemplate,
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
      component: ruleTemplate,
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

    const profilePage = require.resolve('./src/pages/profile.js');
    createPage({
      path: `${siteConfig.pathPrefix}/people/`,
      matchPath: `${siteConfig.pathPrefix}/people/:gitHubUsername`,
      component: profilePage,
    });
  });
};

exports.sourceNodes = async ({
  actions,
  createNodeId,
  createContentDigest,
}) => {
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

  const crmDataResult = await getViewDataFromCRM();
  crmDataResult.map((user) => {
    const userNode = {
      id: user.userId,
      parent: '__SOURCE__',
      children: [],
      internal: {
        type: 'CrmDataCollection',
        contentDigest: createContentDigest(user),
      },
      slug: user.fullName?.replace(' ', '-').toLowerCase(),
      fullName: user.fullName,
      location: user.defaultSite ? user.defaultSite : 'Others',
      jobTitle: user.jobTitle.replace(/(SSW)(?! TV)/g, '') || '',
      role: user.role || '',
      isActive: user.isActive,
      nickname: user.nickname || '',
      blogUrl: user.blogUrl || '',
      facebookUrl: user.facebookUrl || '',
      skypeUsername: user.skypeUsername || '',
      linkedInUrl: user.linkedInUrl || '',
      twitterUsername: user.twitterUsername || '',
      gitHubUrl: user.gitHubUrl || '',
    };

    // Create node with the gatsby createNode() API
    createNode(userNode);
  });
};
