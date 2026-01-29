// middleware/requireTier.js
module.exports = function requireTier(
  allowed = ["basic", "test", "medium", "premium", "free"]
) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const status = user.subscriptionStatus;
    const plan = user.subscriptionPlan || "free";

    // 1) Must be actively subscribed (or trialing)
    if (!["active", "trialing"].includes(status)) {
      return res.status(402).json({ error: "Subscription required" });
    }

    // 2) Must be on an allowed plan
    if (!allowed.includes(plan)) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    // 3) Must be Stripe-linked (prevents legacy "active/basic" users with null Stripe IDs)
    // Since you said you rely on stripeSubscriptionId, treat missing as NOT paid.
    if (!user.stripeSubscriptionId) {
      return res.status(402).json({ error: "Subscription required" });
    }

    next();
  };
};
