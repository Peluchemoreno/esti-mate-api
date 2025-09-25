// services/productCopyService.js (or wherever ensureUserCatalog lives)
const mongoose = require("mongoose");
const GutterProductTemplate = require("../models/gutterProductTemplate");
const UserGutterProduct = require("../models/userGutterProduct");

function isFittingSlug(slug = "") {
  return /^downspout\|(elbow|offset)\|/i.test(String(slug || ""));
}

async function ensureUserCatalog(userIdRaw) {
  if (!userIdRaw) {
    throw new Error("ensureUserCatalog: missing userId");
  }
  const userId = new mongoose.Types.ObjectId(String(userIdRaw));

  const seeds = await GutterProductTemplate.find({
    /* archived: { $ne: true } */
  }).lean();
  const uniqueSeedCount = new Set(seeds.map((s) => String(s._id))).size;
  console.log(
    `[ensureUserCatalog] user=${userId} uniqueSeedCount=${uniqueSeedCount}`
  );

  for (const seed of seeds) {
    const fitting = isFittingSlug(seed.slug);

    await UserGutterProduct.updateOne(
      { userId, templateId: seed._id },
      {
        $setOnInsert: {
          userId,
          templateId: seed._id,

          // base fields
          name: seed.name,
          type: seed.type,
          profile: seed.profile,
          size: seed.size,
          colorCode: seed.defaultColor || "#000000",
          price: seed.price ?? 0,
          description: seed.description || "",
          unit: seed.defaultUnit || (fitting ? "unit" : "foot"),
          listed: fitting ? false : true,
        },

        // Keep $set EMPTY unless you truly need to sync; do not set updatedAt manually
        $set: {},
      },
      { upsert: true }
    );
  }
}

module.exports = { ensureUserCatalog };
