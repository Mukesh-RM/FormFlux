import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // FormFlux accent: a warm terracotta reserved for primary actions only.
        accent: {
          50: "#fff5ed",
          100: "#ffe8d5",
          200: "#fecdaa",
          300: "#fdaa74",
          400: "#fb7c3c",
          500: "#f95c16",
          600: "#e2450c",
          700: "#bb320c",
          800: "#952a12",
          900: "#782612",
          950: "#410f06",
        },
        ink: {
          DEFAULT: "#1c1917",
          soft: "#44403c",
          muted: "#78716c",
          faint: "#a8a29e",
        },
        surface: {
          DEFAULT: "#ffffff",
          sunken: "#faf9f8",
          raised: "#ffffff",
        },
        line: "#e7e5e4",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.035em",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,25,23,0.04), 0 8px 24px rgba(28,25,23,0.05)",
        pop: "0 12px 40px rgba(28,25,23,0.12)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
