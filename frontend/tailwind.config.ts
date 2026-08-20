import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm terracotta — replaces stock Tailwind blue as the brand accent
        primary: {
          50:  "#fdf3ee",
          100: "#fbe3d6",
          200: "#f5c5ac",
          300: "#eda078",
          400: "#e17c4e",
          500: "#cf5d2e",
          600: "#b04723",
          700: "#8e381d",
          800: "#722f1c",
          900: "#5e2a1a",
        },
        // Warm stone neutrals — replaces Tailwind's cool default gray app-wide
        gray: {
          50:  "#faf8f5",
          100: "#f3efe8",
          200: "#e7e0d4",
          300: "#d3c7b4",
          400: "#a99b83",
          500: "#83745e",
          600: "#635646",
          700: "#4a4033",
          800: "#332b22",
          900: "#221c16",
          950: "#14100c",
        },
        urgent: "#b5432f",
        warning: "#b3812c",
        success: "#5c7a4a",
        olive: {
          50:  "#f4f5ee",
          100: "#e6e9d6",
          400: "#93a06a",
          500: "#75824f",
          600: "#5c6a3d",
        },
      },
      fontFamily: {
        sans: ["Work Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        warm: "0 2px 10px -2px rgba(94, 42, 26, 0.08), 0 1px 2px -1px rgba(94, 42, 26, 0.06)",
        'warm-lg': "0 12px 32px -8px rgba(94, 42, 26, 0.16), 0 4px 12px -4px rgba(94, 42, 26, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
