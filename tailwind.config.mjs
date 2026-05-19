/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'aus-red': '#8B3A1F',
        'aus-green': '#2E5C3A',
        'aus-sand': '#FAF6EE',
        'aus-ink': '#1F1A14',
        'aus-muted': '#6B5E52',
      },
      fontFamily: {
        heading: ['Cardo', 'Noto Serif SC', 'serif'],
        body: ['Source Serif Pro', 'Noto Serif SC', 'serif'],
        numeral: ['Source Serif Pro', 'serif'],
      },
      maxWidth: {
        'editorial': '48rem',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '48rem',
            color: '#1F1A14',
            'h1, h2, h3, h4': {
              fontFamily: 'Cardo, Noto Serif SC, serif',
              color: '#1F1A14',
            },
            a: {
              color: '#8B3A1F',
              '&:hover': { color: '#2E5C3A' },
            },
            blockquote: {
              borderLeftColor: '#2E5C3A',
              backgroundColor: '#F5F3EF',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
