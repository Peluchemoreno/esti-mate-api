// services/subscriptionResolver.js

const BusinessSubscription = require("../models/businessSubscription");

async function resolveSubscription(user) {
  // default fallback (legacy)
  const legacy = {
    plan: user.subscriptionPlan || "free",
    status: user.subscriptionStatus || "disabled",
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    source: "user",
  };

  if (process.env.FF_SUBSCRIPTION_BY_BUSINESS !== "true") {
    return legacy;
  }

  if (!user.personalBusinessId) {
    return legacy;
  }

  try {
    const sub = await BusinessSubscription.findOne({
      businessId: user.personalBusinessId,
    }).lean();

    if (!sub) return legacy;

    return {
      plan: sub.plan || legacy.plan,
      status: sub.status || legacy.status,
      stripeSubscriptionId:
        sub.stripeSubscriptionId || legacy.stripeSubscriptionId,
      source: "business",
    };
  } catch (err) {
    console.error("subscriptionResolver error:", err);
    return legacy;
  }
}

module.exports = resolveSubscription;
