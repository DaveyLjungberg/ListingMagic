import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './libs/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Framer-inspired dark palette
        background: '#050505',
        surface: '#121212',
        'surface-highlight': '#1E1E1E',
        border: '#2A2A2A',
        primary: '#0099FF',
        'text-main': '#FFFFFF',
        'text-muted': '#888888',
      },
      fontFamily: {
        // Inter only - no serif fonts
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [
    daisyui,
  ],
  daisyui: {
    themes: [
      {
        quicklistDark: {
          // Base colors matching our palette
          'base-100': '#050505',  // background
          'base-200': '#121212',  // surface
          'base-300': '#1E1E1E',  // surface-highlight
          'base-content': '#FFFFFF',  // text-main
          
          // Primary action color
          'primary': '#0099FF',
          'primary-content': '#FFFFFF',
          
          // Secondary/accent colors (muted blue variations)
          'secondary': '#0088DD',
          'secondary-content': '#FFFFFF',
          
          'accent': '#00AAFF',
          'accent-content': '#FFFFFF',
          
          // Semantic colors for DaisyUI components
          'neutral': '#1E1E1E',
          'neutral-content': '#888888',
          
          'info': '#0099FF',
          'info-content': '#FFFFFF',
          
          'success': '#10B981',
          'success-content': '#FFFFFF',
          
          'warning': '#F59E0B',
          'warning-content': '#000000',
          
          'error': '#EF4444',
          'error-content': '#FFFFFF',
        },
      },
    ],
    darkTheme: 'quicklistDark',
    base: true,
    styled: true,
    utils: true,
  },
};

