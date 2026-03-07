require("dotenv").config();
const mongoose = require("mongoose");
const UserGutterProduct = require("../models/UserGutterProduct");
const User = require("../models/user");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });

  console.log("Connected:", {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
    productCollection: UserGutterProduct.collection.name,
    userCollection: User.collection.name,
  });

  const needsBackfillQuery = {
    $or: [{ businessId: { $exists: false } }, { businessId: null }],
  };

  const totalUserGutterProducts = await UserGutterProduct.countDocuments({});
  const missingCount = await UserGutterProduct.countDocuments({
    businessId: { $exists: false },
  });
  const nullCount = await UserGutterProduct.countDocuments({
    businessId: null,
  });
  const needsBackfillCount = await UserGutterProduct.countDocuments(
    needsBackfillQuery,
  );

  console.log("UserGutterProduct counts:", {
    totalUserGutterProducts,
    missingCount,
    nullCount,
    needsBackfillCount,
  });

  const products = await UserGutterProduct.find(needsBackfillQuery).select(
    "_id userId businessId name",
  );

  let updated = 0;
  let skippedNoUser = 0;
  let skippedNoBusiness = 0;

  for (const product of products) {
    const user = await User.findById(product.userId).select(
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

    product.businessId = user.personalBusinessId;
    await product.save();
    updated += 1;
  }

  console.log("Done:", {
    found: products.length,
    updated,
    skippedNoUser,
    skippedNoBusiness,
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("backfillUserGutterProductBusinessId failed:", err);
  process.exit(1);
});
