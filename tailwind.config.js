/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 50:'#eef6f4',100:'#d7ebe5',200:'#b0d7cb',300:'#7fbdaa',400:'#4da087',500:'#2c846d',600:'#1f6a57',700:'#1c5647',800:'#1a453b',900:'#173a32',950:'#0c201c' },
        ink: { 50:'#f6f7f9',100:'#eceef2',200:'#d5dae2',300:'#b1bac8',400:'#8794a9',500:'#68778f',600:'#535f76',700:'#444e61',800:'#3a4251',900:'#23272f',950:'#14171c' },
        accent: { 400:'#e8b34b', 500:'#dd9b26', 600:'#b97a17' },
      },
      fontFamily: {
        sans: ['Inter','Hind Siliguri','system-ui','-apple-system','Segoe UI','Roboto','sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,23,28,.05), 0 4px 16px -8px rgba(20,23,28,.12)',
        pop: '0 8px 30px -6px rgba(20,23,28,.18)',
      },
      borderRadius: { xl2: '1.1rem' },
    },
  },
  plugins: [],
};
