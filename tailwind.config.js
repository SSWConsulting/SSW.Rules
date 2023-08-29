const plugin = require('tailwindcss/plugin');
const siteConfig = require('./site-config');

module.exports = {
  content: ['./src/**/*.js'],
  theme: {
    extend: {
      fontSize: {
        xs: '0.8rem',
      },
      padding: {
        '42px': '42px',
      },
      minWidth: {
        '200px': '200px',
      },
      colors: {
        'gray-tooltip': '#9e9e9e',
        'ssw-red': '#cc4141',
        'ssw-grey': '#eee',
        'ssw-black': '#333',
        'real-black': '#000',
        underline: '#aaa',
      },
      backgroundImage: {
        'view-title': `url(${siteConfig.pathPrefix}/assets/view-title.png)`,
        'view-blurb': `url(${siteConfig.pathPrefix}/assets/view-blurb.png)`,
        'view-full': `url(${siteConfig.pathPrefix}/assets/view-full.png)`,
      },
      backgroundPosition: {
        '10px': '10px',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.hide-scrollbar': {
          'max-height': '44rem',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            width: '0',
          },
          'mask-image':
            'linear-gradient(to bottom, transparent, black 8px, black calc(100% - 10px), transparent), linear-gradient(black, black)',
          'mask-size': '100% 100%, 0 100%',
        },
      });
    }),
  ],
};
