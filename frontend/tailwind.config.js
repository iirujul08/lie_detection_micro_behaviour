/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0B0F14',
          surface: '#121821',
          elevated: '#17202C',
          border: '#1E2733',
          borderLight: '#2A3647',
          cyan: '#22D3EE',
          violet: '#8B5CF6',
          truth: '#10B981',
          suspicious: '#F59E0B',
          deceptive: '#EF4444'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
