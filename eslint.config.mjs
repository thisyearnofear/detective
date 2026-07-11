import nextVitals from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "cache/**",
      "scripts/**",
      "next-env.d.ts",
    ],
  },
  {
    // Next 16 ships react-hooks v7 with React Compiler rules.
    // Keep them visible without blocking the upgrade on pre-existing patterns.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "import/no-anonymous-default-export": "warn",
      "react/display-name": "warn",
    },
  },
];

export default config;
