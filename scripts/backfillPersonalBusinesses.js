// REPLACE FILE
// FILE: server/scripts/backfillPersonalBusinesses.js

// BEGIN CHANGE
/* eslint-disable no-console */
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/user");
const {
  ensurePersonalBusinessForUser,
} = require("../services/businessAdapter");

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

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const needsBackfillQuery = {
    $or: [
      { personalBusinessId: null },
      { personalBusinessId: { $exists: false } },
    ],
  };

  // Debug counts (fast, safe)
  const totalUsers = await User.countDocuments({});
  const nullCount = await User.countDocuments({ personalBusinessId: null });
  const missingCount = await User.countDocuments({
    personalBusinessId: { $exists: false },
  });
  const needsBackfillCount = await User.countDocuments(needsBackfillQuery);

  console.log("User counts:", {
    totalUsers,
    nullCount,
    missingCount,
    needsBackfillCount,
  });

  const cursor = User.find(needsBackfillQuery);
  // .select("_id email fullName companyName personalBusinessId")
  // .cursor();

  let processed = 0;

  for await (const user of cursor) {
    if (limit && processed >= limit) break;
    processed += 1;

    if (dryRun) {
      console.log(
        `[DRY_RUN] would backfill user=${user._id} email=${user.email}`,
      );
    } else {
      await ensurePersonalBusinessForUser(user);
      console.log(`backfilled user=${user._id} email=${user.email}`);
    }

    if (processed % batchSize === 0) {
      console.log(`progress processed=${processed}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`Done. processed=${processed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// END CHANGE
