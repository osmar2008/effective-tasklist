module.exports = {
  async constraints({ Yarn }) {
    for (const dep of Yarn.dependencies({ ident: "@nestjs/core" })) {
      dep.update(`^9.0.0`);
    }
    for (const dep of Yarn.dependencies({ ident: "@nestjs/common" })) {
      dep.update(`^9.0.0`);
    }
  },
};
