/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cyan: { DEFAULT: "#179DD0", dark: "#1188B5", light: "#EAF6FC" },
        navy: { DEFAULT: "#06091A", 2: "#0D1226", 3: "#141935" },
        deepnavy: { DEFAULT: "#130656", light: "#EEF0FF", 2: "#1a0875" },
        green: { DEFAULT: "#16A34A", light: "#F0FDF4" },
        amber: { DEFAULT: "#D97706", light: "#FFFBEB" },
        red: { DEFAULT: "#DC2626", light: "#FEF2F2" },
        ink: { DEFAULT: "#0F172A", 2: "#334155", 3: "#64748B", 4: "#94A3B8" },
        border: "#E8EDF5",
        surface: "#F8FAFC",
        pagebg: "#F1F5FB",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,.05), 0 4px 16px rgba(15,23,42,.07)",
        lift: "0 8px 28px rgba(15,23,42,.12)",
        glow: "0 0 0 1px rgba(23,157,208,.18), 0 24px 60px -12px rgba(6,9,26,.55)",
        hero: "0 1px 3px rgba(6,9,26,.3), 0 16px 32px -8px rgba(6,9,26,.45), inset 0 1px 0 rgba(255,255,255,.04)",
      },
      borderRadius: {
        card: "14px",
      },
      spacing: {
        sidebar: "256px",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { boxShadow: "0 0 0 3px rgba(74,222,128,.2)" },
          "50%": { boxShadow: "0 0 0 6px rgba(74,222,128,.05)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "gauge-rise": {
          "0%": { height: "0%" },
          "100%": { height: "var(--gauge-level, 68%)" },
        },
        "gauge-wave": {
          "0%, 100%": { transform: "translateX(-3%) translateY(0)" },
          "50%": { transform: "translateX(3%) translateY(-2px)" },
        },
        "pulse-line": {
          "0%": { backgroundPosition: "0% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%) skewX(-12deg)" },
          "100%": { transform: "translateX(320%) skewX(-12deg)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2.2s ease-in-out infinite",
        shimmer: "shimmer 1.4s infinite",
        "spin-fast": "spin .7s linear infinite",
        "fade-up": "fade-up .5s cubic-bezier(.2,.7,.2,1) both",
        "gauge-rise": "gauge-rise 1.4s cubic-bezier(.16,1,.3,1) both",
        "gauge-wave": "gauge-wave 3.2s ease-in-out infinite",
        "pulse-line": "pulse-line 2.4s linear infinite",
        sheen: "sheen 4.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
