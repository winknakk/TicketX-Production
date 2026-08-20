/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        indigo: {
          500: '#6366F1',
        },
        pink: {
          500: '#EC4899',
        },
        green: {
          500: '#10B981',
        },
        amber: {
          500: '#F59E0B',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
