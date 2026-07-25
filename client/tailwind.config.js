/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        },
        neon: {
          cyan: '#00ffff',
          blue: '#0088ff',
          green: '#00ff88',
          pink: '#ff0088',
          orange: '#ff8800',
        },
        tron: {
          bg: '#000810',
          surface: '#020f1a',
          card: '#031525',
          border: '#003344',
          glow: '#00ffff',
        }
      },
      fontFamily: {
        sans: ['Orbitron', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Share Tech Mono', 'JetBrains Mono', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 10px #00ffff, 0 0 20px #00ffff33',
        'neon-lg': '0 0 20px #00ffff, 0 0 40px #00ffff55, 0 0 80px #00ffff22',
        'neon-sm': '0 0 5px #00ffff88',
        'neon-pink': '0 0 10px #ff0088, 0 0 20px #ff008833',
        'neon-green': '0 0 10px #00ff88, 0 0 20px #00ff8833',
        'card': '0 4px 24px rgba(0, 255, 255, 0.08)',
        'card-hover': '0 8px 40px rgba(0, 255, 255, 0.15)',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'grid-move': 'gridMove 20s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'data-stream': 'dataStream 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 5px #00ffff, 0 0 10px #00ffff33' },
          '50%': { boxShadow: '0 0 20px #00ffff, 0 0 40px #00ffff55, 0 0 60px #00ffff22' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gridMove: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '60px 60px' },
        },
        flicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.4' },
        },
        dataStream: {
          '0%': { transform: 'translateY(0%)', opacity: '1' },
          '100%': { transform: 'translateY(-100%)', opacity: '0' },
        },
      },
      backgroundImage: {
        'tron-grid': `
          linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px)
        `,
        'radial-glow': 'radial-gradient(ellipse at center, rgba(0, 255, 255, 0.1) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(135deg, rgba(3,21,37,0.9) 0%, rgba(2,15,26,0.95) 100%)',
      },
      backgroundSize: {
        'grid': '60px 60px',
      },
    },
  },
  plugins: [],
}
