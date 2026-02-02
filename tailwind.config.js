/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // QAerx Dark Theme
        dark: {
          50: '#f7f7f8',
          100: '#ececf1',
          200: '#d9d9e3',
          300: '#c5c5d2',
          400: '#acacbe',
          500: '#8e8ea0',
          600: '#565869',
          700: '#40414f',
          800: '#343541',
          850: '#2a2b32',  // Added for modern minimal design
          900: '#202123',
          950: '#0d0d0f',
        },
        accent: {
          DEFAULT: '#10b981',  // Emerald green from logo
          hover: '#059669',
          light: '#34d399',
        },
        primary: {
          DEFAULT: '#2d3a6d',  // Navy blue from logo
          light: '#3d4a7d',
          dark: '#1e2a5e',
        },
        status: {
          pass: '#22c55e',
          fail: '#ef4444',
          running: '#3b82f6',
          pending: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
