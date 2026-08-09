/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF4FF',
          100: '#D9E6FF',
          300: '#7FA8FF',
          500: '#2D6CFF',
          700: '#1B45B3',
          900: '#0F2966',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#F7F8FA',
          100: '#EEF0F3',
          300: '#C7CCD4',
          500: '#8A93A3',
          700: '#4A5261',
          900: '#1A1F29',
        },
        success: { 500: '#1BA672' },
        danger: { 500: '#E5484D' },
        warning: { 500: '#F5A623' },
        info: { 500: '#2D9BFF' },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Times New Roman', 'Noto Serif', 'serif'],
      },
    },
  },
  plugins: [],
}
