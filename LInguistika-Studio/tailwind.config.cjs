/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#2563eb',
        'brand-navy': '#0f172a',
        'brand-cyan': '#06b6d4',
        'brand-yellow': '#eab308',
      },
    },
  },
  plugins: [],
};
