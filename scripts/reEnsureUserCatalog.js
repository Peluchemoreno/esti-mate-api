// scripts/reEnsureUserCatalog.js
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

function computeListedFromTemplate(t) {
  // Only explicit true should be listed in UI.
  return t.showInProductList === true;
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
    price: 1, // keep your existing behavior
    slug: typeof t.slug === "string" && t.slug ? t.slug : undefined,
    createdAt: new Date(),
    // IMPORTANT: do NOT put listed/updatedAt here to avoid operator conflicts
  };
}

// Backfill + resync one user
async function reEnsureOneUser(userIdRaw, { dryRun = false } = {}) {
  const userId = toObjectId(userIdRaw);

  // 1) Load templates (authoritative source)
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

  const seedsTotal = templates.length;

  // 2) Existing user products by templateId
  const existing = await UserGutterProduct.find(
    { userId, templateId: { $ne: null } },
    { templateId: 1 }
  ).lean();

  const have = new Set(existing.map((d) => String(d.templateId)));

  // 3) Determine missing templates for this user
  const missing = templates.filter((t) => !have.has(String(t._id)));

  // 4) Bulk ops: upsert missing + ALWAYS resync listed for all templates
  const now = new Date();

  // A) Upserts for missing template rows
  const upsertOps = missing.map((t) => {
    const listedComputed = computeListedFromTemplate(t);
    return {
      updateOne: {
        filter: { userId, templateId: t._id },
        update: {
          $setOnInsert: templateToUserDoc(userId, t),
          // Keep listed only here (not in $setOnInsert) to prevent conflicts
          $set: { updatedAt: now, listed: listedComputed },
        },
        upsert: true,
      },
    };
  });

  // B) Resync listed for ALL existing template rows (including ones that already exist)
  // We do this as a second pass bulkWrite, because it’s cheaper than per-template upserts
  // and guarantees deterministic UI listing counts.
  const resyncOps = templates.map((t) => {
    const listedComputed = computeListedFromTemplate(t);
    return {
      updateOne: {
        filter: { userId, templateId: t._id },
        update: { $set: { updatedAt: now, listed: listedComputed } },
        upsert: false,
      },
    };
  });

  if (dryRun) {
    const wouldInsert = missing.length;

    // Count how many would be listed true (after sync)
    const listedCount = templates.reduce(
      (acc, t) => acc + (computeListedFromTemplate(t) ? 1 : 0),
      0
    );

    console.log(
      `[user ${userId}] DRY RUN seedsTotal=${seedsTotal} missing=${wouldInsert} listedExpected=${listedCount}`
    );

    if (missing.length) {
      console.log(`[user ${userId}] Would insert:`);
      for (const t of missing) console.log(`  + ${t.name}`);
    }
    return {
      userId: String(userId),
      seedsTotal,
      inserted: 0,
      resynced: 0,
      listedExpected: listedCount,
      dry: true,
    };
  }

  let inserted = 0;
  let resynced = 0;

  // Run upserts first (create missing rows)
  if (upsertOps.length) {
    const res1 = await UserGutterProduct.bulkWrite(upsertOps, {
      ordered: false,
    });
    // inserted count is upsertedCount
    inserted = res1.upsertedCount || 0;
  }

  // Run resync pass (update listed on all rows that exist)
  if (resyncOps.length) {
    const res2 = await UserGutterProduct.bulkWrite(resyncOps, {
      ordered: false,
    });
    // matchedCount ~ how many existed; modifiedCount ~ how many changed
    resynced = res2.modifiedCount || 0;
  }

  // Compute expected listed count from templates
  const listedExpected = templates.reduce(
    (acc, t) => acc + (computeListedFromTemplate(t) ? 1 : 0),
    0
  );

  console.log(
    `[user ${userId}] seedsTotal=${seedsTotal} inserted=${inserted} resynced=${resynced} listedExpected=${listedExpected}`
  );

  return {
    userId: String(userId),
    seedsTotal,
    inserted,
    resynced,
    listedExpected,
  };
}

// --- CLI -------------------------------------------------------------------

/**
 * Usage:
 *  node scripts/reEnsureUserCatalog.js --user=<userId>
 *  node scripts/reEnsureUserCatalog.js --all
 *  node scripts/reEnsureUserCatalog.js --all --dry
 */
async function main() {
  const argv = process.argv.slice(2);
  const useAll = argv.includes("--all");
  const dryRun = argv.includes("--dry");
  const userArg = argv.find((a) => a.startsWith("--user="));
  const oneUserId = userArg ? userArg.split("=")[1] : null;

  if (!useAll && !oneUserId) {
    console.error(
      "Usage:\n  --user=<userId>  Re-ensure a single user\n  --all           Re-ensure all users\n  [--dry]         Dry run (no writes)"
    );
    process.exit(2);
  }

  const uri = process.env.MONGODB_URI;
  const db = process.env.MONGO_DB || "esti-mate";

  if (!uri) {
    console.error("Missing env var MONGODB_URI");
    process.exit(2);
  }

  await mongoose.connect(uri, { dbName: db });
  console.log("Connected:", db);

  let totalUsers = 0;
  let totalInserted = 0;
  let totalResynced = 0;

  try {
    if (oneUserId) {
      totalUsers = 1;
      const r = await reEnsureOneUser(oneUserId, { dryRun });
      totalInserted += r.inserted || 0;
      totalResynced += r.resynced || 0;
    } else {
      const users = await User.find({}, { _id: 1 }).lean();
      totalUsers = users.length;
      console.log(`Scanning ${users.length} users...`);

      for (const u of users) {
        const r = await reEnsureOneUser(String(u._id), { dryRun });
        totalInserted += r.inserted || 0;
        totalResynced += r.resynced || 0;
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log(
    `Done. users=${totalUsers} insertedTotal=${totalInserted} resyncedTotal=${totalResynced}${
      dryRun ? " (dry)" : ""
    }`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { reEnsureOneUser };
