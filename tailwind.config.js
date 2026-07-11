/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff5f0",
          100: "#ffe8db",
          400: "#ff9d6e",
          500: "#ff7a45",
          600: "#f2632c",
          700: "#c94f22",
        },
      },
    },
  },
  plugins: [],
};
