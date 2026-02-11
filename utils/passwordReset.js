const crypto = require("crypto");

function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  return { rawToken, tokenHash };
}

module.exports = { generateResetToken };
