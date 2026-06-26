/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Barlow Condensed', 'sans-serif'],
        heading: ['Rajdhani', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        gold: {
          DEFAULT: '#f5c518',
          dim: '#c9a200',
          dark: '#8b6914',
        },
        surface: {
          base: '#080808',
          card: '#0f0f0f',
          hover: '#161616',
          2: '#1a1a1a',
        },
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'logo-burst': 'logo-burst 0.6s ease forwards',
        'bounce-in': 'bounceIn 0.4s ease forwards',
        float: 'float 3s ease-in-out infinite',
        shimmer: 'shimmer 3s infinite',
      },
      fontWeight: {
        700: '700',
        800: '800',
        900: '900',
      },
    },
  },
  plugins: [],
};
