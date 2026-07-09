/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#EAE7DF',
        surface: '#F5F3EC',
        'text-primary': '#2B332C',
        'text-secondary': '#6E6A5E',
        'accent-calm': '#7C9473',
        'accent-warm': '#9D7B72',
        'button-primary': '#3C4A3D',
        'button-primary-text': '#F0EEE5',
      },
      fontFamily: {
        display: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Work Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
      },
      // ~1.5× the default mobile spacing scale
      spacing: {
        section: '3rem',    // 48px between major sections
        block: '1.75rem',   // 28px between internal blocks
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(0.9)', opacity: '0.7' },
          '50%':       { transform: 'scale(1.1)', opacity: '1'   },
        },
      },
      animation: {
        breathe: 'breathe 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
