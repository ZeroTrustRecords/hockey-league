/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0e1a',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
          500: '#4b5563',
        },
        ice: {
          DEFAULT: '#e0f2fe',
          blue: '#38bdf8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
