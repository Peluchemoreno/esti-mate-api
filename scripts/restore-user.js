// restore_listed_true.js
require("dotenv").config();
const mongoose = require("mongoose");
const UserGutterProduct = require("../models/userGutterProduct");

const USER_ID = process.env.USER_ID || "68e2cddbf91b0a9fa6c20fda"; // set this for the single user you nuked

(async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/",
      {
        dbName: process.env.MONGO_DB || "esti-mate",
      }
    );
    console.log("Connected");

    if (!USER_ID) throw new Error("Set USER_ID in env");

    const res = await UserGutterProduct.updateMany(
      { userId: USER_ID, templateId: { $ne: null } },
      { $set: { listed: true } }
    );
    console.log("Restored:", res.modifiedCount, "docs");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
