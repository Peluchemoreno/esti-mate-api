/* eslint-disable no-console */
require("dotenv").config();

const mongoose = require("mongoose");
const BusinessCatalogItem = require("../models/businessCatalogItem");
const UserGutterProduct = require("../models/userGutterProduct");
const {
  legacyProductToBusinessCatalogItem,
  slugify,
} = require("../utils/catalog/legacyProductToBusinessCatalogItem");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  throw new Error("Missing MONGO_URI or MONGODB_URI");
}

async function flushBatch(batch) {
  if (!batch.length) {
    return {
      upsertedCount: 0,
      modifiedCount: 0,
    };
  }

  return BusinessCatalogItem.bulkWrite(batch, {
    ordered: false,
  });
}

async function main() {
  await mongoose.connect(MONGO_URI);

  console.log("[backfillBusinessCatalogItems] connected");

  const cursor = UserGutterProduct.find({})
    .select({
      _id: 1,
      userId: 1,
      businessId: 1,
      name: 1,
      title: 1,
      label: 1,
      productName: 1,
      slug: 1,
      description: 1,
      notes: 1,
      category: 1,
      type: 1,
      productType: 1,
      itemType: 1,
      kind: 1,
      unit: 1,
      unitLabel: 1,
      pricingUnit: 1,
      priceUnit: 1,
      measureType: 1,
      measurementType: 1,
      measurementFamily: 1,
      drawingToolFamily: 1,
      toolFamily: 1,
      drawType: 1,
      unitPrice: 1,
      price: 1,
      amount: 1,
      basePrice: 1,
      color: 1,
      strokeColor: 1,
      dashed: 1,
      fill: 1,
      fillColor: 1,
      strokeWidth: 1,
      opacity: 1,
      radius: 1,
      shape: 1,
      markerShape: 1,
      isActive: 1,
    })
    .lean()
    .cursor();

  let processed = 0;
  let skippedNoBusiness = 0;
  let upserts = 0;
  let modified = 0;
  let batch = [];
  const BATCH_SIZE = 250;

  for await (const legacyProduct of cursor) {
    processed += 1;

    const draft = legacyProductToBusinessCatalogItem(legacyProduct);

    if (!draft || !draft.businessId) {
      skippedNoBusiness += 1;
      continue;
    }

    const uniqueSlug = slugify(
      `${draft.slug}-${String(legacyProduct._id).slice(-6)}`
    );

    batch.push({
      updateOne: {
        filter: {
          businessId: draft.businessId,
          "source.collection": "usergutterproducts",
          "source.legacyId": legacyProduct._id,
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
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      const result = await flushBatch(batch);
      upserts += result.upsertedCount || 0;
      modified += result.modifiedCount || 0;

      console.log(
        `[backfillBusinessCatalogItems] processed=${processed} upserts=${upserts} modified=${modified} skippedNoBusiness=${skippedNoBusiness}`
      );

      batch = [];
    }
  }

  if (batch.length) {
    const result = await flushBatch(batch);
    upserts += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
  }

  console.log("[backfillBusinessCatalogItems] done", {
    processed,
    skippedNoBusiness,
    upserts,
    modified,
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[backfillBusinessCatalogItems] failed", err);

  try {
    await mongoose.disconnect();
  } catch (disconnectErr) {
    console.error(
      "[backfillBusinessCatalogItems] disconnect failed",
      disconnectErr
    );
  }

  process.exit(1);
});