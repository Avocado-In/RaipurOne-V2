module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        bw: {
          black: '#000000',
          white: '#FFFFFF',
          gray: {
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            400: '#9CA3AF',
            500: '#6B7280',
            600: '#4B5563',
            700: '#374151',
            800: '#1F2937',
            900: '#111827',
          },
        },
        light: {
          bg: '#FAFAFA',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          text: {
            primary: '#1A1A1A',
            secondary: '#666666',
            tertiary: '#999999',
          },
        },
        dark: {
          bg: '#0A0A0A',
          surface: '#1A1A1A',
          border: '#2A2A2A',
          text: {
            primary: '#FFFFFF',
            secondary: '#B3B3B3',
            tertiary: '#808080',
          },
        },
      },
      spacing: {
        'sidebar-collapsed': '4rem',
        'sidebar-expanded': '16rem',
      },
      transitionDuration: {
        '400': '400ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'elevation-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        'elevation-md': '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
        'elevation-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
