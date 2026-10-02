/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{js,jsx}']
  },
  theme: { extend: { colors: { forest: '#193d32', leaf: '#347a5c', parchment: '#f4f6f0', saffron: '#e8a849' } } },
  plugins: []
};
