import { Linter } from "eslint";

const config: Linter.Config = {
  extends: ["@remix-run/eslint-config", "@remix-run/eslint-config/node"],
};

export default config;
