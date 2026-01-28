// webhooks/stripeHandlers.js
const mongoose = require("mongoose");
const User = require("../models/user");
const Processed = mongoose.model(
  "ProcessedStripeEvents",
  new mongoose.Schema(
    {
      _id: { type: String }, // event.id
      type: String,
      receivedAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
  )
);

const PRICE_TO_PLAN = {
  // TODO: fill with your TEST price ids → plans
  // NOTE: the price below is the live product
  price_1S9FSOLV1NkgtKMpFGrODp7C: "basic",

  price_1SAblmLV1NkgtKMp569jEsoF: "test",
  // FUTURE: 'price_..._medium': 'medium',
  // FUTURE: 'price_..._premium': 'premium',
};

const planForPrice = (priceId) => PRICE_TO_PLAN[priceId] || "basic";
const normalize = (s) =>
  s === "past_due"
    ? "past_due"
    : s === "unpaid"
    ? "unpaid"
    : s === "canceled"
    ? "canceled"
    : s === "trialing"
    ? "trialing"
    : "active";

async function alreadyProcessed(eventId) {
  try {
    await Processed.create({ _id: eventId, type: "placeholder" });
    return false; // inserted now
  } catch {
    return true; // duplicate key
  }
}

exports.onCheckoutCompleted = async (event) => {
  if (await alreadyProcessed(event.id)) return;
  const s = event.data.object;
  const email = s.customer_details?.email?.toLowerCase();
  const metaId = s.metadata?.appUserId;
  let user = null;

  console.log(
    "Checkout completed for customer:",
    s.customer,
    "email:",
    email,
    "metaId:",
    metaId
  );

  if (metaId && mongoose.isValidObjectId(metaId)) {
    user = await User.findById(metaId);
  }
  if (!user && email) {
    user = await User.findOne({ email });
  }
  // Live buyers can pay before registering; create a minimal user by email
  if (!user && email) {
    user = await User.create({
      email,
      fullName: email.split("@")[0],
      subscriptionPlan: "free",
      subscriptionStatus: "disabled",
    });
  }
  if (!user) return; // no email → nothing we can do

  if (typeof s.customer === "string") {
    user.stripeCustomerId = s.customer;
    await user.save();
  }
  // Persist customer id
  if (typeof s.customer === "string") {
    user.stripeCustomerId = s.customer;
  }
  // Persist subscription id immediately if present
  const subscriptionId =
    typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
  if (subscriptionId) {
    user.stripeSubscriptionId = subscriptionId;
  }
  await user.save();
};

exports.onSubscriptionChange = async (event) => {
  if (await alreadyProcessed(event.id)) return;
  const sub = event.data.object;
  const user = await User.findOne({ stripeCustomerId: sub.customer });
  if (!user) return;

  const item = sub.items?.data?.[0];
  const price = item?.price;
  const plan = price?.id ? planForPrice(price.id) : user.subscriptionPlan;

  user.stripeSubscriptionId = sub.id;
  user.subscriptionPlan = plan;
  user.subscriptionStatus = normalize(sub.status);

  // optional nested dates if you added fields
  if (!user.subscription) user.subscription = {};
  user.subscription.priceId = price?.id || user.subscription?.priceId;
  user.subscription.productId = price?.product || user.subscription?.productId;
  user.subscription.cancelAtPeriodEnd = !!sub.cancel_at_period_end;
  user.subscription.currentPeriodStart = new Date(
    sub.current_period_start * 1000
  );
  user.subscription.currentPeriodEnd = new Date(sub.current_period_end * 1000);
  user.subscription.trialEnd = sub.trial_end
    ? new Date(sub.trial_end * 1000)
    : null;
  user.subscription.updatedAt = new Date();

  await user.save();
};

exports.onInvoicePaid = async (event) => {
  if (await alreadyProcessed(event.id)) return;
  const inv = event.data.object;
  const user = await User.findOne({ stripeCustomerId: inv.customer });
  if (!user) return;
  if (user.subscriptionStatus !== "active") {
    user.subscriptionStatus = "active";
    await user.save();
  }
};

exports.onPaymentFailed = async (event) => {
  if (await alreadyProcessed(event.id)) return;
  const inv = event.data.object;
  const user = await User.findOne({ stripeCustomerId: inv.customer });
  if (!user) return;
  user.subscriptionStatus = "past_due";
  await user.save();
};
