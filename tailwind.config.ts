import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#121212", // Primary Background
        foreground: "#FFFFFF", // Primary Text
        primary: {
          DEFAULT: "#3b82f6", // Krew Blue
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#181818", // Secondary Surface
          foreground: "#B3B3B3", // Secondary Text
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "#282828",
          foreground: "#B3B3B3",
        },
        accent: {
          DEFAULT: "#3b82f6",
          foreground: "#FFFFFF",
        },
        popover: {
          DEFAULT: "#181818",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#181818",
          foreground: "#FFFFFF",
        },
          sidebar: {
          DEFAULT: "#121212", // Mobile sidebar usually matches background or slightly elevated
          foreground: "#B3B3B3",
          primary: "#3b82f6",
          "primary-foreground": "#FFFFFF",
          accent: "#121212",
          "accent-foreground": "#FFFFFF",
          border: "#181818",
          ring: "#3b82f6",
        },
        surface: "#181818",
        elevator: "#1E1E1E", // Elevated Card Surface
        divider: "rgba(255,255,255,0.08)",
        disabled: "#535353",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px -4px hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 30px -2px hsl(var(--primary) / 0.5)" },
        },
        "breathe": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "glow-pulse": {
          "0%, 100%": { filter: "blur(8px)", opacity: "0.5" },
          "50%": { filter: "blur(12px)", opacity: "0.8" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-in-left": "slide-in-left 0.3s ease-out forwards",
        "scale-in": "scale-in 0.2s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "breathe": "breathe 3s ease-in-out infinite",
        "shimmer": "shimmer 1.5s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} as Config;
