/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#0e0e15",
        panel:   "#1a1a2e",
        panel2:  "#13131f",
        bdr:     "#2a2a3a",
        primary: "#6b26d9",
        muted:   "#64748b",
        live:    "#22c55e",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

