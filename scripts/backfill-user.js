// node scripts/backfillListedFromTemplates.js
require("dotenv").config();
const mongoose = require("mongoose");
const UserGutterProduct = require("../models/userGutterProduct");
const GutterProductTemplate = require("../models/gutterProductTemplate");

const DRY_RUN = String(process.env.DRY_RUN || "true").toLowerCase() !== "false";
// Set USER_ID in env to limit scope while testing (e.g., export USER_ID=68e2...)
const USER_ID = process.env.USER_ID || "68e2cddbf91b0a9fa6c20fda";

(async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/",
      {
        dbName: process.env.MONGO_DB || "esti-mate",
      }
    );
    console.log("Connected");

    // Build a map of templateId -> showInProductList (true/false/undefined)
    const templates = await GutterProductTemplate.find(
      {},
      { _id: 1, showInProductList: 1 }
    ).lean();

    const allow = new Map(
      templates.map((t) => [String(t._id), t.showInProductList]) // NOTE: keep undefined as-is
    );

    const match = { templateId: { $ne: null } };
    if (USER_ID) match.userId = USER_ID;

    // Gather stats first
    const [total, currentlyListed] = await Promise.all([
      UserGutterProduct.countDocuments(match),
      UserGutterProduct.countDocuments({ ...match, listed: true }),
    ]);

    console.log(
      `Scope: ${
        USER_ID ? "USER " + USER_ID : "ALL USERS"
      } | Seeded total=${total}, listed=${currentlyListed}`
    );

    let updates = 0;
    let skippedNoTemplateOpinion = 0;
    let changedTrue = 0;
    let changedFalse = 0;

    const cursor = UserGutterProduct.find(match, {
      _id: 1,
      templateId: 1,
      listed: 1,
      name: 1,
    }).cursor();

    for await (const doc of cursor) {
      const tplId = String(doc.templateId);
      const tplFlag = allow.get(tplId); // true | false | undefined

      if (tplFlag === undefined) {
        // Template has no opinion -> do not change this product
        skippedNoTemplateOpinion++;
        continue;
      }

      if (doc.listed !== tplFlag) {
        updates++;
        if (DRY_RUN) {
          console.log(
            `[DRY_RUN] would set listed=${tplFlag} for ${doc._id} (${doc.name})`
          );
        } else {
          await UserGutterProduct.updateOne(
            { _id: doc._id },
            { $set: { listed: tplFlag } }
          );
        }
        if (tplFlag) changedTrue++;
        else changedFalse++;
      }
    }

    console.log(
      `${
        DRY_RUN ? "[DRY_RUN] " : ""
      }Backfill summary: toUpdate=${updates}, ->true=${changedTrue}, ->false=${changedFalse}, skippedUndefinedFlag=${skippedNoTemplateOpinion}`
    );

    if (!DRY_RUN) {
      const afterListed = await UserGutterProduct.countDocuments({
        ...match,
        listed: true,
      });
      console.log(`Post-backfill listed count=${afterListed}`);
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
