/* eslint-disable no-console */
// Node v18+
// Wipes & rebuilds one user's UserGutterProducts from GutterProductTemplates.

const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

// ---- Env & args ----
const MONGODB_URI = process.env.MONGODB_URI;
const MONGO_DB = process.env.MONGO_DB || "esti-mate";
const USER_ID_ARG = process.env.USER_ID || process.argv[2];

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is required.");
  process.exit(1);
}
if (!USER_ID_ARG || !Types.ObjectId.isValid(USER_ID_ARG)) {
  console.error(
    "ERROR: Provide a valid USER_ID (env USER_ID or first CLI arg)."
  );
  process.exit(1);
}
const USER_ID = new Types.ObjectId(USER_ID_ARG);

// ---- Minimal inline models (avoid external imports) ----
const GutterProductTemplateSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true }, // 'gutter' | 'downspout' | 'accessory' | ...
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
    slug: String, // used for search/classification
    unit: { type: String, default: "foot" },
    price: { type: Number, default: 0 },
    colorCode: { type: String, default: "#000000" },
    color: { type: String, default: "#000000" },
    listed: { type: Boolean, default: true },
    description: String,
  },
  { timestamps: true, collection: "usergutterproducts" }
);

// Keep your DB unique index on (userId, templateId).
// db.usergutterproducts.createIndex({ userId:1, templateId:1 }, { unique:true })

const GutterProductTemplate = mongoose.model(
  "GutterProductTemplate",
  GutterProductTemplateSchema
);
const UserGutterProduct = mongoose.model(
  "UserGutterProduct",
  UserGutterProductSchema
);

// ---- Helpers ----
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
  // elbows/offsets and downspout line are considered fittings (hidden by default)
  return /elbow|offset/.test(n) || s.startsWith("downspout|");
}

// ---- Main ----
async function main() {
  console.log("Connecting…");
  await mongoose.connect(MONGODB_URI, { dbName: MONGO_DB });
  console.log("Connected to DB:", MONGO_DB);

  // Load templates (assumes you already backfilled slugs in templates)
  const templates = await GutterProductTemplate.find({}).lean();
  if (!templates.length) {
    console.error("ERROR: No templates found. Aborting.");
    process.exit(1);
  }
  console.log(`Templates loaded: ${templates.length}`);

  // Wipe user's existing catalog
  const del = await UserGutterProduct.deleteMany({ userId: USER_ID });
  console.log(`Deleted ${del.deletedCount} existing user catalog rows.`);

  // Build bulk upserts
  const ops = [];
  for (const t of templates) {
    const slug = t.slug && t.slug.trim() ? t.slug : slugifyTemplate(t);
    const fitting = isFittingByNameOrSlug({ name: t.name, slug });
    const unit = t.defaultUnit || (fitting ? "unit" : "foot");
    const color = t.defaultColor || "#000000";

    ops.push({
      updateOne: {
        filter: { userId: USER_ID, templateId: t._id },
        update: {
          $setOnInsert: {
            userId: USER_ID,
            templateId: t._id,
            name: t.name,
            slug,
            unit,
            colorCode: color,
            color,
            description: t.description || "",
            price: 0,
            listed: !fitting,
          },
        },
        upsert: true,
      },
    });
  }

  // Write in chunks to be safe
  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = ops.slice(i, i + CHUNK);
    const res = await UserGutterProduct.bulkWrite(batch, { ordered: false });
    const count =
      res.upsertedCount ?? Object.keys(res.upsertedIds || {}).length ?? 0;
    upserted += count;
  }

  const finalCount = await UserGutterProduct.countDocuments({
    userId: USER_ID,
  });
  console.log(`Upserted ~${upserted}. Final user catalog count: ${finalCount}`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
