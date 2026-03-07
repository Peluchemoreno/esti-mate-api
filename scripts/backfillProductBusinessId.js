require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/UserGutterProduct");
const User = require("../models/user");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });

  console.log("Connected:", {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
    productCollection: Product.collection.name,
    userCollection: User.collection.name,
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
    totalUserGutterProducts: totalProducts,
    missingCount,
    nullCount,
    needsBackfillCount,
  });

  const products = await Product.find(needsBackfillQuery).select(
    "_id userId businessId name slug",
  );

  let updated = 0;
  let skippedNoUser = 0;
  let skippedNoBusiness = 0;
  let updateErrors = 0;

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

    try {
      await Product.updateOne(
        { _id: product._id },
        { $set: { businessId: user.personalBusinessId } },
      );
      updated += 1;
    } catch (err) {
      updateErrors += 1;
      console.error("Failed product update:", {
        productId: String(product._id),
        userId: String(product.userId),
        slug: product.slug || null,
        message: err.message,
      });
    }
  }

  console.log("Done:", {
    found: products.length,
    updated,
    skippedNoUser,
    skippedNoBusiness,
    updateErrors,
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("backfillProductBusinessId failed:", err);
  process.exit(1);
});
