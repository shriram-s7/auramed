/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0A1628',
        accent: '#0D9488',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        surface: '#FFFFFF',
        background: '#F8FAFC',
        border: '#E2E8F0',
      },
    },
  },
  plugins: [],
}
