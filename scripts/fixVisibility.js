// scripts/setTemplateVisibilityFromSeed.js
require("dotenv").config();
const mongoose = require("mongoose");
const GutterProductTemplate = require("../models/gutterProductTemplate");
const { starterItems } = require("../scripts/seedTemplate"); // must export starterItems from your seed

const DRY = process.env.DRY_RUN !== "false"; // default DRY mode

(async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/",
      {
        dbName: process.env.MONGO_DB || "esti-mate",
      }
    );
    console.log("[templates] Connected");

    // Use NAME as key (ensure template names are unique in DB)
    const allowed = new Set(starterItems.map((i) => (i.name || "").trim()));
    const templates = await GutterProductTemplate.find(
      {},
      { _id: 1, name: 1, showInProductList: 1 }
    ).lean();

    let toTrue = 0,
      toFalse = 0,
      unchanged = 0;

    for (const t of templates) {
      const desired = allowed.has((t.name || "").trim());
      if (t.showInProductList === desired) {
        unchanged++;
        continue;
      }

      if (!DRY) {
        await GutterProductTemplate.updateOne(
          { _id: t._id },
          { $set: { showInProductList: desired } }
        );
      }
      desired ? toTrue++ : toFalse++;
    }

    console.log(
      `[${
        DRY ? "DRY_RUN" : "APPLY"
      }] set true=${toTrue}, false=${toFalse}, unchanged=${unchanged}`
    );
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
