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
      // remove this line to go back if seeding gets weird and starts making products have a ton of items in production
      slug: 1,
    }
  ).lean();
  // uncomment this block and remove the bottom copy to go back if seeding gets weird and starts making products have a ton of items in production

  /* const uniqueSeedCount = new Set(seeds.map((s) => String(s._id))).size;
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
  } */
  const uniqueSeedCount = new Set(seeds.map((s) => String(s._id))).size;
  console.log(
    `[ensureUserCatalog] user=${userId} seedsTotal=${seeds.length} uniqueSeedCount=${uniqueSeedCount}`
  );

  // visibility: if templates are missing slug in DB, you'll see it immediately
  const missingSlugNames = seeds.filter((s) => !s.slug).map((s) => s.name);
  if (missingSlugNames.length) {
    console.warn(
      "[ensureUserCatalog] templates missing slug:",
      missingSlugNames
    );
  }

  let ok = 0;
  let failed = [];

  for (const s of seeds) {
    try {
      const _listedComputed = s.showInProductList === true;
      console.log(
        `Item: ${s.name} | showInProductList(raw): ${s.showInProductList} | listed(computed): ${_listedComputed}`
      );

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
          $set: { updatedAt: new Date(), listed: _listedComputed },
        },
        { upsert: true }
      );

      ok++;
    } catch (e) {
      failed.push({
        templateId: String(s._id),
        name: s.name,
        err: e && e.message ? e.message : String(e),
      });
      console.error("[ensureUserCatalog] upsert failed:", s.name, s._id, e);
    }
  }

  console.log(`[ensureUserCatalog] done ok=${ok} failed=${failed.length}`);
  if (failed.length) {
    console.log("[ensureUserCatalog] failed list:", failed);
  }
}

module.exports = { ensureUserCatalog };
