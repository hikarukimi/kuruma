/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
