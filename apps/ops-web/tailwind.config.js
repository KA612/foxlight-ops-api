/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ["Quicksand", "sans-serif"],
          heading: ["Archivo", "sans-serif"],
        },
      },
    },
    darkMode: "class",
    plugins: [],
  };
  