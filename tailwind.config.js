const plugin = require('tailwindcss/plugin');

module.exports = {
  content: ['./src/**/*.js', './node_modules/ssw.megamenu/**/*.js'],
  theme: {
    extend: {
      fontSize: {
        '4xl': '2.5rem',
        '3xl': '2rem',
        '2xl': '1.5rem',
        xl: '1.25rem',
        lg: '1.125rem',
        base: '1rem',
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
      margin: {
        heading: '1rem',
      },
      lineHeight: {
        heading: '1.2',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities, theme }) {
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
        'h1, h2, h3, h4, h5, h6': {
          marginBottom: theme('margin.heading'),
          marginTop: theme('margin.heading'),
          fontWeight: theme('fontWeight.semibold'),
          lineHeight: theme('lineHeight.heading'),
        },
        h1: {
          fontSize: theme('fontSize.4xl'),
          color: theme('colors.ssw.red'),
        },
        h2: {
          fontSize: theme('fontSize.3xl'),
          color: theme('colors.ssw.black'),
        },
        h3: {
          fontSize: theme('fontSize.2xl'),
          color: theme('colors.ssw.black'),
        },
        h4: {
          fontSize: theme('fontSize.xl'),
          color: theme('colors.ssw.black'),
        },
        h5: {
          fontSize: theme('fontSize.lg'),
          color: theme('colors.ssw.black'),
        },
        h6: {
          fontSize: theme('fontSize.base'),
          color: theme('colors.ssw.black'),
        },
        'h2 strong, h3 strong, h4 strong, h5 strong, h6 strong': {
          color: theme('colors.ssw.red'),
        },
      });
    }),
  ],
};
