import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#F97316",
          "orange-dark": "#EA580C",
          "orange-light": "#FED7AA",
          black: "#111111",
        },
      },
    },
  },
  plugins: [],
};

export default config;
