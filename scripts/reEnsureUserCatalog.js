// scripts/bootstrap_user_catalog.js
require("dotenv").config();
const mongoose = require("mongoose");
const { ensureUserCatalog } = require("../services/productCopyService");
import User from "../models/user";

const USER_ID = "68e8125e132f162dd9bd3b9f";

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });
  console.log("Connected");
  const users = await User.find({});
  console.log(users);

  // await ensureUserCatalog(USER_ID);
  console.log("Done");
  process.exit(0);
})();
