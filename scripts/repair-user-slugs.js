/* eslint-disable no-console */
// scripts/rebuild-missing-slug-catalogs.js
// Node: v18+ recommended

const mongoose = require("mongoose");

// --- Config from env ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGO_DB = process.env.MONGO_DB || "esti-mate";

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is required in env.");
  process.exit(1);
}

// --- Minimal inline models (avoid path/import headaches) ---
const { Schema, Types } = mongoose;

const GutterProductTemplateSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true }, // 'gutter' | 'downspout' | 'accessory'...
    profile: String,
    size: String,
    isDownspout: { type: Boolean, default: false },
    defaultUnit: { type: String, default: "foot" },
    defaultColor: { type: String, default: "#000000" },
    description: String,
    slug: String,
  },
  { timestamps: true, collection: "gutterproducttemplates" }
);

const UserGutterProductSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    slug: String,
    unit: { type: String, default: "foot" },
    price: { type: Number, default: 1 },
    colorCode: { type: String, default: "#000000" },
    color: { type: String, default: "#000000" },
    listed: { type: Boolean, default: true },
    description: String,
  },
  { timestamps: true, collection: "usergutterproducts" }
);

// keep your important compound unique in DB:
// db.usergutterproducts.createIndex({ userId:1, templateId:1 }, { unique:true })

const GutterProductTemplate = mongoose.model(
  "GutterProductTemplate",
  GutterProductTemplateSchema
);
const UserGutterProduct = mongoose.model(
  "UserGutterProduct",
  UserGutterProductSchema
);

// --- Utilities ---
function slugifyTemplate(t = {}) {
  const type = t.type || "item";
  const base = t.isDownspout ? "downspout" : t.profile || t.type || "";
  const size = String(t.size || "").replace(/\s+/g, "");
  const name = String(t.name || "")
    .toLowerCase()
    .replace(/[^\w"]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${type}|${base}|${size}|${name}`;
}

function isFittingByNameOrSlug({ name, slug }) {
  const n = String(name || "").toLowerCase();
  const s = String(slug || "").toLowerCase();
  return /elbow|offset/.test(n) || s.startsWith("downspout|");
}

async function main() {
  console.log("Connecting to Mongo...");
  await mongoose.connect(MONGODB_URI, { dbName: MONGO_DB });
  console.log("Connected to DB:", MONGO_DB);

  // 1) Find users who have any products with missing/empty slug
  const affectedUserIds = await UserGutterProduct.distinct("userId", {
    $or: [{ slug: null }, { slug: { $exists: false } }, { slug: "" }],
  });

  if (!affectedUserIds.length) {
    console.log("✅ No users with missing/empty slugs. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${affectedUserIds.length} affected user(s).`);

  // 2) Load all templates once
  const templates = await GutterProductTemplate.find({}).lean();
  if (!templates.length) {
    console.error("ERROR: No templates found. Aborting.");
    process.exit(1);
  }
  console.log(`Loaded ${templates.length} templates.`);

  // 3) Rebuild each affected user's catalog
  for (const userId of affectedUserIds) {
    console.log(`\n🧹 Rebuilding catalog for user ${userId}...`);

    // wipe all existing rows for that user
    const delRes = await UserGutterProduct.deleteMany({ userId });
    console.log(` - deleted ${delRes.deletedCount} old rows`);

    // build bulk upserts from templates
    const ops = [];
    for (const t of templates) {
      const slug = t.slug && t.slug.trim() ? t.slug : slugifyTemplate(t);
      const fitting = isFittingByNameOrSlug({ name: t.name, slug });
      const unit = t.defaultUnit || (fitting ? "unit" : "foot");
      const color = t.defaultColor || "#000000";

      // upsert by (userId, templateId) — match your API’s identity
      ops.push({
        updateOne: {
          filter: { userId, templateId: t._id },
          update: {
            $setOnInsert: {
              userId,
              templateId: t._id,
              name: t.name,
              slug,
              unit,
              colorCode: color,
              color,
              description: t.description || "",
              price: 1,
              listed: !fitting,
            },
          },
          upsert: true,
        },
      });
    }

    // Execute in chunks to avoid very large batches (safety)
    const CHUNK = 500;
    let upserted = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = ops.slice(i, i + CHUNK);
      const res = await UserGutterProduct.bulkWrite(batch, { ordered: false });
      // res.upsertedCount may be undefined in some driver versions, compute from res.upsertedIds
      const count =
        res.upsertedCount ?? Object.keys(res.upsertedIds || {}).length ?? 0;
      upserted += count;
    }

    const finalCount = await UserGutterProduct.countDocuments({ userId });
    console.log(
      ` - upserted ~${upserted}, final user catalog count = ${finalCount}`
    );
  }

  console.log("\n✅ Done.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
