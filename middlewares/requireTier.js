// middleware/requireTier.js
module.exports = function requireTier(
  allowed = ["basic", "test", "medium", "premium", "free"]
) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const status = user.subscriptionStatus; // you already store this :contentReference[oaicite:5]{index=5}
    const plan = user.subscriptionPlan || "free"; // you already store this :contentReference[oaicite:6]{index=6}

    if (!["active", "trialing"].includes(status)) {
      return res.status(402).json({ error: "Subscription required" });
    }
    if (!allowed.includes(plan)) {
      return res.status(403).json({ error: "Upgrade required" });
    }
    next();
  };
};
