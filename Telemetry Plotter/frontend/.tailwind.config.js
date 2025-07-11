/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4b7575',
        primaryHover: '#5a8a8a',
      },
    },
  },
  plugins: [],
}