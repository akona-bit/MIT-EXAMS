/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#A855F7',
          600: '#9333EA',
          700: '#7E22CE', // Default primary is roughly #7C3AED
          800: '#6B21A8',
          900: '#581C87',
          950: '#3B0764',
        },
        accent: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2', // Default accent
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
          950: '#083344',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#F7F8FA',
          100: '#EEF0F3',
          200: '#E0E4EB', // Added
          300: '#C7CCD4',
          400: '#A3ADC0', // Added
          500: '#8A93A3',
          600: '#647087', // Added
          700: '#4A5261',
          800: '#2D3545', // Added
          900: '#1A1F29',
          950: '#0F1218', // Added deeply dark
        },
        success: { 500: '#1BA672' },
        danger: { 500: '#E5484D' },
        warning: { 500: '#F5A623' },
        info: { 500: '#2D9BFF' },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Times New Roman"', 'Noto Serif', 'serif'],
      },
      zIndex: {
        'sidebar': '40',
        'header': '30',
        'dropdown': '50',
        'modal': '60',
        'command': '70',
        'toast': '80',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
