// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        navy: {
          700: "#162d58",
          800: "#0f2040",
          900: "#0a1628",
          950: "#060d1a",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          900: "#064e3b",
        },
      },
      boxShadow: {
        "emerald-glow": "0 0 24px rgba(16,185,129,0.15)",
        "card": "0 4px 24px rgba(0,0,0,0.4)",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease both",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      borderRadius: {
        xl: "12px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
