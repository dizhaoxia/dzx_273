/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        brand: {
          50: '#f0f4fa',
          100: '#d9e3f1',
          200: '#b3c7e3',
          300: '#8dabd5',
          400: '#5d84c0',
          500: '#3a65a8',
          600: '#2e528a',
          700: '#1e3a5f',
          800: '#162c47',
          900: '#0f1e31',
          950: '#0a1420',
        },
        success: '#10b981',
        collaborator: {
          orange: '#f97316',
          purple: '#a855f7',
          pink: '#ec4899',
          cyan: '#06b6d4',
          amber: '#f59e0b',
          emerald: '#10b981',
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
