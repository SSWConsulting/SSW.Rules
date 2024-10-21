const siteConfig = require('./site-config');
const path = require('path');

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV}`,
});

module.exports = {
  pathPrefix: `${siteConfig.pathPrefix}`,
  siteMetadata: {
    ...siteConfig,
  },
  plugins: [
    {
      resolve: 'gatsby-plugin-algolia',
      options: {
        appId: process.env.GATSBY_ALGOLIA_APP_ID,
        apiKey: process.env.ALGOLIA_ADMIN_KEY,
        queries: require('./src/helpers/algolia-queries'),
      },
    },
    {
      resolve: 'gatsby-plugin-google-tagmanager',
      options: {
        id: process.env.GTM_CONTAINER_ID,
        includeInDevelopment: true,
      },
    },
    // TODO: Remove when Decap is no longer relevant
    // {
    //   resolve: 'gatsby-plugin-decap-cms',
    //   options: {
    //     manualInit: true,
    //     stylesPath: `${__dirname}/src/styles.css`,
    //     modulePath: `${__dirname}/src/cms/cms.js`,
    //   },
    // },
    'gatsby-plugin-react-helmet',
    'gatsby-plugin-sitemap',
    'gatsby-transformer-json',
    'gatsby-plugin-postcss',
    {
      resolve: 'gatsby-plugin-disqus',
      options: {
        shortname: process.env.DISQUS_FORUM,
      },
    },
    {
      resolve: 'gatsby-source-git',
      options: {
        name: 'categories',
        remote: 'https://github.com/SSWConsulting/SSW.Rules.Content.git',
        // Optionally supply a branch. If none supplied, you'll get the default branch.
        branch: process.env.CONTENT_BRANCH,
        // Tailor which files get imported eg. import the docs folder from a codebase.
        patterns: ['rules/**/*', 'categories/**/*'],
      },
    },
    {
      resolve: 'gatsby-source-git',
      options: {
        name: 'categories',
        remote: 'https://github.com/SSWConsulting/SSW.Rules.Content.git',
        // Optionally supply a branch. If none supplied, you'll get the default branch.
        branch: process.env.CONTENT_BRANCH,
        // Tailor which files get imported eg. import the docs folder from a codebase.
        patterns: ['assets/**'],
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'commits',
        path: `${__dirname}/static/commits.json`,
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'history',
        path: `${__dirname}/static/history.json`,
      },
    },
    // TODO: Keep an eye on this, it might be required
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'content',
        path: `${__dirname}/content`,
      },
    },
    'gatsby-plugin-sharp',
    {
      resolve: 'gatsby-plugin-mdx',
      options: {
        extensions: ['.mdx', '.md'],
        gatsbyRemarkPlugins: [
          // TODO: Remove when we can confirm these plugins are not needed
          // {
          //   resolve: '@raae/gatsby-remark-oembed',
          //   options: {
          //     // usePrefix defaults to false
          //     // usePrefix: true is the same as ["oembed"]
          //     usePrefix: ['oembed', 'video'],
          //     providers: {
          //       // Important to exclude providers
          //       // that adds js to the page.
          //       // If you do not need them.
          //       exclude: ['Reddit'],
          //     },
          //   },
          // },
          // {
          //   resolve: 'gatsby-remark-figure-caption',
          //   options: { figureClassName: 'image' },
          // },
          // {
          //   resolve: 'gatsby-remark-vscode',
          //   options: {
          //     colorTheme: 'Dark+ (default dark)',
          //     injectStyles: true,
          //     extensions: [],
          //     extensionDataDirectory: path.resolve('extensions'),
          //     logLevel: 'error',
          //   },
          // },
          // {
          //   resolve: 'gatsby-remark-figure-caption',
          //   options: { figureClassName: 'image' },
          // },
          // gatsby-remark-relative-images must
          // go before gatsby-remark-images
          // {
          //   resolve: 'gatsby-remark-relative-images-v2',
          // },
          // {
          //   resolve: 'gatsby-remark-images',
          //   options: {
          //     // It's important to specify the maxWidth (in pixels) of
          //     // the content container as this plugin uses this as the
          //     // base for generating different widths of each image.
          //     //linkImagesToOriginal: false,
          //     maxWidth: 1024,
          //     backgroundColor: 'transparent',
          //   },
          // },
          // {
          //   resolve: 'gatsby-remark-autolink-headers',
          //   options: {
          //     offsetY: '100',
          //     icon: '<svg fill="#cc4141" outline="#cc4141" aria-hidden="true" height="20" version="1.1" viewBox="0 0 16 16" width="20"><path fill-rule="evenodd" d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z"></path></svg>',
          //     maintainCase: false,
          //     removeAccents: true,
          //     isIconAfterHeader: true,
          //     elements: ['h2', 'h3', 'h4'],
          //   },
          // },
          // {
          //   resolve: 'gatsby-remark-copy-linked-files',
          //   options: {
          //     ignoreFileExtensions: [],
          //   },
          // },
          // 'gatsby-remark-fenced-divs',
          // // causes the block tokenizer error
          // // {
          // //   resolve: 'gatsby-remark-custom-blocks',
          // //   options: {
          // //     blocks: {
          // //       imgBadge: {
          // //         classes: 'img-badge',
          // //       },
          // //       imgBanner: {
          // //         classes: 'img-banner',
          // //       },
          // //       imgLg: {
          // //         classes: 'img-large',
          // //       },
          // //       imgMd: {
          // //         classes: 'img-medium',
          // //       },
          // //       imgSm: {
          // //         classes: 'img-small',
          // //       },
          // //       goodExample: {
          // //         classes: 'good-example',
          // //         title: 'optional',
          // //       },
          // //       badExample: {
          // //         classes: 'bad-example',
          // //         title: 'optional',
          // //       },
          // //       oKExample: {
          // //         classes: 'ok-example',
          // //         title: 'optional',
          // //       },
          // //       greyBox: {
          // //         classes: 'greybox',
          // //         title: 'optional',
          // //       },
          // //       noBorder: {
          // //         classes: 'no-border',
          // //         title: 'optional',
          // //       },
          // //     },
          // //   },
          // // },
          // {
          //   resolve: 'gatsby-remark-embed-video',
          //   options: {
          //     related: false, //Optional: Will remove related videos from the end of an embedded YouTube video.
          //     noIframeBorder: true, //Optional: Disable insertion of <style> border: 0
          //     urlOverrides: [
          //       {
          //         id: 'youtube',
          //         embedURL: (videoId) =>
          //           `https://www.youtube-nocookie.com/embed/${videoId}`,
          //       },
          //     ], //Optional: Override URL of a service provider, e.g to enable youtube-nocookie support
          //     /* eslint-disable quotes */
          //     sandbox: "'allow-same-origin allow-scripts allow-presentation'",
          //   },
          // },
        ],
      },
    },
    {
      resolve: 'gatsby-plugin-google-gtag',
      options: {
        trackingIds: [process.env.GOOGLE_ANALYTICS],
        pluginConfig: {
          head: true,
        },
      },
    },
    'gatsby-plugin-fontawesome-css',
    `gatsby-plugin-client-side-redirect`, // make sure to put last in the array
  ],
};
