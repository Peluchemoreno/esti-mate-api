// scripts/backfillUserGutterProducts.js
require("dotenv").config();
const mongoose = require("mongoose");

const GutterProductTemplate = require("../models/gutterProductTemplate");
const UserGutterProduct = require("../models/userGutterProduct");
const User = require("../models/user");

// --- helpers ---------------------------------------------------------------

function isFittingSlug(slug = "") {
  return /^downspout\|(elbow|offset)\|/i.test(String(slug || ""));
}

function toObjectId(v) {
  return new mongoose.Types.ObjectId(String(v));
}

function templateToUserDoc(userId, t) {
  const fitting = isFittingSlug(t.slug || "");
  return {
    userId,
    templateId: t._id,
    name: t.name,
    type: t.type,
    profile: t.profile,
    size: t.size || "",
    description: t.description || "",
    colorCode: t.defaultColor || "#000000",
    unit: t.defaultUnit || (fitting ? "unit" : "foot"),
    price: 1, // default starter price; adjust if you prefer 0
    listed: (t.showInProductList ?? true) === true,
    slug: typeof t.slug === "string" && t.slug ? t.slug : undefined,
    createdAt: new Date(),
  };
}

// Upsert all missing template rows for one user
async function backfillOneUser(userIdRaw, { dryRun = false } = {}) {
  const userId = toObjectId(userIdRaw);

  const templates = await GutterProductTemplate.find(
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
      showInProductList: 1,
      slug: 1,
    }
  ).lean();

  // Existing per template
  const existing = await UserGutterProduct.find(
    { userId },
    { templateId: 1 }
  ).lean();
  const have = new Set(existing.map((d) => String(d.templateId)));

  const missing = templates.filter((t) => !have.has(String(t._id)));

  if (!missing.length) {
    console.log(`[user ${userId}] ✓ No missing products.`);
    return { inserted: 0 };
  }

  if (dryRun) {
    console.log(
      `[user ${userId}] DRY RUN — would insert ${missing.length} products:`
    );
    for (const t of missing) {
      console.log(`  + ${t.name} [${t.type}/${t.profile}/${t.size || ""}]`);
    }
    return { inserted: 0, dry: true };
  }

  const ops = missing.map((t) => ({
    updateOne: {
      filter: { userId, templateId: t._id },
      update: {
        // insert all fields on first create
        $setOnInsert: templateToUserDoc(userId, t),
        // always bump updatedAt (but do NOT also set it in $setOnInsert)
        $set: { updatedAt: new Date() },
      },
      upsert: true,
    },
  }));
  const res = await UserGutterProduct.bulkWrite(ops, { ordered: false });
  const inserted =
    (res.upsertedCount || 0) +
    Object.values(res.result?.nUpserted || {}).reduce((a, b) => a + b, 0);

  console.log(`[user ${userId}] + Inserted ${missing.length} products.`);
  return { inserted: missing.length };
}

// --- CLI -------------------------------------------------------------------

/**
 * Usage:
 *  node scripts/backfillUserGutterProducts.js --user=<userId>
 *  node scripts/backfillUserGutterProducts.js --all
 *  node scripts/backfillUserGutterProducts.js --all --dry
 */
async function main() {
  const argv = process.argv.slice(2);
  const useAll = argv.includes("--all");
  const dryRun = argv.includes("--dry");
  const userArg = argv.find((a) => a.startsWith("--user="));
  const oneUserId = userArg ? userArg.split("=")[1] : null;

  if (!useAll && !oneUserId) {
    console.error(
      "Usage:\n  --user=<userId>  Backfill a single user\n  --all           Backfill all users\n  [--dry]         Dry run (no writes)"
    );
    process.exit(2);
  }

  const uri = process.env.MONGODB_URI;
  const db = process.env.MONGO_DB || "esti-mate";
  await mongoose.connect(uri, { dbName: db });
  console.log("Connected:", db);

  try {
    if (oneUserId) {
      await backfillOneUser(oneUserId, { dryRun });
    } else {
      const users = await User.find({}, { _id: 1 }).lean();
      console.log(`Scanning ${users.length} users...`);
      for (const u of users) {
        await backfillOneUser(String(u._id), { dryRun });
      }
    }
  } finally {
    await mongoose.disconnect();
    console.log("Done.");
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { backfillOneUser };
