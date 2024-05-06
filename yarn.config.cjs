// @ts-check
/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require("@yarnpkg/types");
module.exports = defineConfig({
  async constraints({ Yarn }) {
    for (const dep of Yarn.dependencies({ ident: "@nestjs/core" })) {
      if (dep.range !== "^10") {
        console.log(`${dep.workspace.ident} => Updating @nestjs/core to ^10`);
        dep.update(`^10`);
      }
    }
    for (const dep of Yarn.dependencies({ ident: "@nestjs/common" })) {
      dep.update(`^10`);
    }
  },
});
