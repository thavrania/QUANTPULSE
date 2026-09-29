import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#060A11",
        panel: "#0D1422",
        panelHover: "#152036",
        borderSubtle: "#1E293B",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "crossover-pulse": "crossoverPulse 2s infinite",
      },
      keyframes: {
        crossoverPulse: {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)",
            borderColor: "rgba(16, 185, 129, 0.75)",
          },
          "50%": {
            boxShadow: "0 0 18px 2px rgba(16, 185, 129, 0.28)",
            borderColor: "rgba(52, 211, 153, 1)",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
