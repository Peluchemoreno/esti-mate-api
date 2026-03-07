// REPLACE FILE
// FILE: esti-mate-api/scripts/backfillEstimateBusinessId.js

require("dotenv").config();
const mongoose = require("mongoose");
const Estimate = require("../models/estimate");
const User = require("../models/user");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });

  console.log("Connected:", {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
    estimateCollection: Estimate.collection.name,
    userCollection: User.collection.name,
  });

  const needsBackfillQuery = {
    $or: [{ businessId: { $exists: false } }, { businessId: null }],
  };

  const totalEstimates = await Estimate.countDocuments({});
  const missingCount = await Estimate.countDocuments({
    businessId: { $exists: false },
  });
  const nullCount = await Estimate.countDocuments({ businessId: null });
  const needsBackfillCount = await Estimate.countDocuments(needsBackfillQuery);

  console.log("Estimate counts:", {
    totalEstimates,
    missingCount,
    nullCount,
    needsBackfillCount,
  });

  const estimates = await Estimate.find(needsBackfillQuery).select(
    "_id userId businessId",
  );

  let updated = 0;
  let skippedNoUser = 0;
  let skippedNoBusiness = 0;

  for (const estimate of estimates) {
    const user = await User.findById(estimate.userId).select(
      "_id personalBusinessId",
    );

    if (!user) {
      skippedNoUser += 1;
      continue;
    }

    if (!user.personalBusinessId) {
      skippedNoBusiness += 1;
      continue;
    }

    estimate.businessId = user.personalBusinessId;
    await estimate.save();
    updated += 1;
  }

  console.log("Done:", {
    found: estimates.length,
    updated,
    skippedNoUser,
    skippedNoBusiness,
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("backfillEstimateBusinessId failed:", err);
  process.exit(1);
});
