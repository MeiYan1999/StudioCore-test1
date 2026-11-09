import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "data/**",
      "public/uploads/**",
      "coverage/**",
      "desktop-app/**",
      "public/downloads/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
