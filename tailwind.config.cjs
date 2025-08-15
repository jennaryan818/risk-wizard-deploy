/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'card': 'rgb(255 255 255)',
        'card-dark': 'rgb(23 23 23)',
        'muted': 'rgb(107 114 128)',
        'muted-dark': 'rgb(156 163 175)'
      },
      borderRadius: {
        '2xl': '1rem'
      }
    },
  },
  plugins: [],
}
