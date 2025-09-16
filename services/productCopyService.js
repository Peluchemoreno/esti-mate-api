// services/productCopyService.js
const GutterProductTemplate = require("../models/gutterProductTemplate.js");
const UserGutterProduct = require("../models/userGutterProduct.js");

async function createUserProductCatalog(userId) {
  if (!userId) throw new Error("createUserProductCatalog: userId is required");

  const templates = await GutterProductTemplate.find({}, null, { lean: true });
  console.log("✅ templates found:", templates.length);

  const toUserProduct = (t) => ({
    userId,
    templateId: t._id,
    slug: t.slug || undefined,
    material: t.material || "aluminum",
    name: t.name,
    type: t.type,
    profile: t.profile,
    size: t.size,
    description: t.description,
    colorCode: t.defaultColor,
    unit: t.defaultUnit,
    price: 0,
    listed: t.type === "gutter",
    canWrapFascia: t.canWrapFascia,
    canReplaceFascia: t.canReplaceFascia,
    canBeRemoved: t.canBeRemoved,
    canBeRepaired: t.canBeRepaired,
    canReplace1x2: t.canReplace1x2,
    supportsGutterGuard: t.supportsGutterGuard,
    isDownspout: t.isDownspout,
    hasElbows: t.hasElbows,
    removalPricePerFoot: t.canBeRemoved ? 2.0 : 0,
    gutterGuardOptions: t.supportsGutterGuard
      ? [{ name: "Roll Lock", price: 6.5, unit: "foot" }]
      : [],
  });

  const ops = templates.map((t) => ({
    updateOne: {
      filter: { userId, templateId: t._id },
      update: {
        $setOnInsert: toUserProduct(t),
        // Don’t force overwrite slug/material if already exists
        $set: {
          ...(t.slug && { slug: t.slug }),
          ...(t.material && { material: t.material }),
        },
      },
      upsert: true,
    },
  }));

  try {
    const res = await UserGutterProduct.bulkWrite(ops, { ordered: false });
    console.log("📦 Catalog result:", {
      upserts: res.upsertedCount ?? 0,
      matched: res.matchedCount ?? 0,
    });
    return res;
  } catch (err) {
    console.error("❌ BulkWrite failed for user catalog:", err); // full object, not just message
    return null; // let controller report failure
  }
}

module.exports = { createUserProductCatalog };
