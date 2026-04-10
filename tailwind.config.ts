import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',

  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],

  theme: {
    extend: {
      colors: {
        "on-tertiary-fixed-variant": "#004881",
        "on-tertiary-fixed": "#001c38",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "surface-container-highest": "#e2e2e2",
        "surface-dim": "#dadada",
        "outline-variant": "#c0c7d4",
        "outline": "#717783",
        "primary-fixed-dim": "#a3c9ff",
        "tertiary-fixed": "#d3e4ff",
        "surface-container-lowest": "#ffffff",
        "on-primary-fixed-variant": "#004883",
        "on-tertiary": "#ffffff",
        "secondary-fixed-dim": "#9ecaff",
        "surface-bright": "#f9f9f9",
        "primary": "#005faa",
        "error": "#ba1a1a",
        "surface-container-low": "#f3f3f3",
        "on-primary-fixed": "#001c39",
        "on-secondary-fixed": "#001d36",
        "on-secondary-fixed-variant": "#00497d",
        "primary-container": "#0078d4",
        "tertiary-container": "#3779bf",
        "surface-container-high": "#e8e8e8",
        "on-surface": "#1a1c1c",
        "on-secondary-container": "#003f6d",
        "background": "#f9f9f9",
        "inverse-on-surface": "#f1f1f1",
        "secondary-container": "#5badff",
        "surface-tint": "#0060ab",
        "on-primary": "#ffffff",
        "primary-fixed": "#d3e3ff",
        "secondary": "#0061a3",
        "surface-container": "#eeeeee",
        "on-background": "#1a1c1c",
        "surface": "#f9f9f9",
        "inverse-primary": "#a3c9ff",
        "on-primary-container": "#ffffff",
        "tertiary-fixed-dim": "#a2c9ff",
        "inverse-surface": "#2f3131",
        "on-error": "#ffffff",
        "on-surface-variant": "#404752",
        "surface-variant": "#e2e2e2",
        "tertiary": "#1160a4",
        "on-tertiary-container": "#ffffff",
        "on-secondary": "#ffffff",
        "secondary-fixed": "#d1e4ff",
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
        headline: ['Inter'],
        body: ['Inter'],
        label: ['Inter'],
      },

      borderRadius: {
        'apple-sm': '12px',
        'apple-md': '16px',
        'apple-lg': '20px',
        'apple-pill': '50px',
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
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

  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}

export default config
