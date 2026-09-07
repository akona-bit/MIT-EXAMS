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
          50: '#eff6ff',
          100: '#dbeafe',
          300: '#93c5fd',
          400: '#3b82f6', 
          500: '#1e40af', // Xanh dương đậm
          600: '#1e3a8a', 
          700: '#172554',
          900: '#0f172a',
        },
        studentPrimary: {
          50: '#F0FDF4', // Emerald tinted
          100: '#DCFCE7',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          900: '#14532D',
        },
        studentNeutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
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
