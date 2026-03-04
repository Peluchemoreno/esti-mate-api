const mongoose = require("mongoose");

const BusinessSubscriptionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    stripeCustomerId: {
      type: String,
      index: true,
    },

    stripeSubscriptionId: {
      type: String,
      index: true,
    },

    plan: {
      type: String,
      default: "free",
    },

    status: {
      type: String,
      default: "inactive",
    },

    priceId: String,

    seatQuantity: {
      type: Number,
      default: 1,
    },

    cancelAtPeriodEnd: Boolean,

    currentPeriodStart: Date,
    currentPeriodEnd: Date,

    trialEnd: Date,
  },
  { timestamps: true },
);

BusinessSubscriptionSchema.index({ businessId: 1 }, { unique: true });

module.exports = mongoose.model(
  "BusinessSubscription",
  BusinessSubscriptionSchema,
);
