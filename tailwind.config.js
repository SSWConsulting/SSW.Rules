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
      const headingStyles = {
        marginBottom: theme('margin.heading'),
        marginTop: theme('margin.heading'),
        fontWeight: theme('fontWeight.semibold'),
        lineHeight: theme('lineHeight.heading'),
      };

      const zeroMarginStyles = {
        marginTop: '0',
        marginBottom: '0',
      };

      const headingSizes = {
        h1: theme('fontSize.4xl'),
        h2: theme('fontSize.3xl'),
        h3: theme('fontSize.2xl'),
        h4: theme('fontSize.xl'),
        h5: theme('fontSize.lg'),
        h6: theme('fontSize.base'),
      };

      const headingColors = {
        h1: theme('colors.ssw.red'),
        h2: theme('colors.ssw.black'),
        h3: theme('colors.ssw.black'),
        h4: theme('colors.ssw.black'),
        h5: theme('colors.ssw.black'),
        h6: theme('colors.ssw.black'),
      };

      const commonUtilities = {};

      Object.keys(headingSizes).forEach((tag) => {
        commonUtilities[tag] = {
          ...headingStyles,
          fontSize: headingSizes[tag],
          color: headingColors[tag],
        };
        commonUtilities[`${tag} strong`] = {
          color: theme('colors.ssw.red'),
          fontWeight: theme('fontWeight.semibold'),
        };
      });

      addUtilities({
        ...commonUtilities,
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
