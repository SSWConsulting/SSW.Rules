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
      resolve: 'gatsby-plugin-netlify-cms',
      options: {
        stylesPath: `${__dirname}/src/styles.css`,
        modulePath: `${__dirname}/src/cms/cms.js`,
      },
    },
    'gatsby-plugin-react-helmet',
    'gatsby-plugin-sitemap',
    'gatsby-transformer-json',
    'gatsby-plugin-postcss',
    {
      resolve: 'gatsby-plugin-disqus',
      options: {
        // shortname: 'sswrulesdev',
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
        patterns: ['categories/**/*', 'rules/**/*'],
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
      resolve: 'gatsby-source-git',
      options: {
        name: 'history',
        remote: 'https://github.com/SSWConsulting/SSW.Rules.Content.git',
        // Optionally supply a branch. If none supplied, you'll get the default branch.
        branch: process.env.CONTENT_BRANCH,
        // Tailor which files get imported eg. import the docs folder from a codebase.
        patterns: ['history.json'],
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'content',
        path: `${__dirname}/content`,
      },
    },
    'gatsby-plugin-sharp',
    {
      resolve: 'gatsby-transformer-remark',
      options: {
        excerpt_separator: '<!--endintro-->',
        plugins: [
          {
            resolve: '@raae/gatsby-remark-oembed',
            options: {
              // usePrefix defaults to false
              // usePrefix: true is the same as ["oembed"]
              usePrefix: ['oembed', 'video'],
              providers: {
                // Important to exclude providers
                // that adds js to the page.
                // If you do not need them.
                exclude: ['Reddit'],
              },
            },
          },

          {
            resolve: 'gatsby-remark-vscode',
            options: {
              colorTheme: 'Dark+ (default dark)',
              injectStyles: true,
              extensions: [],
              extensionDataDirectory: path.resolve('extensions'),
              logLevel: 'error',
            },
          },

          {
            resolve: 'gatsby-remark-figure-caption',
            options: { figureClassName: 'image' },
          },
          // gatsby-remark-relative-images must
          // go before gatsby-remark-images
          {
            resolve: 'gatsby-remark-relative-images',
          },
          {
            resolve: 'gatsby-remark-images',
            options: {
              // It's important to specify the maxWidth (in pixels) of
              // the content container as this plugin uses this as the
              // base for generating different widths of each image.
              //linkImagesToOriginal: false,
              maxWidth: 590,
              backgroundColor: 'transparent',
            },
          },
          'gatsby-remark-copy-linked-files',
          'gatsby-remark-fenced-divs',
          {
            resolve: 'gatsby-remark-custom-blocks',
            options: {
              blocks: {
                imgBadge: {
                  classes: 'img-badge',
                },
                imgBanner: {
                  classes: 'img-banner',
                },
                imgLg: {
                  classes: 'img-large',
                },
                imgMd: {
                  classes: 'img-medium',
                },
                imgSm: {
                  classes: 'img-small',
                },
                goodExample: {
                  classes: 'good-example',
                  title: 'optional',
                },
                badExample: {
                  classes: 'bad-example',
                  title: 'optional',
                },
                oKExample: {
                  classes: 'ok-example',
                  title: 'optional',
                },
                greyBox: {
                  classes: 'greybox',
                  title: 'optional',
                },
              },
            },
          },
          {
            resolve: 'gatsby-remark-embed-video',
            options: {
              maxWidth: 800,
              ratio: 1.77, // Optional: Defaults to 16/9 = 1.77
              height: 400, // Optional: Overrides optional.ratio
              related: false, //Optional: Will remove related videos from the end of an embedded YouTube video.
              noIframeBorder: true, //Optional: Disable insertion of <style> border: 0
              urlOverrides: [
                {
                  id: 'youtube',
                  embedURL: (videoId) =>
                    `https://www.youtube-nocookie.com/embed/${videoId}`,
                },
              ], //Optional: Override URL of a service provider, e.g to enable youtube-nocookie support
            },
          },
          'gatsby-remark-responsive-iframe',
        ],
      },
    },
    'gatsby-source-local-git',
    {
      resolve: 'gatsby-plugin-google-analytics',
      options: {
        // replace "UA-XXXXXXXXX-X" with your own Tracking ID
        trackingId: process.env.GOOGLE_ANALYTICS,
      },
    },
  ],
};
