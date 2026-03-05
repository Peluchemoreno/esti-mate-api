const BusinessSubscription = require("../models/businessSubscription");

async function upsertBusinessSubscription({
  businessId,
  stripeCustomerId,
  stripeSubscriptionId,
  plan,
  status,
  priceId,
  seatQuantity = 1,
  cancelAtPeriodEnd = false,
  currentPeriodStart,
  currentPeriodEnd,
  trialEnd,
}) {
  if (!businessId) return;

  await BusinessSubscription.updateOne(
    { businessId },
    {
      $set: {
        stripeCustomerId,
        stripeSubscriptionId,
        plan,
        status,
        priceId,
        seatQuantity,
        cancelAtPeriodEnd,
        currentPeriodStart,
        currentPeriodEnd,
        trialEnd,
      },
    },
    { upsert: true },
  );
}

module.exports = {
  upsertBusinessSubscription,
};
