/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"M PLUS 1p"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
