const jwt = require("jsonwebtoken");

const JWT_SECRET = require("../utils/config");
if (!JWT_SECRET || typeof JWT_SECRET !== "string") {
  throw new Error("JWT_SECRET missing/invalid");
}
// const UnauthorizedError = require('../errors/unauthorizedError');

function authorize(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization required" });
  }

  const token = auth.slice(7).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload._id) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = payload; // { _id, ... }
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Authorization required" });
  }
}

module.exports = authorize;
