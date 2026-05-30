export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "navy-deep": "oklch(0.16 0.05 255)",
        "navy-mid":  "oklch(0.20 0.04 250)",
        "amber":     "oklch(0.78 0.16 75)",
        primary:     "#6366f1", // Indigo
        warning:     "#eab308", // Amber/Yellow
        success:     "#22c55e", // Green
        danger:      "#ef4444", // Red
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        ping: {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};
