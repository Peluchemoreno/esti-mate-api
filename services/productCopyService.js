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

  const seeds = await GutterProductTemplate.find(
    {},
    {
      _id: 1,
      name: 1,
      type: 1,
      profile: 1,
      size: 1,
      description: 1,
      defaultColor: 1,
      defaultUnit: 1,
      showInProductList: 1, // 👈 important
    }
  ).lean();
  const uniqueSeedCount = new Set(seeds.map((s) => String(s._id))).size;
  console.log(
    `[ensureUserCatalog] user=${userId} uniqueSeedCount=${uniqueSeedCount}`
  );

  for (const s of seeds) {
    console.log(`Item: ${s.name} | showInProductList: ${s.showInProductList}`);
    const fitting = isFittingSlug(s.slug);
    const setOnInsert = {
      userId,
      templateId: s._id,
      name: s.name,
      type: s.type,
      profile: s.profile,
      size: s.size || "",
      description: s.description || "",
      colorCode: s.defaultColor || "#000000",
      unit: s.defaultUnit || (fitting ? "unit" : "foot"),
      price: 1,
      listed: !!s.showInProductList,
      createdAt: new Date(),
    };

    // only set slug if defined and non-empty
    if (s.slug && typeof s.slug === "string") {
      setOnInsert.slug = s.slug;
    }

    await UserGutterProduct.updateOne(
      { userId, templateId: s._id }, // ✅ unique key per user/template
      {
        $setOnInsert: setOnInsert,
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
  }
}

module.exports = { ensureUserCatalog };
