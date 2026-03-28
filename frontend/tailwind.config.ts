import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fef7ed',
          100: '#fcecd4',
          200: '#f8d5a8',
          300: '#f3b770',
          400: '#ed9338',
          500: '#e87d1a',
          600: '#d96410',
          700: '#b44c10',
          800: '#903c15',
          900: '#743314',
          950: '#3f1808',
        },
        surface: {
          DEFAULT:  '#111318',
          base:     '#0b0d12',
          elevated: '#181b24',
          overlay:  '#1e2130',
        },
        ink: {
          DEFAULT:   '#e4e3ed',
          secondary: '#8b8da2',
          muted:     '#585a6e',
          faint:     '#2e3045',
        },
        border: {
          DEFAULT: '#1c1f30',
          strong:  '#282b40',
        },
        sidebar: {
          DEFAULT:      '#090b10',
          hover:        '#12151f',
          border:       '#161929',
          text:         '#636780',
          'text-active':'#e4e3ed',
          accent:       '#ed9338',
        },
        success:  { DEFAULT: '#34d399', muted: '#064e3b' },
        danger:   { DEFAULT: '#f87171', muted: '#450a0a' },
        warning:  { DEFAULT: '#fbbf24', muted: '#451a03' },
        info:     { DEFAULT: '#60a5fa', muted: '#172554' },
      },
      fontFamily: {
        sans:    ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:        '0 1px 2px 0 rgba(0,0,0,0.3), 0 1px 6px -1px rgba(0,0,0,0.2)',
        'card-hover':'0 8px 30px 0 rgba(0,0,0,0.4), 0 2px 10px -2px rgba(0,0,0,0.3)',
        topbar:      '0 1px 0 0 rgba(255,255,255,0.03)',
        sidebar:     '4px 0 24px 0 rgba(0,0,0,0.5)',
        glow:        '0 0 20px rgba(237,147,56,0.15)',
        'glow-lg':   '0 0 40px rgba(237,147,56,0.2)',
        glass:       'inset 0 1px 0 0 rgba(255,255,255,0.03)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      animation: {
        'slide-in':    'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':     'fadeIn 0.2s ease-out',
        'fade-up':     'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':    'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        'shimmer':     'shimmer 2s linear infinite',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'float':       'float 6s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%':   { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
