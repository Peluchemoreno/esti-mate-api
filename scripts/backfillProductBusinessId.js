require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/userGutterProduct");
const User = require("../models/user");

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 1000);

function formatMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function run() {
  const startedAt = Date.now();

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });

  console.log("Connected:", {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
    productCollection: Product.collection.name,
    userCollection: User.collection.name,
    chunkSize: CHUNK_SIZE,
  });

  const needsBackfillQuery = {
    $or: [{ businessId: { $exists: false } }, { businessId: null }],
  };

  const totalProducts = await Product.countDocuments({});
  const missingCount = await Product.countDocuments({
    businessId: { $exists: false },
  });
  const nullCount = await Product.countDocuments({ businessId: null });
  const needsBackfillCount = await Product.countDocuments(needsBackfillQuery);

  console.log("UserGutterProduct counts:", {
    totalProducts,
    missingCount,
    nullCount,
    needsBackfillCount,
  });

  if (needsBackfillCount === 0) {
    console.log("Nothing to backfill. Exiting.");
    process.exit(0);
  }

  console.log("Loading products needing backfill...");
  const products = await Product.find(needsBackfillQuery)
    .select("_id userId")
    .lean();

  const uniqueUserIds = [
    ...new Set(products.map((p) => String(p.userId)).filter(Boolean)),
  ];

  console.log("Lookup prep:", {
    productsFound: products.length,
    uniqueUserIds: uniqueUserIds.length,
  });

  console.log("Loading users with personalBusinessId...");
  const users = await User.find({
    _id: { $in: uniqueUserIds },
    personalBusinessId: { $ne: null },
  })
    .select("_id personalBusinessId")
    .lean();

  const userToBusinessMap = new Map(
    users.map((u) => [String(u._id), u.personalBusinessId]),
  );

  console.log("User map ready:", {
    usersLoaded: users.length,
    usersMissingBusinessId: uniqueUserIds.length - users.length,
  });

  let updated = 0;
  let skippedNoUser = 0;
  let skippedNoBusiness = 0;
  let bulkErrors = 0;
  let processed = 0;

  const totalChunks = Math.ceil(products.length / CHUNK_SIZE);

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunkStartedAt = Date.now();
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;

    const ops = [];

    for (const product of chunk) {
      processed += 1;

      if (!product.userId) {
        skippedNoUser += 1;
        continue;
      }

      const businessId = userToBusinessMap.get(String(product.userId));

      if (!businessId) {
        skippedNoBusiness += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { businessId } },
        },
      });
    }

    let chunkUpdated = 0;

    if (ops.length > 0) {
      try {
        const result = await Product.bulkWrite(ops, { ordered: false });
        chunkUpdated = result.modifiedCount || 0;
        updated += chunkUpdated;
      } catch (err) {
        bulkErrors += 1;
        console.error("bulkWrite chunk failed:", {
          chunkNumber,
          chunkStartIndex: i,
          chunkSize: chunk.length,
          opsCount: ops.length,
          message: err.message,
        });
      }
    }

    const elapsedMs = Date.now() - startedAt;
    const chunkElapsedMs = Date.now() - chunkStartedAt;
    const rate = processed > 0 ? processed / (elapsedMs / 1000) : 0;
    const remaining = products.length - processed;
    const etaMs = rate > 0 ? (remaining / rate) * 1000 : NaN;
    const percent = ((processed / products.length) * 100).toFixed(1);

    console.log("Progress:", {
      chunk: `${chunkNumber}/${totalChunks}`,
      processed,
      total: products.length,
      percent: `${percent}%`,
      chunkSize: chunk.length,
      chunkUpdated,
      updatedTotal: updated,
      skippedNoUser,
      skippedNoBusiness,
      bulkErrors,
      chunkTime: formatMs(chunkElapsedMs),
      elapsed: formatMs(elapsedMs),
      ratePerSec: Number(rate.toFixed(2)),
      eta: formatMs(etaMs),
    });
  }

  const totalElapsedMs = Date.now() - startedAt;

  console.log("Done:", {
    found: products.length,
    updated,
    skippedNoUser,
    skippedNoBusiness,
    bulkErrors,
    totalElapsed: formatMs(totalElapsedMs),
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("backfillProductBusinessId failed:", err);
  process.exit(1);
});
