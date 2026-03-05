// middleware/requireTier.js

const BusinessSubscription = require("../models/businessSubscription");

function flagOn(name) {
  return ["1", "true", "yes", "on"].includes(
    String(process.env[name] || "").toLowerCase(),
  );
}

async function resolveEffectiveSubscription(user) {
  const legacy = {
    status: user.subscriptionStatus,
    plan: user.subscriptionPlan || "free",
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    source: "user",
  };

  if (!flagOn("FF_SUBSCRIPTION_BY_BUSINESS")) {
    return legacy;
  }

  const businessId = user.personalBusinessId;

  if (!businessId) {
    return legacy;
  }

  try {
    const sub = await BusinessSubscription.findOne({ businessId }).lean();

    if (!sub) return legacy;

    return {
      status: sub.status || legacy.status,
      plan: sub.plan || legacy.plan,
      stripeSubscriptionId:
        sub.stripeSubscriptionId || legacy.stripeSubscriptionId,
      source: "business",
    };
  } catch (err) {
    console.error("Subscription resolver error:", err);
    return legacy;
  }
}

module.exports = function requireTier(
  allowed = ["basic", "test", "medium", "premium", "free"],
) {
  return async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const subscription = await resolveEffectiveSubscription(user);

    const status = subscription.status;
    const plan = subscription.plan;

    if (!["active", "trialing"].includes(status)) {
      return res.status(402).json({ error: "Subscription required" });
    }

    if (!allowed.includes(plan)) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    if (!subscription.stripeSubscriptionId) {
      return res.status(402).json({ error: "Subscription required" });
    }

    req.subscription = subscription;

    next();
  };
};
