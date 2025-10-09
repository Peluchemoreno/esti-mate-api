// scripts/bootstrap_user_catalog.js
require("dotenv").config();
const mongoose = require("mongoose");
const { ensureUserCatalog } = require("../services/productCopyService");
const User = require("../models/user");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });
  console.log("Connected");
  const users = await User.find({});
  const userIds = users.map((user) => {
    return { id: String(user._id) };
  });

  for (let i = 0; i < userIds.length; i++) {
    console.log(userIds[i]);
    await ensureUserCatalog(userIds[i].id);
  }

  console.log("Done");
  process.exit(0);
})();
