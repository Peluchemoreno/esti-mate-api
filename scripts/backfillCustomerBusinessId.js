require("dotenv").config();
const mongoose = require("mongoose");
const Customer = require("../models/customer");
const User = require("../models/user");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });

  console.log("Connected:", {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
    customerCollection: Customer.collection.name,
    userCollection: User.collection.name,
  });

  const needsBackfillQuery = {
    $or: [{ businessId: { $exists: false } }, { businessId: null }],
  };

  const totalCustomers = await Customer.countDocuments({});
  const missingCount = await Customer.countDocuments({
    businessId: { $exists: false },
  });
  const nullCount = await Customer.countDocuments({ businessId: null });
  const needsBackfillCount = await Customer.countDocuments(needsBackfillQuery);

  console.log("Customer counts:", {
    totalCustomers,
    missingCount,
    nullCount,
    needsBackfillCount,
  });

  const customers = await Customer.find(needsBackfillQuery);

  let updated = 0;
  let skippedNoUser = 0;
  let skippedNoBusiness = 0;

  for (const customer of customers) {
    const user = await User.findById(customer.userId);

    if (!user) {
      skippedNoUser++;
      continue;
    }

    if (!user.personalBusinessId) {
      skippedNoBusiness++;
      continue;
    }

    customer.businessId = user.personalBusinessId;

    await customer.save();

    updated++;
  }

  console.log("Done:", {
    found: customers.length,
    updated,
    skippedNoUser,
    skippedNoBusiness,
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("backfillCustomerBusinessId failed:", err);
  process.exit(1);
});
