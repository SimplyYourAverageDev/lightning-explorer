/** @type {import('tailwindcss').Config} */
export default {
  mode: 'jit',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "!./src/**/*.test.{js,jsx}",
    "!./src/**/*.spec.{js,jsx}",
  ],
  safelist: [
    'selected',
    'cut',
    'drag-over',
    'skeleton',
    'loading',
  ],
  theme: {
    extend: {
      colors: {
        'wails-dark': 'rgba(27, 38, 54, 1)',
      },
      fontFamily: {
        'jetbrains': ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        'file-item': 'var(--file-item-height)',
      },
      animation: {
        'none': 'none',
      },
      transitionDuration: {
        '0': '0ms',
      },
    },
  },
  plugins: [],
  corePlugins: {
    float: false,
    clear: false,
    skew: false,
  },
  future: {
    hoverOnlyWhenSupported: true,
    respectDefaultRingColorOpacity: true,
  },
}

