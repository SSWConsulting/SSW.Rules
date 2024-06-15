const plugin = require('tailwindcss/plugin');

module.exports = {
  content: ['./src/**/*.js', './node_modules/ssw.megamenu/**/*.js'],
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
      backgroundColor: {
        'ssw-slate-gray': '#777',
      },
      colors: {
        ssw: {
          red: '#cc4141',
          light: {
            red: '#d26e6e',
          },
          gray: '#797979',
          black: '#333333',
        },
        'tooltip-grey': '#9e9e9e',
        'ssw-grey': '#eee',
        'light-grey': '#ccc',
        'real-black': '#000',
        underline: '#aaa',
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
