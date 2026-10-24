import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontSize: { "2xs": "0.6875rem" },
    },
  },
  plugins: [],
} satisfies Config;
