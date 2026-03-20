import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#eef5ff",
          500: "#356dff",
          600: "#2458dd"
        }
      }
    }
  },
  plugins: []
};

export default config;
