/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand Primary Colors
        'brand-lime': '#D9EE50',
        'brand-dark': '#231F20',
        'brand-white': '#FFFFFF',
        
        // Brand Secondary Colors
        'brand-purple': '#C3AFFE',
        'brand-cyan': '#6FE1EE',
        'brand-coral': '#FF9292',
        
        // Semantic colors using brand palette
        primary: {
          DEFAULT: '#D9EE50',
          50: '#FAFEF0',
          100: '#F3FBDA',
          200: '#EBF7C4',
          300: '#E2F48E',
          400: '#D9EE50',
          500: '#D0E62E',
          600: '#B8CF1A',
          700: '#8F9F14',
          800: '#67700E',
          900: '#3F4308',
        },
        dark: {
          DEFAULT: '#231F20',
          50: '#F7F7F7',
          100: '#E5E5E5',
          200: '#CCCCCC',
          300: '#999999',
          400: '#666666',
          500: '#333333',
          600: '#231F20',
          700: '#1A1718',
          800: '#121011',
          900: '#0A0809',
        },
        accent: {
          purple: '#C3AFFE',
          cyan: '#6FE1EE',
          coral: '#FF9292',
        },
        sidebar: {
          DEFAULT: '#1A1718',
          hover: 'rgba(255,255,255,0.05)',
          active: 'rgba(255,255,255,0.10)',
          border: 'rgba(255,255,255,0.08)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
