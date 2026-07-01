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
      },
    },
  },
  plugins: [],
}

