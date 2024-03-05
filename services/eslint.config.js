import tsparser from "@typescript-eslint/parser";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "management/tsconfig.json",
        sourceType: "module",
        ecmaVersion: "latest",
      },
      globals: {
        node: true,
        jest: true,
      },
    },
    files: ["**/*.ts"],
    rules: {
      "no-console": "error",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
