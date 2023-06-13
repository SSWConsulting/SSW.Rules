const plugin = require('tailwindcss/plugin');
module.exports = {
  content: ['./src/**/*.js'],
  theme: {
    extend: {
      fontSize: {
        xs: '0.8rem',
      },
      colors: {
        'gray-tooltip': '#9e9e9e',
        'black-next-button': '#222',
        'ssw-red': '#cc4141',
        'ssw-grey': '#eee',
        underline: '#aaa',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.hide-scrollbar': {
          'max-height': '45rem',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            width: '0',
          },
          'mask-image':
            'linear-gradient(to bottom, transparent, black 30px, black calc(100% - 20px), transparent), linear-gradient(black, black)',
          'mask-size': '100% 100%, 0 100%',
        },
      });
    }),
  ],
};
