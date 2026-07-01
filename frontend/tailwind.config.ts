import type { Config } from "tailwindcss";

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
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          glow: "hsl(var(--secondary-glow))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'var(--gradient-secondary)',
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-dark': 'var(--gradient-dark)',
      },
      boxShadow: {
        'glow': 'var(--shadow-glow)',
        'glow-secondary': 'var(--shadow-glow-secondary)',
        'elevated': 'var(--shadow-elevated)',
      },
      transitionProperty: {
        'smooth': 'var(--transition-smooth)',
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
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.5) rotate(-5deg)", opacity: "0" },
          "50%": { transform: "scale(1.1) rotate(2deg)" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(263 70% 50% / 0.5)" },
          "50%": { boxShadow: "0 0 40px hsl(263 70% 50% / 0.8)" },
        },
        "celebrate": {
          "0%": { transform: "scale(1) rotate(0deg)" },
          "25%": { transform: "scale(1.2) rotate(10deg)" },
          "50%": { transform: "scale(1.1) rotate(-10deg)" },
          "75%": { transform: "scale(1.2) rotate(5deg)" },
          "100%": { transform: "scale(1) rotate(0deg)" },
        },
        // Bid amount scale-pulse when a new bid is placed
        "bid-pulse": {
          "0%":   { transform: "scale(1)",    color: "hsl(30 100% 55%)" },
          "30%":  { transform: "scale(1.18)", color: "hsl(45 100% 60%)" },
          "60%":  { transform: "scale(1.22)", color: "hsl(142 76% 50%)" },
          "100%": { transform: "scale(1)",    color: "hsl(30 100% 55%)" },
        },
        // Card entrance: slide up from 40px + fade in
        "slide-in-up": {
          "0%":   { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Slam-in for important badges (SOLD label etc.)
        "slam-in": {
          "0%":   { opacity: "0", transform: "scale(2) rotate(-8deg)" },
          "60%":  { transform: "scale(0.92) rotate(3deg)" },
          "80%":  { transform: "scale(1.06) rotate(-1deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
        // Timer urgency pulse — rings red as deadline nears
        "timer-pulse": {
          "0%, 100%": { transform: "scale(1)",    boxShadow: "0 0 0px rgba(239,68,68,0)" },
          "50%":      { transform: "scale(1.08)", boxShadow: "0 0 20px rgba(239,68,68,0.7)" },
        },
        // Gentle float for the "waiting" idle state
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        // Leading-team shimmer border
        "shimmer-border": {
          "0%":   { borderColor: "hsl(263 70% 50% / 0.4)" },
          "50%":  { borderColor: "hsl(30 100% 55% / 0.9)" },
          "100%": { borderColor: "hsl(263 70% 50% / 0.4)" },
        },
        // Page fade-in for route transitions
        "page-enter": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Shake for bid errors
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%":      { transform: "translateX(-6px)" },
          "40%":      { transform: "translateX(6px)" },
          "60%":      { transform: "translateX(-4px)" },
          "80%":      { transform: "translateX(4px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "pop-in": "pop-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "slide-up": "slide-up 0.4s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "celebrate": "celebrate 0.6s ease-in-out",
        "bid-pulse": "bid-pulse 0.4s cubic-bezier(0.36,0.07,0.19,0.97)",
        "slide-in-up": "slide-in-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "slam-in": "slam-in 0.5s cubic-bezier(0.68,-0.55,0.265,1.55)",
        "timer-pulse": "timer-pulse 0.7s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer-border": "shimmer-border 1.5s ease-in-out infinite",
        "page-enter": "page-enter 0.35s ease-out both",
        "shake": "shake 0.4s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
