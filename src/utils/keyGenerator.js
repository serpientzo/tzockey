const crypto = require("crypto");

function generateKey() {
  const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part3 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part4 = crypto.randomBytes(2).toString("hex").toUpperCase();

  return `TZK-${part1}-${part2}-${part3}-${part4}`;
}

module.exports = {
  generateKey,
};
