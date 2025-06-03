/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wails-dark': 'rgba(27, 38, 54, 1)',
      },
      fontFamily: {
        'jetbrains': ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

