import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',

  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],

  theme: {
    extend: {
      colors: {
        spann: {
          bg: {
            primary: '#111113',
            secondary: '#1C1C1E',
            tertiary: '#2C2C2E',
            // Light mode overrides (applied via light: variant)
            'primary-light': '#F2F2F7',
            'secondary-light': '#FFFFFF',
            'tertiary-light': '#E5E5EA',
          },
          accent: '#0A84FF',
          'accent-soft': 'rgba(10,132,255,0.15)',
          'accent-light': '#007AFF',
          'accent-soft-light': 'rgba(0,122,255,0.12)',
          accent2: '#BF5AF2',
          'accent2-light': '#AF52DE',
          green: '#30D158',
          'green-light': '#34C759',
          red: '#FF453A',
          'red-light': '#FF3B30',
          orange: '#FF9F0A',
          'orange-light': '#FF9500',
          text: {
            primary: '#F5F5F7',
            secondary: 'rgba(245,245,247,0.65)',
            muted: 'rgba(245,245,247,0.45)',
            // Light mode
            'primary-light': '#1D1D1F',
            'secondary-light': 'rgba(29,29,31,0.65)',
            'muted-light': 'rgba(29,29,31,0.45)',
          },
          border: 'rgba(255,255,255,0.08)',
          'border-light': 'rgba(0,0,0,0.10)',
          card: 'rgba(44,44,46,0.6)',
          'card-light': 'rgba(255,255,255,0.7)',
        },
      },

      fontFamily: {
        outfit: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },

      borderRadius: {
        'apple-sm': '12px',
        'apple-md': '16px',
        'apple-lg': '20px',
        'apple-pill': '50px',
      },

      boxShadow: {
        'apple-sm': '0 2px 8px rgba(0,0,0,0.24), 0 1px 2px rgba(0,0,0,0.16)',
        'apple-md': '0 4px 20px rgba(0,0,0,0.32), 0 2px 6px rgba(0,0,0,0.20)',
        'apple-lg': '0 8px 40px rgba(0,0,0,0.40), 0 4px 12px rgba(0,0,0,0.28)',
      },

      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        waveform: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },

      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        waveform: 'waveform 1s ease-in-out infinite',
        'slide-up': 'slide-up 200ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },

  plugins: [],
}

export default config
