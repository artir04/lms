import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
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
          DEFAULT:  'rgb(var(--color-surface) / <alpha-value>)',
          base:     'rgb(var(--color-surface-base) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
          overlay:  'rgb(var(--color-surface-overlay) / <alpha-value>)',
        },
        ink: {
          DEFAULT:   'rgb(var(--color-ink) / <alpha-value>)',
          secondary: 'rgb(var(--color-ink-secondary) / <alpha-value>)',
          muted:     'rgb(var(--color-ink-muted) / <alpha-value>)',
          faint:     'rgb(var(--color-ink-faint) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong:  'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT:      'rgb(var(--color-sidebar) / <alpha-value>)',
          hover:        'rgb(var(--color-sidebar-hover) / <alpha-value>)',
          border:       'rgb(var(--color-sidebar-border) / <alpha-value>)',
          text:         'rgb(var(--color-sidebar-text) / <alpha-value>)',
          'text-active':'rgb(var(--color-sidebar-text-active) / <alpha-value>)',
          accent:       'rgb(var(--color-sidebar-accent) / <alpha-value>)',
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
        card:        'var(--shadow-card)',
        'card-hover':'var(--shadow-card-hover)',
        topbar:      'var(--shadow-topbar)',
        sidebar:     'var(--shadow-sidebar)',
        glow:        'var(--shadow-glow)',
        'glow-lg':   'var(--shadow-glow-lg)',
        glass:       'var(--shadow-glass)',
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
