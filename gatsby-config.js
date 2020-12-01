const siteConfig = require('./site-config');

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV}`,
});

module.exports = {
  pathPrefix: '/rules',
  siteMetadata: {
    ...siteConfig,
  },
  plugins: [
    'gatsby-plugin-react-helmet',
    'gatsby-plugin-sitemap',
    'gatsby-transformer-json',
    'gatsby-plugin-postcss',
    {
      resolve: 'gatsby-source-git',
      options: {
        name: 'categories',
        remote: 'https://github.com/SSWConsulting/SSW.Rules.Content.git',
        // Optionally supply a branch. If none supplied, you'll get the default branch.
        branch: siteConfig.rulesContentBranch,
        // Tailor which files get imported eg. import the docs folder from a codebase.
        patterns: ['categories/**/*.md', 'rules/**/*'],
      },
    },
    {
      resolve: 'gatsby-source-git',
      options: {
        name: 'categories',
        remote: 'https://github.com/SSWConsulting/SSW.Rules.Content.git',
        // Optionally supply a branch. If none supplied, you'll get the default branch.
        branch: siteConfig.rulesContentBranch,
        // Tailor which files get imported eg. import the docs folder from a codebase.
        patterns: ['assets/**'],
      },
    },
    {
      resolve: 'gatsby-plugin-breadcrumb',
      options: {
        defaultCrumb: {
          location: {
            pathname: '/',
          },
          crumbLabel: siteConfig.breadcrumbDefault,
          crumbSeparator: '>',
        },
        usePathPrefix: `${
          process.env.NODE_ENV === 'production' ? '/rules' : ''
        }`,
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
        plugins: [
          {
            resolve: 'gatsby-remark-figure-caption',
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
              maxWidth: 590,
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
      resolve: 'gatsby-remark-prismjs',
      options: {
        classPrefix: 'language-',
        inlineCodeMarker: null,

        aliases: {},
        showLineNumbers: false,
        noInlineHighlight: false,
        languageExtensions: [
          {
            language: 'superscript',
            extend: 'javascript',
            definition: {
              superscript_types: /(SuperType)/,
            },
            insertBefore: {
              function: {
                superscript_keywords: /(superif|superelse)/,
              },
            },
          },
        ],
        prompt: {
          user: 'root',
          host: 'localhost',
          global: false,
        },
        escapeEntities: {},
      },
    },
    {
      resolve: 'gatsby-plugin-google-analytics',
      options: {
        // replace "UA-XXXXXXXXX-X" with your own Tracking ID
        trackingId: process.env.GOOGLE_ANALYTICS,
      },
    },
  ],
};
