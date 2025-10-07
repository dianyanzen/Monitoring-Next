/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        darkbg: "#0b0b0d",
        neonblue: "#00b3ff",
        neonpurple: "#b600ff",
      },
    },
  },
  plugins: [],
};
