// REPLACE FILE
// FILE: esti-mate-api/scripts/backfillBusinessSubscriptions.js

/* eslint-disable no-console */
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/user");
const BusinessSubscription = require("../models/businessSubscription");

// Keep consistent with your webhook’s normalize logic
function normalizeStatus(s) {
  return s === "past_due"
    ? "past_due"
    : s === "unpaid"
    ? "unpaid"
    : s === "canceled"
    ? "canceled"
    : s === "trialing"
    ? "trialing"
    : s === "active"
    ? "active"
    : "inactive";
}

async function upsertBusinessSubscriptionFromUser(userDoc) {
  const businessId = userDoc.personalBusinessId;
  if (!businessId)
    return { skipped: true, reason: "missing_personalBusinessId" };

  const stripeCustomerId = userDoc.stripeCustomerId || null;
  const stripeSubscriptionId = userDoc.stripeSubscriptionId || null;

  // We only backfill meaningful subscription info if user has Stripe customer or subscription id.
  // (If you want “free” records too, remove this guard.)
  if (!stripeCustomerId && !stripeSubscriptionId) {
    return { skipped: true, reason: "no_stripe_ids" };
  }

  const plan = userDoc.subscriptionPlan || "free";
  const status = normalizeStatus(userDoc.subscriptionStatus);

  await BusinessSubscription.updateOne(
    { businessId },
    {
      $set: {
        businessId,
        stripeCustomerId,
        stripeSubscriptionId,
        plan,
        status,
        // Stage 1 default. Seat billing comes later.
        seatQuantity: 1,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return { skipped: false };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  const dryRun = ["1", "true", "yes", "on"].includes(
    String(process.env.DRY_RUN || "").toLowerCase(),
  );
  const limit = Number(process.env.LIMIT || 0); // 0 = unlimited
  const batchSize = Number(process.env.BATCH_SIZE || 200);

  await mongoose.connect(uri, { dbName: "esti-mate" });

  // Safety rail: refuse to run on unexpected DB
  if (mongoose.connection.name !== "esti-mate") {
    console.error(
      `Refusing to run: connected to DB "${mongoose.connection.name}" (expected "esti-mate")`,
    );
    process.exit(1);
  }

  console.log("Connected:", {
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    userCollection: User.collection.name,
    businessSubscriptionCollection: BusinessSubscription.collection.name,
    dryRun,
  });

  // Cursor over users that look subscription-relevant
  const query = {
    personalBusinessId: { $ne: null },
    $or: [
      { stripeCustomerId: { $exists: true, $ne: "" } },
      { stripeSubscriptionId: { $exists: true, $ne: "" } },
    ],
  };

  const totalCandidates = await User.countDocuments(query);
  console.log("Candidates:", { totalCandidates });

  const cursor = User.find(query)
    .select(
      "_id email personalBusinessId stripeCustomerId stripeSubscriptionId subscriptionPlan subscriptionStatus",
    )
    .cursor();

  let processed = 0;
  let createdOrUpdated = 0;
  let skippedNoStripe = 0;
  let skippedNoBiz = 0;

  for await (const user of cursor) {
    if (limit && processed >= limit) break;
    processed += 1;

    if (dryRun) {
      if (!user.personalBusinessId) skippedNoBiz += 1;
      else if (!user.stripeCustomerId && !user.stripeSubscriptionId)
        skippedNoStripe += 1;
      else createdOrUpdated += 1;

      console.log(
        `[DRY_RUN] user=${user._id} email=${user.email} biz=${
          user.personalBusinessId
        } cust=${user.stripeCustomerId || ""} sub=${
          user.stripeSubscriptionId || ""
        }`,
      );
    } else {
      const res = await upsertBusinessSubscriptionFromUser(user);
      if (res.skipped) {
        if (res.reason === "missing_personalBusinessId") skippedNoBiz += 1;
        if (res.reason === "no_stripe_ids") skippedNoStripe += 1;
      } else {
        createdOrUpdated += 1;
        console.log(
          `upserted bizSub for user=${user._id} biz=${user.personalBusinessId} email=${user.email}`,
        );
      }
    }

    if (processed % batchSize === 0) {
      console.log("Progress:", {
        processed,
        createdOrUpdated,
        skippedNoBiz,
        skippedNoStripe,
      });
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log("Done:", {
    processed,
    createdOrUpdated,
    skippedNoBiz,
    skippedNoStripe,
  });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
