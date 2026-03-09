require("dotenv").config();

const mongoose = require("mongoose");
const BusinessCatalogItem = require("../models/businessCatalogItem");
const UserGutterProduct = require("../models/userGutterProduct");

const {
  legacyProductToBusinessCatalogItem,
  slugify,
} = require("../utils/catalog/legacyProductToBusinessCatalogItem");

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 500);

function formatMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";

  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;

  return `${s}s`;
}

async function run() {
  const startedAt = Date.now();

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });

  console.log("Connected:", {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
    productCollection: UserGutterProduct.collection.name,
    catalogCollection: BusinessCatalogItem.collection.name,
    chunkSize: CHUNK_SIZE,
  });

  console.log("Running diagnostic counts...");

  const totalProducts = await UserGutterProduct.countDocuments({});
  const withBusinessId = await UserGutterProduct.countDocuments({
    businessId: { $exists: true, $ne: null },
  });

  const missingBusinessId = await UserGutterProduct.countDocuments({
    $or: [{ businessId: { $exists: false } }, { businessId: null }],
  });

  console.log("UserGutterProduct counts:", {
    totalProducts,
    withBusinessId,
    missingBusinessId,
  });

  if (totalProducts === 0) {
    console.log("No products found in collection. Exiting.");
    process.exit(0);
  }

  console.log("Loading products for migration...");

  const products = await UserGutterProduct.find({}).lean();

  console.log("Loaded products:", products.length);

  let processed = 0;
  let skippedNoBusiness = 0;
  let skippedAdapterNull = 0;
  let updated = 0;
  let bulkErrors = 0;

  const totalChunks = Math.ceil(products.length / CHUNK_SIZE);

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunkStartedAt = Date.now();

    const chunk = products.slice(i, i + CHUNK_SIZE);
    const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;

    const ops = [];

    for (const product of chunk) {
      processed++;

      if (!product.businessId) {
        skippedNoBusiness++;
        continue;
      }

      const draft = legacyProductToBusinessCatalogItem(product);

      if (!draft) {
        skippedAdapterNull++;
        continue;
      }

      const uniqueSlug = slugify(
        `${draft.slug}-${String(product._id).slice(-6)}`,
      );

      ops.push({
        updateOne: {
          filter: {
            businessId: draft.businessId,
            "source.collection": "usergutterproducts",
            "source.legacyId": product._id,
          },
          update: {
            $set: {
              businessId: draft.businessId,
              name: draft.name,
              slug: uniqueSlug,
              description: draft.description,
              isActive: draft.isActive,
              measurementFamily: draft.measurementFamily,
              drawingToolFamily: draft.drawingToolFamily,
              category: draft.category,
              trade: draft.trade,
              pricing: draft.pricing,
              drawingDefaults: draft.drawingDefaults,
              legacySnapshot: draft.legacySnapshot,
              source: draft.source,
              metadata: draft.metadata,
            },
          },
          upsert: true,
        },
      });
    }

    let chunkUpdated = 0;

    if (ops.length > 0) {
      try {
        const result = await BusinessCatalogItem.bulkWrite(ops, {
          ordered: false,
        });

        chunkUpdated =
          (result.upsertedCount || 0) + (result.modifiedCount || 0);

        updated += chunkUpdated;
      } catch (err) {
        bulkErrors++;
        console.error("bulkWrite chunk failed:", {
          chunkNumber,
          chunkSize: chunk.length,
          opsCount: ops.length,
          message: err.message,
        });
      }
    }

    const elapsedMs = Date.now() - startedAt;
    const chunkElapsedMs = Date.now() - chunkStartedAt;

    const rate = processed > 0 ? processed / (elapsedMs / 1000) : 0;
    const remaining = products.length - processed;

    const etaMs = rate > 0 ? (remaining / rate) * 1000 : NaN;

    const percent = ((processed / products.length) * 100).toFixed(1);

    console.log("Progress:", {
      chunk: `${chunkNumber}/${totalChunks}`,
      processed,
      total: products.length,
      percent: `${percent}%`,
      chunkUpdated,
      updatedTotal: updated,
      skippedNoBusiness,
      skippedAdapterNull,
      bulkErrors,
      chunkTime: formatMs(chunkElapsedMs),
      elapsed: formatMs(elapsedMs),
      ratePerSec: Number(rate.toFixed(2)),
      eta: formatMs(etaMs),
    });
  }

  const totalElapsed = Date.now() - startedAt;

  console.log("Done:", {
    totalProducts: products.length,
    migrated: updated,
    skippedNoBusiness,
    skippedAdapterNull,
    bulkErrors,
    totalElapsed: formatMs(totalElapsed),
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("backfillBusinessCatalogItems failed:", err);
  process.exit(1);
});
